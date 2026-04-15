package di

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/phuc/cmms-backend/internal/adapters/http/handlers"
	"github.com/phuc/cmms-backend/internal/adapters/http/middleware"
	"github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/config"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/infrastructure/messaging"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	infraWS "github.com/phuc/cmms-backend/internal/infrastructure/websocket"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// Container holds all instantiated dependencies (Repositories, Services, Handlers).
type Container struct {
	Config config.Config
	DB     *gorm.DB

	// External
	MinioClient *storage.MinioClient
	WSHub       *infraWS.Hub
	MQPublisher *messaging.Publisher

	// Sub-Modules
	Auth        *handlers.AuthHandler
	User        *handlers.UserHandler
	Role        *handlers.RoleHandler
	Team        *handlers.TeamHandler
	Project     *handlers.ProjectHandlerV2
	Asset       *handlers.AssetHandler
	ConfigH     *handlers.ConfigHandler
	Template    *handlers.TemplateHandler
	Notify      *handlers.NotificationHandler
	Assign      *handlers.AssignHandler
	Stats       *handlers.StatsHandler
	Station     *handlers.StationHandler
	Attendance  *handlers.AttendanceHandler
	Admin       *handlers.AdminHandler
	Media       *handlers.MediaHandler
	Upload      *handlers.UploadHandler
	Lark        *handlers.LarkHandler
	Report      *handlers.ReportHandler

	// Core Services needed for Router logic
	AuthService    *services.AuthService
	ReminderSvc    *services.ReminderService
	MinioWorker    *messaging.MinioWorker
	RMQConsumer    *messaging.Consumer
	WSHandler      *infraWS.Handler
}

// BuildContainer wires all dependencies together exactly as main.go used to do.
func BuildContainer(cfg config.Config, db *gorm.DB) *Container {
	c := &Container{
		Config: cfg,
		DB:     db,
		WSHub:  infraWS.NewHub(),
	}

	// 1. External Infrastructure
	minioClient, err := storage.NewMinioClient()
	if err != nil {
		logger.Get().Warn("Failed to initialize MinIO", zap.Error(err))
	} else {
		c.MinioClient = minioClient
	}

	// 2. Repositories
	userRepo := postgres.NewUserRepository(db)
	roleRepo := postgres.NewRoleRepository(db)
	teamRepo := postgres.NewTeamRepository(db)
	ownerRepo := postgres.NewOwnerRepository(db)
	projectRepo := postgres.NewProjectRepository(db)
	assetRepo := postgres.NewAssetRepository(db)
	workRepo := postgres.NewWorkRepository(db)
	subWorkRepo := postgres.NewSubWorkRepository(db)
	configRepo := postgres.NewConfigRepository(db)
	templateRepo := postgres.NewTemplateRepository(db)
	assignRepo := postgres.NewAssignRepository(db)
	detailAssignRepo := postgres.NewDetailAssignRepository(db)
	statsRepo := postgres.NewStatsRepository(db)
	attendanceRepo := postgres.NewAttendanceRepository(db)
	reportRepo := postgres.NewReportRepository(db)

	// 3. Core Services
	c.AuthService = services.NewAuthService(userRepo)
	userService := services.NewUserService(userRepo)
	notificationService := services.NewNotificationService(db, c.WSHub)
	larkService := services.NewLarkService(cfg.Lark.AppID, cfg.Lark.AppSecret)
	statsService := services.NewStatsService(statsRepo)
	c.ReminderSvc = services.NewReminderService(db, notificationService)
	attendanceService := services.NewAttendanceService(attendanceRepo, c.MinioClient, notificationService)
	reportService := services.NewReportService(reportRepo)

	// 4. Handlers
	c.Auth = handlers.NewAuthHandler(c.AuthService)
	c.User = handlers.NewUserHandler(userService)
	c.Role = handlers.NewRoleHandler(roleRepo)
	c.Team = handlers.NewTeamHandler(teamRepo)
	c.Project = handlers.NewProjectHandlerV2(db, projectRepo, ownerRepo)
	c.Asset = handlers.NewAssetHandler(assetRepo, workRepo, subWorkRepo)
	c.ConfigH = handlers.NewConfigHandler(configRepo)
	c.Template = handlers.NewTemplateHandler(templateRepo)
	c.Notify = handlers.NewNotificationHandler(db, notificationService)
	c.Assign = handlers.NewAssignHandler(db, assignRepo, detailAssignRepo, configRepo, assetRepo, workRepo, subWorkRepo, templateRepo, c.WSHub, notificationService, larkService, cfg)
	c.Stats = handlers.NewStatsHandler(statsService)
	c.Station = handlers.NewStationHandler(db)
	c.Attendance = handlers.NewAttendanceHandler(attendanceService, c.Stats)
	c.Admin = handlers.NewAdminHandler(db)
	c.Media = handlers.NewMediaHandler(c.MinioClient)
	c.Upload = handlers.NewUploadHandler(c.MinioClient)
	c.Lark = handlers.NewLarkHandler(larkService)
	c.Report = handlers.NewReportHandler(reportService)

	// Wiring WS Handler
	c.WSHandler = infraWS.NewHandler(c.WSHub, c.AuthService)

	// Extract Publisher from Assign Handler and cache it in Container
	c.MQPublisher = c.Assign.GetPublisher()

	// 5. Mount Background RMQ Workers
	rmqConsumer, rmqErr := messaging.NewConsumer(db, 4)
	if rmqErr == nil && rmqConsumer != nil {
		c.RMQConsumer = rmqConsumer
	}

	minioWorker, mwErr := messaging.NewMinioWorker(4, c.MinioClient, c.MQPublisher)
	if mwErr == nil && minioWorker != nil {
		c.MinioWorker = minioWorker
	}

	return c
}

// StartBackgroundWorkers initializes any non-HTTP goroutines (Consumers, REMINDERS, RMQ)
func (c *Container) StartBackgroundWorkers(ctx context.Context) {
	c.ReminderSvc.Start()

	if c.RMQConsumer != nil {
		logger.Get().Info("RabbitMQ DB Consumer starting (4 workers)")
		go c.RMQConsumer.Start(ctx)
	}

	if c.MinioWorker != nil {
		logger.Get().Info("RabbitMQ MinioWorker starting (4 workers)")
		go c.MinioWorker.Start(ctx)
	}
}

// StopBackgroundWorkers shuts down graceful background tasks
func (c *Container) StopBackgroundWorkers() {
	if c.ReminderSvc != nil {
		c.ReminderSvc.Stop()
	}
	if c.RMQConsumer != nil {
		c.RMQConsumer.Stop()
	}
	if c.MinioWorker != nil {
		c.MinioWorker.Stop()
	}
}

// SetupRouter creates Gin Engine and maps all HTTP routes
func (c *Container) SetupRouter() *gin.Engine {
	if c.Config.Server.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
	r.Use(middleware.ErrorHandler())
	r.Use(middleware.RateLimitMiddleware(3000, 1*time.Minute))
	r.Use(c.configureCORS())
	r.Use(noCacheMiddleware())

	api := r.Group("/api")

	// --- PUBLIC ROUTES ---
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.GET("/", func(ctx *gin.Context) { ctx.String(http.StatusOK, "CMMS Backend V2 is running!") })
	api.Any("/health", func(ctx *gin.Context) { ctx.String(http.StatusOK, "OK") })

	api.GET("/media/proxy", c.Media.ProxyImage)
	api.GET("/media/download-zip", c.Media.DownloadFolder)
	api.GET("/public/report/:id", c.Assign.GetPublicReport)
	api.GET("/public/generic-report/:id", c.Report.GetGenericReport)
	api.GET("/public/attendance-by-assign", c.Attendance.GetByAssignDates)

	api.POST("/auth/login", middleware.RateLimitMiddleware(5, 1*time.Minute), c.Auth.Login)
	api.POST("/auth/logout", c.Auth.Logout)

	r.GET("/api/ws", func(ctx *gin.Context) { c.WSHandler.ServeWS(ctx.Writer, ctx.Request) })

	// --- PROTECTED ROUTES ---
	protected := api.Group("/")
	protected.Use(middleware.AuthMiddleware(c.AuthService))
	protected.Use(middleware.MaintenanceGuard())
	{
		c.mapProtectedRoutes(protected)
	}

	return r
}

func (c *Container) mapProtectedRoutes(p *gin.RouterGroup) {
	// Media
	p.GET("/media/library", c.Media.GetLibraryImages)
	p.DELETE("/media/folder", c.Media.DeleteFolder)
	p.POST("/upload/guideline", c.Upload.UploadGuideline)

	// Users
	p.GET("/users", c.User.GetAllUsers)
	p.GET("/users/:id", c.User.GetUserByID)
	p.POST("/users", c.User.CreateUser)
	p.PUT("/users/:id", c.User.UpdateUser)
	p.PUT("/users/:id/password", c.User.ChangePassword)
	p.DELETE("/users/:id", c.User.DeleteUser)
	p.GET("/users/history", c.User.ListDeletedUsers)
	p.POST("/users/bulk-restore", c.User.BulkRestoreUsers)
	p.DELETE("/users/bulk-permanent", c.User.BulkPermanentDeleteUsers)
	p.POST("/users/:id/restore", c.User.RestoreUser)
	p.DELETE("/users/:id/permanent", c.User.PermanentDeleteUser)

	// Roles & Teams
	p.GET("/roles", c.Role.GetAllRoles)
	p.POST("/roles", c.Role.CreateRole)
	p.GET("/teams", c.Team.GetAllTeams)
	p.POST("/teams", c.Team.CreateTeam)

	// Templates & Configs
	p.GET("/templates", c.Template.GetAllTemplates)
	p.GET("/templates/:id", c.Template.GetTemplateByID)
	p.POST("/templates", c.Template.CreateTemplate)
	p.PUT("/templates/:id", c.Template.UpdateTemplate)
	p.DELETE("/templates/:id", c.Template.DeleteTemplate)
	p.GET("/configs", c.ConfigH.ListConfigs)
	p.GET("/configs/:id", c.ConfigH.GetConfig)
	p.POST("/configs", c.ConfigH.CreateConfig)
	p.PUT("/configs/:id", c.ConfigH.UpdateConfig)
	p.DELETE("/configs/:id", c.ConfigH.DeleteConfig)

	// Reports
	p.POST("/reports", c.Report.CreateReport)

	// Notifications
	p.POST("/monitoring/subscribe", c.Notify.Subscribe)
	p.GET("/monitoring/vapid-key", c.Notify.GetVapidPublicKey)
	p.GET("/notifications", c.Notify.GetNotifications)
	p.PUT("/notifications/:id/read", c.Notify.MarkRead)
	p.PUT("/notifications/read-all", c.Notify.MarkAllRead)
	p.DELETE("/notifications/:id", c.Notify.DeleteNotification)
	p.DELETE("/notifications/delete-all", c.Notify.DeleteAllNotifications)

	// Stats & Admin
	p.GET("/admin/stats", c.Stats.GetAdminStats)
	p.GET("/manager/stats", c.Stats.GetManagerStats)
	p.GET("/user/stats", c.Stats.GetUserStats)
	p.GET("/admin/maintenance", c.Notify.GetMaintenanceStatus)
	p.POST("/admin/maintenance", c.Notify.ToggleMaintenance)
	p.GET("/admin/tables", c.Admin.GetAllTables)
	p.GET("/admin/tables/:table", c.Admin.GetTableData)
	p.POST("/admin/tables/:table", c.Admin.CreateRow)
	p.PUT("/admin/tables/:table/:id", c.Admin.UpdateRow)
	p.DELETE("/admin/tables/:table/:id", c.Admin.DeleteRow)
	p.POST("/admin/tables/:table/bulk-delete", c.Admin.DeleteRows)

	// Attendance
	p.POST("/attendance/checkin-with-photos", c.Attendance.CheckInWithPhotos)
	p.POST("/attendance/checkin", c.Attendance.CheckIn)
	p.POST("/attendance/checkout", c.Attendance.CheckOut)
	p.POST("/attendance/request-checkout", c.Attendance.RequestCheckout)
	p.POST("/attendance/approve-checkout/:id", c.Attendance.ApproveCheckout)
	p.POST("/attendance/reject-checkout/:id", c.Attendance.RejectCheckout)
	p.GET("/attendance/pending-checkouts", c.Attendance.GetPendingCheckouts)
	p.GET("/attendance/today/:user_id", c.Attendance.GetTodayAttendance)
	p.GET("/attendance/history/:user_id", c.Attendance.GetUserHistory)
	p.GET("/attendance/today/all", c.Attendance.GetAllTodayAttendances)
	p.GET("/attendance/history/all", c.Attendance.GetAllHistory)
	p.GET("/attendance/onsite", c.Attendance.GetUsersOnSite)
	p.GET("/attendance/detail/:id", c.Attendance.GetDetail)
	p.GET("/attendance/lookup", c.Attendance.Lookup)
	p.GET("/attendance/by-assign-dates", c.Attendance.GetByAssignDates)

	// V2 Projects & Owners
	p.GET("/owners", c.Project.ListOwners)
	p.POST("/owners", c.Project.CreateOwner)
	p.DELETE("/owners/:id", c.Project.DeleteOwner)
	p.GET("/projects/history", c.Project.ListDeletedProjects)
	p.POST("/projects/bulk-restore", c.Project.BulkRestoreProjects)
	p.DELETE("/projects/bulk-permanent", c.Project.BulkPermanentDeleteProjects)
	p.GET("/projects", c.Project.ListProjects)
	p.GET("/projects/:id", c.Project.GetProject)
	p.POST("/projects", c.Project.CreateProject)
	p.PUT("/projects/:id", c.Project.UpdateProject)
	p.DELETE("/projects/:id", c.Project.DeleteProject)
	p.POST("/projects/:id/restore", c.Project.RestoreProject)
	p.DELETE("/projects/:id/permanent", c.Project.PermanentDeleteProject)
	p.POST("/projects/:id/clone", c.Project.CloneProject)

	// V2 Asset / Work / SubWork
	p.GET("/assets/history", c.Asset.ListDeletedAssets)
	p.POST("/assets/bulk-restore", c.Asset.BulkRestoreAssets)
	p.DELETE("/assets/bulk-permanent", c.Asset.BulkPermanentDeleteAssets)
	p.POST("/assets/:id/restore", c.Asset.RestoreAsset)
	p.DELETE("/assets/:id/permanent", c.Asset.PermanentDeleteAsset)
	p.GET("/assets", c.Asset.ListAssets)
	p.GET("/assets/:id", c.Asset.GetAsset)
	p.POST("/assets", c.Asset.CreateAsset)
	p.PUT("/assets/:id", c.Asset.UpdateAsset)
	p.DELETE("/assets/:id", c.Asset.DeleteAsset)

	p.GET("/works/history", c.Asset.ListDeletedWorks)
	p.POST("/works/bulk-restore", c.Asset.BulkRestoreWorks)
	p.DELETE("/works/bulk-permanent", c.Asset.BulkPermanentDeleteWorks)
	p.POST("/works/:id/restore", c.Asset.RestoreWork)
	p.DELETE("/works/:id/permanent", c.Asset.PermanentDeleteWork)
	p.GET("/works", c.Asset.ListWorks)
	p.GET("/works/:id", c.Asset.GetWork)
	p.POST("/works", c.Asset.CreateWork)
	p.PUT("/works/:id", c.Asset.UpdateWork)
	p.DELETE("/works/:id", c.Asset.DeleteWork)

	p.GET("/sub-works/history", c.Asset.ListDeletedSubWorks)
	p.POST("/sub-works/bulk-restore", c.Asset.BulkRestoreSubWorks)
	p.DELETE("/sub-works/bulk-permanent", c.Asset.BulkPermanentDeleteSubWorks)
	p.POST("/sub-works/:id/restore", c.Asset.RestoreSubWork)
	p.DELETE("/sub-works/:id/permanent", c.Asset.PermanentDeleteSubWork)
	p.GET("/sub-works", c.Asset.ListSubWorks)
	p.GET("/sub-works/:id", c.Asset.GetSubWork)
	p.POST("/sub-works", c.Asset.CreateSubWork)
	p.PUT("/sub-works/:id", c.Asset.UpdateSubWork)
	p.DELETE("/sub-works/:id", c.Asset.DeleteSubWork)

	// Process & Model Projects
	p.GET("/process", c.Station.ListProcess)
	p.POST("/process", c.Station.CreateProcess)
	p.PUT("/process/:id", c.Station.UpdateProcess)
	p.DELETE("/process/:id", c.Station.DeleteProcess)
	p.GET("/model-projects", c.Station.ListModelProjects)
	p.POST("/model-projects", c.Station.CreateModelProject)
	p.PUT("/model-projects/:id", c.Station.UpdateModelProject)
	p.DELETE("/model-projects/:id", c.Station.DeleteModelProject)

	// V2 Assign & Tasks
	p.GET("/assigns/history", c.Assign.ListDeletedAssigns)
	p.GET("/assigns", c.Assign.ListAssigns)
	p.GET("/assigns/:id", c.Assign.GetAssign)
	p.GET("/allocations/:id/tasks", c.Assign.GetAssignWithTasks)
	p.POST("/assigns", c.Assign.CreateAssign)
	p.PUT("/assigns/:id", c.Assign.UpdateAssign)
	p.DELETE("/assigns/:id", c.Assign.DeleteAssign)
	p.POST("/assigns/:id/restore", c.Assign.RestoreAssign)
	p.DELETE("/assigns/:id/permanent", c.Assign.PermanentDeleteAssign)

	p.GET("/assigns/:id/details", c.Assign.ListDetailAssigns)
	p.POST("/assigns/:id/details", c.Assign.CreateDetailAssign)
	p.POST("/details/:id/upload-image", c.Assign.UploadDetailImage)
	p.PUT("/details/:id/note", c.Assign.SaveDetailNote)
	p.DELETE("/details/:id/image", c.Assign.DeleteDetailImage)
	p.DELETE("/details/:id/images", c.Assign.DeleteDetailImages)
	p.POST("/details/:id/submit", c.Assign.SubmitDetail)
	p.POST("/details/:id/approve", c.Assign.ApproveDetail)
	p.POST("/details/:id/reject", c.Assign.RejectDetail)
	p.PUT("/task-details/bulk/status", c.Assign.BulkUpdateDetailStatus)

	// Lark
	p.POST("/lark/push-report", c.Lark.PushReportLink)
	p.POST("/lark/push-allocation", c.Lark.PushAllocation)
}

func (c *Container) configureCORS() gin.HandlerFunc {
	corsConfig := cors.DefaultConfig()
	staticOrigins := []string{}
	if c.Config.CORS.AllowedOrigins != "" {
		for _, o := range strings.Split(c.Config.CORS.AllowedOrigins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				staticOrigins = append(staticOrigins, trimmed)
			}
		}
	}
	corsConfig.AllowOriginFunc = func(origin string) bool {
		for _, allowed := range staticOrigins {
			if allowed == origin {
				return true
			}
		}
		if c.Config.Server.AppEnv != "production" {
			if strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "https://localhost:") ||
				strings.HasPrefix(origin, "http://192.168.") ||
				strings.HasPrefix(origin, "https://192.168.") ||
				strings.HasSuffix(origin, ".loca.lt") {
				return true
			}
		}
		return false
	}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	corsConfig.AllowCredentials = true
	return cors.New(corsConfig)
}

func noCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}
