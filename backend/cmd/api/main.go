// @title           Solar O&M API
// @version         2.0
// @description     Backend API for Solar O&M Management System (V2 Schema)
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:4000
// @BasePath  /api

package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	handler "github.com/phuc/cmms-backend/internal/adapters/http/handlers"
	"github.com/phuc/cmms-backend/internal/adapters/http/middleware"
	"github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	infraWS "github.com/phuc/cmms-backend/internal/infrastructure/websocket"
	"github.com/phuc/cmms-backend/internal/platform/database"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"github.com/phuc/cmms-backend/internal/platform/migrations"
	"go.uber.org/zap"

	// Swagger imports
	_ "github.com/phuc/cmms-backend/docs"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// 0. Initialize Logger
	logger.Initialize()
	log := logger.Get()

	// 1. Load Env (Optional in Docker)
	if err := godotenv.Load(); err != nil {
		log.Info("No .env file found. Falling back to system environment variables (Docker).")
	}

	driver := os.Getenv("DB_DRIVER")
	if driver == "" {
		driver = "postgres"
	}

	log.Info("Starting Solar O&M Backend API",
		zap.String("db_driver", driver),
		zap.String("version", "2.0"),
	)

	// 1. Initialize Database
	database.Connect()
	db := database.DB

	// Run Migrations
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("Failed to get underlying sql.DB", zap.Error(err))
	}
	if err := migrations.RunMigrations(sqlDB, "migrations"); err != nil {
		log.Fatal("Migration failed", zap.Error(err))
	}

	// 2. Dependency Injection

	// ── Auth Module ──────────────────────────────────────────────────────────
	userRepo := postgres.NewUserRepository(db)
	authService := services.NewAuthService(userRepo)
	authHandler := handler.NewAuthHandler(authService)

	// ── User Module ───────────────────────────────────────────────────────────
	userService := services.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	// ── Role Module ───────────────────────────────────────────────────────────
	roleRepo := postgres.NewRoleRepository(db)
	roleHandler := handler.NewRoleHandler(roleRepo)

	// ── Team Module ───────────────────────────────────────────────────────────
	teamRepo := postgres.NewTeamRepository(db)
	teamHandler := handler.NewTeamHandler(teamRepo)

	// ── Storage Module (MinIO) ────────────────────────────────────────────────
	minioClient, err := storage.NewMinioClient()
	if err != nil {
		log.Warn("Failed to initialize MinIO", zap.Error(err))
	} else {
		log.Info("Connected to MinIO", zap.String("bucket", minioClient.Bucket))
	}

	// ── Project / Owner Module ────────────────────────────────────────────────
	ownerRepo := postgres.NewOwnerRepository(db)
	projectRepo := postgres.NewProjectRepository(db)
	projectService := services.NewProjectService(projectRepo, ownerRepo)
	projectHandler := handler.NewProjectHandlerV2(db, projectRepo, ownerRepo)
	_ = projectService // used by handlers internally

	// ── Asset / Work / SubWork Module ──────────────────────────────────────────
	assetRepo := postgres.NewAssetRepository(db)
	workRepo := postgres.NewWorkRepository(db)
	subWorkRepo := postgres.NewSubWorkRepository(db)
	assetHandler := handler.NewAssetHandler(assetRepo, workRepo, subWorkRepo)

	// ── Assign / DetailAssign / Config Module ─────────────────────────────────
	configRepo := postgres.NewConfigRepository(db)
	templateRepo := postgres.NewTemplateRepository(db)
	assignRepo := postgres.NewAssignRepository(db)
	detailAssignRepo := postgres.NewDetailAssignRepository(db)
	configHandler := handler.NewConfigHandler(configRepo)
	templateHandler := handler.NewTemplateHandler(templateRepo)

	// ── Notification + WebSocket Module (must be before assignHandler) ─────────
	wsHub := infraWS.NewHub()
	notificationService := services.NewNotificationService(db, wsHub)
	notificationHandler := handler.NewNotificationHandler(db, notificationService)

	assignHandler := handler.NewAssignHandler(db, assignRepo, detailAssignRepo, configRepo, assetRepo, workRepo, subWorkRepo, templateRepo, wsHub, notificationService)
	_ = services.NewAssignmentService(assignRepo, detailAssignRepo)

	// u2500u2500 Stats Module u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500
	statsRepo := postgres.NewStatsRepository(db)
	statsService := services.NewStatsService(statsRepo)
	statsHandler := handler.NewStatsHandler(statsService)

	// u2500u2500 Station/Process/Leader/ModelProject Module u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500
	stationHandler := handler.NewStationHandler(db)

	// u2500u2500 Reminder Service u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500
	reminderService := services.NewReminderService(db, notificationService)
	reminderService.Start()
	defer reminderService.Stop()

	// u2500u2500 Attendance Module u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500
	attendanceRepo := postgres.NewAttendanceRepository(db)
	attendanceService := services.NewAttendanceService(attendanceRepo, minioClient, notificationService)
	attendanceHandler := handler.NewAttendanceHandler(attendanceService, statsHandler)

	// u2500u2500 Admin Module
	adminHandler := handler.NewAdminHandler(db)

	// ── Evidence Module ───────────────────────────────────────────────────────
	evidenceService := services.NewEvidenceService(db, minioClient, notificationService)

	// ── Media Module ──────────────────────────────────────────────────────────
	mediaHandler := handler.NewMediaHandler(minioClient)
	uploadHandler := handler.NewUploadHandler(minioClient)

	// ── Monitoring Metrics ────────────────────────────────────────────────────
	// monitoringHandler removed (old schema) - can be re-added when needed
	_ = evidenceService

	// 3. Setup Gin Server
	// Set Gin mode: release in production, debug in development
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
		log.Info("Gin running in RELEASE mode")
	} else {
		log.Info("Gin running in DEBUG mode (set APP_ENV=production to enable release mode)")
	}

	r := gin.Default()
	r.Use(middleware.ErrorHandler())
	r.Use(middleware.RateLimitMiddleware(3000, 1*time.Minute))

	// CORS Configuration
	// ALLOWED_ORIGINS must be set explicitly in .env (comma-separated).
	// Wildcard (*) is NOT accepted in production for security reasons.
	corsConfig := cors.DefaultConfig()
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		log.Warn("ALLOWED_ORIGINS not set — all cross-origin requests will be BLOCKED. Set ALLOWED_ORIGINS in .env.")
	}
	staticOrigins := []string{}
	if allowedOrigins != "" {
		for _, o := range strings.Split(allowedOrigins, ",") {
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
		// Allow localhost in non-production environments
		if appEnv != "production" && strings.HasPrefix(origin, "http://localhost:") {
			return true
		}
		return false
	}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	corsConfig.AllowCredentials = true
	r.Use(cors.New(corsConfig))
	log.Info("CORS Configured", zap.Strings("allowed_origins", staticOrigins))

	// 4. Routes
	api := r.Group("/api")

	// --- PUBLIC ROUTES ---
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "CMMS Backend V2 is running!")
	})

	// Media Routes (Public for img tags)
	api.GET("/media/proxy", mediaHandler.ProxyImage)
	api.GET("/media/download-zip", mediaHandler.DownloadFolder)

	// Auth Routes
	api.POST("/auth/login", middleware.RateLimitMiddleware(5, 1*time.Minute), authHandler.Login)
	api.POST("/auth/logout", authHandler.Logout)

	// WebSocket Route
	wsHandler := infraWS.NewHandler(wsHub, authService)
	r.GET("/api/ws", func(c *gin.Context) {
		wsHandler.ServeWS(c.Writer, c.Request)
	})

	// --- PROTECTED ROUTES ---
	protected := api.Group("/")
	protected.Use(middleware.AuthMiddleware(authService))
	protected.Use(middleware.MaintenanceGuard())
	{
		// Media
		protected.GET("/media/library", mediaHandler.GetLibraryImages)
		protected.POST("/upload/guideline", uploadHandler.UploadGuideline)

		// User Routes
		protected.GET("/users", userHandler.GetAllUsers)
		protected.GET("/users/:id", userHandler.GetUserByID)
		protected.POST("/users", userHandler.CreateUser)
		protected.PUT("/users/:id", userHandler.UpdateUser)
		protected.PUT("/users/:id/password", userHandler.ChangePassword)
		protected.DELETE("/users/:id", userHandler.DeleteUser)
		// User Trash Routes
		protected.GET("/users/history", userHandler.ListDeletedUsers)
		protected.POST("/users/bulk-restore", userHandler.BulkRestoreUsers)
		protected.DELETE("/users/bulk-permanent", userHandler.BulkPermanentDeleteUsers)
		protected.POST("/users/:id/restore", userHandler.RestoreUser)
		protected.DELETE("/users/:id/permanent", userHandler.PermanentDeleteUser)

		// Role Routes
		protected.GET("/roles", roleHandler.GetAllRoles)
		protected.POST("/roles", roleHandler.CreateRole)

		// Team Routes
		protected.GET("/teams", teamHandler.GetAllTeams)
		protected.POST("/teams", teamHandler.CreateTeam)

		// Template Routes
		protected.GET("/templates", templateHandler.GetAllTemplates)
		protected.GET("/templates/:id", templateHandler.GetTemplateByID)
		protected.POST("/templates", templateHandler.CreateTemplate)
		protected.PUT("/templates/:id", templateHandler.UpdateTemplate)
		protected.DELETE("/templates/:id", templateHandler.DeleteTemplate)

		// Notification Routes
		protected.POST("/monitoring/subscribe", notificationHandler.Subscribe)
		protected.GET("/monitoring/vapid-key", notificationHandler.GetVapidPublicKey)
		protected.GET("/notifications", notificationHandler.GetNotifications)
		protected.PUT("/notifications/:id/read", notificationHandler.MarkRead)
		protected.PUT("/notifications/read-all", notificationHandler.MarkAllRead)
		protected.DELETE("/notifications/:id", notificationHandler.DeleteNotification)
		protected.DELETE("/notifications/delete-all", notificationHandler.DeleteAllNotifications)

		// Stats Routes
		protected.GET("/admin/stats", statsHandler.GetAdminStats)
		protected.GET("/manager/stats", statsHandler.GetManagerStats)
		protected.GET("/user/stats", statsHandler.GetUserStats)

		// Maintenance Mode Routes
		protected.GET("/admin/maintenance", notificationHandler.GetMaintenanceStatus)
		protected.POST("/admin/maintenance", notificationHandler.ToggleMaintenance)

		// Admin Table Inspector
		protected.GET("/admin/tables", adminHandler.GetAllTables)
		protected.GET("/admin/tables/:table", adminHandler.GetTableData)
		protected.POST("/admin/tables/:table", adminHandler.CreateRow)
		protected.PUT("/admin/tables/:table/:id", adminHandler.UpdateRow)
		protected.DELETE("/admin/tables/:table/:id", adminHandler.DeleteRow)
		protected.POST("/admin/tables/:table/bulk-delete", adminHandler.DeleteRows)

		// Attendance Routes
		protected.POST("/attendance/checkin-with-photos", attendanceHandler.CheckInWithPhotos)
		protected.POST("/attendance/checkin", attendanceHandler.CheckIn)
		protected.POST("/attendance/checkout", attendanceHandler.CheckOut)
		protected.POST("/attendance/request-checkout", attendanceHandler.RequestCheckout)
		protected.POST("/attendance/approve-checkout/:id", attendanceHandler.ApproveCheckout)
		protected.POST("/attendance/reject-checkout/:id", attendanceHandler.RejectCheckout)
		protected.GET("/attendance/pending-checkouts", attendanceHandler.GetPendingCheckouts)
		protected.GET("/attendance/today/:user_id", attendanceHandler.GetTodayAttendance)
		protected.GET("/attendance/history/:user_id", attendanceHandler.GetUserHistory)
		protected.GET("/attendance/today/all", attendanceHandler.GetAllTodayAttendances)
		protected.GET("/attendance/history/all", attendanceHandler.GetAllHistory)
		protected.GET("/attendance/onsite", attendanceHandler.GetUsersOnSite)
		protected.GET("/attendance/detail/:id", attendanceHandler.GetDetail)
		protected.GET("/attendance/lookup", attendanceHandler.Lookup)

		// ── V2: Owner Routes ─────────────────────────────────────────────────
		protected.GET("/owners", projectHandler.ListOwners)
		protected.POST("/owners", projectHandler.CreateOwner)
		protected.DELETE("/owners/:id", projectHandler.DeleteOwner)

		// ── V2: Project Routes ────────────────────────────────────────────────
		// Specific routes must be registered BEFORE param routes (:id)
		protected.GET("/projects/history", projectHandler.ListDeletedProjects)
		protected.POST("/projects/bulk-restore", projectHandler.BulkRestoreProjects)
		protected.DELETE("/projects/bulk-permanent", projectHandler.BulkPermanentDeleteProjects)
		protected.GET("/projects", projectHandler.ListProjects)
		protected.GET("/projects/:id", projectHandler.GetProject)
		protected.POST("/projects", projectHandler.CreateProject)
		protected.PUT("/projects/:id", projectHandler.UpdateProject)
		protected.DELETE("/projects/:id", projectHandler.DeleteProject)
		protected.POST("/projects/:id/restore", projectHandler.RestoreProject)
		protected.DELETE("/projects/:id/permanent", projectHandler.PermanentDeleteProject)

		// ── V2: Asset Routes ──────────────────────────────────────────────────
		protected.GET("/assets/history", assetHandler.ListDeletedAssets)
		protected.POST("/assets/bulk-restore", assetHandler.BulkRestoreAssets)
		protected.DELETE("/assets/bulk-permanent", assetHandler.BulkPermanentDeleteAssets)
		protected.POST("/assets/:id/restore", assetHandler.RestoreAsset)
		protected.DELETE("/assets/:id/permanent", assetHandler.PermanentDeleteAsset)

		protected.GET("/assets", assetHandler.ListAssets)
		protected.GET("/assets/:id", assetHandler.GetAsset)
		protected.POST("/assets", assetHandler.CreateAsset)
		protected.PUT("/assets/:id", assetHandler.UpdateAsset)
		protected.DELETE("/assets/:id", assetHandler.DeleteAsset)

		// ── V2: Work Routes ────────────────────────────────────────────────────
		protected.GET("/works/history", assetHandler.ListDeletedWorks)
		protected.POST("/works/bulk-restore", assetHandler.BulkRestoreWorks)
		protected.DELETE("/works/bulk-permanent", assetHandler.BulkPermanentDeleteWorks)
		protected.POST("/works/:id/restore", assetHandler.RestoreWork)
		protected.DELETE("/works/:id/permanent", assetHandler.PermanentDeleteWork)

		protected.GET("/works", assetHandler.ListWorks)
		protected.GET("/works/:id", assetHandler.GetWork)
		protected.POST("/works", assetHandler.CreateWork)
		protected.PUT("/works/:id", assetHandler.UpdateWork)
		protected.DELETE("/works/:id", assetHandler.DeleteWork)

		// ── V2: SubWork Routes ─────────────────────────────────────────────────
		protected.GET("/sub-works/history", assetHandler.ListDeletedSubWorks)
		protected.POST("/sub-works/bulk-restore", assetHandler.BulkRestoreSubWorks)
		protected.DELETE("/sub-works/bulk-permanent", assetHandler.BulkPermanentDeleteSubWorks)
		protected.POST("/sub-works/:id/restore", assetHandler.RestoreSubWork)
		protected.DELETE("/sub-works/:id/permanent", assetHandler.PermanentDeleteSubWork)

		protected.GET("/sub-works", assetHandler.ListSubWorks)
		protected.GET("/sub-works/:id", assetHandler.GetSubWork)
		protected.POST("/sub-works", assetHandler.CreateSubWork)
		protected.PUT("/sub-works/:id", assetHandler.UpdateSubWork)
		protected.DELETE("/sub-works/:id", assetHandler.DeleteSubWork)

		// ── V2: Config Routes ──────────────────────────────────────────────────
		protected.GET("/configs", configHandler.ListConfigs)
		protected.GET("/configs/:id", configHandler.GetConfig)
		protected.POST("/configs", configHandler.CreateConfig)
		protected.PUT("/configs/:id", configHandler.UpdateConfig)
		protected.DELETE("/configs/:id", configHandler.DeleteConfig)

		// ── V2: Process Routes ─────────────────────────────────────────────────
		protected.GET("/process", stationHandler.ListProcess)
		protected.POST("/process", stationHandler.CreateProcess)
		protected.PUT("/process/:id", stationHandler.UpdateProcess)
		protected.DELETE("/process/:id", stationHandler.DeleteProcess)

		// ── V2: ModelProject Routes ────────────────────────────────────────────
		protected.GET("/model-projects", stationHandler.ListModelProjects)
		protected.POST("/model-projects", stationHandler.CreateModelProject)
		protected.PUT("/model-projects/:id", stationHandler.UpdateModelProject)
		protected.DELETE("/model-projects/:id", stationHandler.DeleteModelProject)

		// ── V2: Assign Routes ─────────────────────────────────────────────────
		protected.GET("/assigns/history", assignHandler.ListDeletedAssigns)
		protected.GET("/assigns", assignHandler.ListAssigns)
		protected.GET("/assigns/:id", assignHandler.GetAssign)
		protected.GET("/allocations/:id/tasks", assignHandler.GetAssignWithTasks) // For notification detail modal
		protected.POST("/assigns", assignHandler.CreateAssign)
		protected.PUT("/assigns/:id", assignHandler.UpdateAssign)
		protected.DELETE("/assigns/:id", assignHandler.DeleteAssign)
		protected.POST("/assigns/:id/restore", assignHandler.RestoreAssign)
		protected.DELETE("/assigns/:id/permanent", assignHandler.PermanentDeleteAssign)

		// ── V2: DetailAssign Routes ────────────────────────────────────────────		// Detail Assign endpoints
		protected.GET("/assigns/:id/details", assignHandler.ListDetailAssigns)
		protected.POST("/assigns/:id/details", assignHandler.CreateDetailAssign)
		protected.POST("/details/:id/upload-image", assignHandler.UploadDetailImage)
		protected.PUT("/details/:id/note", assignHandler.SaveDetailNote)
		protected.DELETE("/details/:id/image", assignHandler.DeleteDetailImage)
		protected.POST("/details/:id/submit", assignHandler.SubmitDetail)
		protected.POST("/details/:id/approve", assignHandler.ApproveDetail)
		protected.POST("/details/:id/reject", assignHandler.RejectDetail)
		
		// Bulk Detail Status Update (Approve/Reject multi)
		protected.PUT("/task-details/bulk/status", assignHandler.BulkUpdateDetailStatus)
	}

	// 5. Start Server with Graceful Shutdown
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	go func() {
		log.Info("Server listening", zap.String("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Listen error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown", zap.Error(err))
	}

	log.Info("Server exiting")
}
