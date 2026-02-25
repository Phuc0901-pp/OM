// @title           Solar O&M API
// @version         1.0
// @description     Backend API for Solar O&M Management System
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
	infraJobs "github.com/phuc/cmms-backend/internal/infrastructure/jobs"
	infraRedis "github.com/phuc/cmms-backend/internal/infrastructure/redis"
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
	log := logger.Get() // Use zap logger

	// 1. Load Env
	if err := godotenv.Load(); err != nil {
		log.Warn("No .env file found, using system environment variables")
	}
	log.Info("Starting Solar O&M Backend API",
		zap.String("db_driver", os.Getenv("DB_DRIVER")),
		zap.String("version", "1.0"),
	)

	// 1. Initialize Database
	database.Connect()
    db := database.DB

    // Run Migrations
    sqlDB, err := db.DB()
    if err != nil {
        log.Fatal("Failed to get underlying sql.DB", zap.Error(err))
    }
    
    // Path to migrations folder (relative to working directory)
    if err := migrations.RunMigrations(sqlDB, "migrations"); err != nil {
        log.Fatal("Migration failed", zap.Error(err))
    }
    
    // db.AutoMigrate(&domain.PushSubscription{}) // Moved to SQL


	// 2. Dependency Injection
	// Auth Module
	userRepo := postgres.NewUserRepository(database.DB)
	authService := services.NewAuthService(userRepo)
	authHandler := handler.NewAuthHandler(authService)

	// User Module
	userService := services.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	// Role Module
	roleRepo := postgres.NewRoleRepository(database.DB)
	roleHandler := handler.NewRoleHandler(roleRepo)

	// Team Module
	teamRepo := postgres.NewTeamRepository(database.DB)
	teamHandler := handler.NewTeamHandler(teamRepo) // New Handler

	// Storage Module (MinIO)
	minioClient, err := storage.NewMinioClient()
	if err != nil {
		log.Warn("Failed to initialize MinIO", zap.Error(err))
	} else {
		log.Info("Connected to MinIO", zap.String("bucket", minioClient.Bucket))
	}

	// Project Module
	projectRepo := postgres.NewProjectRepository(database.DB)
	projectService := services.NewProjectService(projectRepo) // NEW: Service Injection
    allocationRepo := postgres.NewAllocationRepository(database.DB) // NEW
    statsRepo := postgres.NewStatsRepository(database.DB) // NEW
	projectHandler := handler.NewProjectHandler(projectService) // Updated: Inject Service

    // Assignment Module (MinIO Uploads)
    assignmentService := services.NewAssignmentService(allocationRepo, minioClient) // Updated: allocationRepo

    // Stats Module
    statsService := services.NewStatsService(projectRepo, allocationRepo, statsRepo, userRepo) // Updated
    statsHandler := handler.NewStatsHandler(statsService)

    // Notification Module
    // ── Phase 3: Redis infrastructure (nil-safe if REDIS_HOST not set) ──────
    redisClient := infraRedis.NewClient(context.Background())
    redisBroker := infraRedis.NewBroker(redisClient)
    jobQueue    := infraJobs.NewQueue(redisClient)
    jobWorker   := infraJobs.NewWorker(redisClient)

    wsHub := infraWS.NewHub()
    notificationService := services.NewNotificationService(database.DB, wsHub, redisBroker, jobQueue)
    notificationHandler := handler.NewNotificationHandler(database.DB)

    // ── Phase 5: Daily Reminder Cron ─────────────────────────────────────────
    reminderService := services.NewReminderService(database.DB, notificationService)
    reminderService.Start()
    defer reminderService.Stop()

    // Register job handlers on the worker
    jobWorker.Register(infraJobs.JobTypePush, func(jobCtx context.Context, job infraJobs.NotificationJob) error {
        notificationService.DispatchPushJob(jobCtx, job)
        return nil
    })
    workerCtx, workerCancel := context.WithCancel(context.Background())
    defer workerCancel()
    jobWorker.Start(workerCtx)

	// Attendance Module
	attendanceRepo := postgres.NewAttendanceRepository(database.DB)
	attendanceService := services.NewAttendanceService(attendanceRepo, minioClient, notificationService)
	attendanceHandler := handler.NewAttendanceHandler(attendanceService)

	// Station Module (moved before Allocation Handler since it's now a dependency)
	stationRepo := postgres.NewStationRepository(database.DB)
	stationHandler := handler.NewStationHandler(stationRepo, minioClient)

	// Allocation Handler (Aggregates multiple services/repos)
	allocationHandler := handler.NewAllocationHandler(
		projectRepo,
		allocationRepo, // NEW
		userRepo,
		stationRepo, // NEW: Pass station repo
		assignmentService,
		notificationService,
		database.DB,
		minioClient, // NEW
	)

    // Admin Handler (Database Inspector)
    adminHandler := handler.NewAdminHandler(database.DB)
    conceptHandler := handler.NewConceptHandler(database.DB)
    schemaHandler := handler.NewSchemaHandler(database.DB)
    monitoringHandler := handler.NewMonitoringHandler(database.DB, wsHub, redisClient, jobQueue)
    
    // Checklist Handler (New)
    checklistService := services.NewChecklistService(database.DB)
    checklistHandler := handler.NewChecklistHandler(checklistService)

	// NEW: Refactored Handlers for better separation of concerns
	evidenceHandler := handler.NewEvidenceHandler(database.DB, minioClient, notificationService)
	taskStatusHandler := handler.NewTaskStatusHandler(projectRepo, allocationRepo, notificationService, database.DB) // Updated
	historyHandler := handler.NewHistoryHandler(projectRepo, allocationRepo)

	// 3. Setup Gin Server
	r := gin.Default()
	r.Use(middleware.ErrorHandler())

	// Rate Limiting (Increased for media heavy usage)
	r.Use(middleware.RateLimitMiddleware(3000, 1*time.Minute))

	// CORS Configuration - Security: Read allowed origins from env
	config := cors.DefaultConfig()
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	// Security: Read allowed origins strictly from env or use safe defaults
	if allowedOrigins == "" {
		log.Warn("ALLOWED_ORIGINS not set in .env. Defaulting to strict localhost only.")
		allowedOrigins = "http://localhost:5173,http://localhost:4000"
	}
	staticOrigins := strings.Split(allowedOrigins, ",")

	// Dynamic origin checking for tunnels (Cloudflare / Ngrok)
	config.AllowOriginFunc = func(origin string) bool {
		// Allow all origins if wildcard
		if allowedOrigins == "*" {
			return true
		}
		// Allow static origins
		for _, o := range staticOrigins {
			if strings.TrimSpace(o) == origin {
				return true
			}
		}
		// Allow Cloudflare tunnel URLs
		if strings.HasSuffix(origin, ".trycloudflare.com") {
			log.Info("CORS: Allowing Cloudflare tunnel origin", zap.String("origin", origin))
			return true
		}
		// Allow Ngrok tunnel URLs
		if strings.HasSuffix(origin, ".ngrok-free.dev") ||
			strings.HasSuffix(origin, ".ngrok-free.app") ||
			strings.HasSuffix(origin, ".ngrok.io") {
			log.Info("CORS: Allowing Ngrok tunnel origin", zap.String("origin", origin))
			return true
		}
		return false
	}
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	config.AllowCredentials = true
	r.Use(cors.New(config))
	log.Info("CORS Configured", zap.Strings("static_origins", staticOrigins))

	// 4. Routes
	api := r.Group("/api")

    // --- PUBLIC ROUTES ---
    // Swagger Route
    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
    
    // Health Check
    r.GET("/", func(c *gin.Context) {
        c.String(http.StatusOK, "CMMS Backend is running (Gin Framework)!")
    })

    // Media Routes (Public for now to serve <img> tags)
    mediaHandler := handler.NewMediaHandler(minioClient)
    api.GET("/media/proxy", mediaHandler.ProxyImage)
    api.GET("/media/download-zip", mediaHandler.DownloadFolder)

    // Auth Routes (Login)
    api.POST("/auth/login", authHandler.Login)
    api.POST("/auth/logout", authHandler.Logout)

    // --- WEBSOCKET ROUTE (auth handled inside handler via token query param) ---
    wsHandler := infraWS.NewHandler(wsHub, authService)
    r.GET("/api/ws", func(c *gin.Context) {
        wsHandler.ServeWS(c.Writer, c.Request)
    })

    // --- PROTECTED ROUTES ---
    protected := api.Group("/")
    protected.Use(middleware.AuthMiddleware(authService))
    {
        // Media Routes (Secured)
        protected.GET("/media/library", mediaHandler.GetLibraryImages)

		// User Routes
		protected.GET("/users/my-team", userHandler.GetMyTeam) // New Endpoint
		protected.GET("/users", userHandler.GetAllUsers)
		protected.GET("/users/:id", userHandler.GetUserByID)
		protected.POST("/users", userHandler.CreateUser)
		protected.PUT("/users/:id", userHandler.UpdateUser) // General Update
		protected.PUT("/users/:id/leader", userHandler.AssignLeader) // Assign Leader
		protected.DELETE("/users/:id", userHandler.DeleteUser)
        
        // Notification Routes
        protected.POST("/monitoring/subscribe", notificationHandler.Subscribe)
        protected.GET("/monitoring/vapid-key", notificationHandler.GetVapidPublicKey)
        
        // Notification History (2026-02-08)
        protected.GET("/notifications", notificationHandler.GetNotifications)
        protected.PUT("/notifications/:id/read", notificationHandler.MarkRead)
        protected.PUT("/notifications/read-all", notificationHandler.MarkAllRead)
        protected.DELETE("/notifications/:id", notificationHandler.DeleteNotification)
		protected.DELETE("/notifications/delete-all", notificationHandler.DeleteAllNotifications)

		// Stats Routes
		protected.GET("/admin/stats", statsHandler.GetAdminStats)
        protected.GET("/admin/tables", adminHandler.GetAllTables)
        protected.GET("/admin/tables/:table", adminHandler.GetTableData)
        protected.POST("/admin/tables/:table", adminHandler.CreateRow)
        protected.PUT("/admin/tables/:table/:id", adminHandler.UpdateRow)
        protected.DELETE("/admin/tables/:table/:id", adminHandler.DeleteRow)
		protected.POST("/admin/tables/:table/bulk-delete", adminHandler.DeleteRows)
        // Phase 4: Notification Monitoring Metrics
        protected.GET("/admin/notification-metrics", monitoringHandler.GetNotificationMetrics)
        
        // User Statistics
        protected.GET("/user/stats", statsHandler.GetUserStats)

		// Concept Routes
		protected.GET("/admin/concepts", conceptHandler.GetAllConcepts)
		protected.GET("/admin/concepts/:id", conceptHandler.GetConcept)
		protected.POST("/admin/concepts", conceptHandler.CreateConcept)
		protected.PUT("/admin/concepts/:id", conceptHandler.UpdateConcept)
		protected.DELETE("/admin/concepts/:id", conceptHandler.DeleteConcept)

		// Schema Management Routes
		protected.POST("/admin/schema/:table/preview-add-column", schemaHandler.PreviewAddColumn)
		protected.POST("/admin/schema/:table/add-column", schemaHandler.AddColumn)

		protected.GET("/manager/stats", statsHandler.GetManagerStats)
        protected.GET("/manager/stats/detailed", statsHandler.GetDetailedStats)
        protected.GET("/manager/stats/timeline", statsHandler.GetTimeline)

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

		// Role Routes
		protected.GET("/roles", roleHandler.GetAllRoles)
		protected.POST("/roles", roleHandler.CreateRole)

		// Team Routes
		protected.GET("/teams", teamHandler.GetAllTeams)
		protected.POST("/teams", teamHandler.CreateTeam)

		// Project / Allocation Routes
		protected.GET("/projects", projectHandler.GetAllProjects)
		protected.GET("/projects/user/:id", projectHandler.GetUserProjects) // New Route
        protected.GET("/projects/:id", projectHandler.GetProjectByID) // New Route
		protected.POST("/projects", projectHandler.CreateProject) // New
        protected.PUT("/projects/:id", projectHandler.UpdateProject) // Update Project Info
		protected.GET("/project-classification", projectHandler.GetProjectClassifications)
		protected.GET("/main-categories", projectHandler.GetAllMainCategories)
		protected.GET("/main-categories/:id/children", projectHandler.GetChildCategories)
		protected.POST("/main-categories", projectHandler.CreateMainCategory)
		protected.POST("/child-categories", projectHandler.CreateChildCategory)
		protected.PUT("/child-categories/:id", projectHandler.UpdateChildCategory) // Update requires_inverter
		protected.GET("/projects/:id/characteristics", projectHandler.GetProjectCharacteristics)
		protected.PUT("/projects/:id/characteristics", projectHandler.UpdateProjectCharacteristics)
		protected.DELETE("/projects/:id", projectHandler.DeleteProject) // New
		protected.POST("/projects/:id/clone", projectHandler.CloneProject)   // Clone project with all config
		protected.DELETE("/main-categories/:id", projectHandler.DeleteMainCategory) // New
		protected.DELETE("/child-categories/:id", projectHandler.DeleteChildCategory) // New
        
		// Station Routes
		protected.GET("/stations", stationHandler.GetStations)
		protected.GET("/stations/user/:userId", stationHandler.GetStationsByUserID) // NEW: For Environment Page
		protected.GET("/stations/:id", stationHandler.GetStationByID)
		protected.POST("/stations", stationHandler.CreateStation)
		protected.PUT("/stations/:id", stationHandler.UpdateStation)
		protected.DELETE("/stations/:id", stationHandler.DeleteStation)
		protected.PUT("/stations/:id/config", stationHandler.SaveStationConfig) // Save child category list
		protected.PUT("/stations/:id/child-config", stationHandler.SaveChildConfig) // Save per-child config
		protected.POST("/stations/:id/upload-guide", stationHandler.UploadGuideFile) // Upload Guide Images
		protected.GET("/stations/:id/child-categories", projectHandler.GetChildCategoriesByStationID) // New Nested Route

        // Checklist Routes (Site Inverter Structure)
        protected.POST("/checklists", checklistHandler.SaveConfig)
        protected.GET("/checklists/:assign_id", checklistHandler.GetConfig)
        protected.GET("/projects/:id/checklists", checklistHandler.GetProjectChecklists)
        protected.DELETE("/checklists/:assign_id", checklistHandler.DeleteConfig)
        protected.DELETE("/projects/:id/checklist/:childId", checklistHandler.DeleteByProjectAndChild) // New

		// Allocation Routes
		protected.POST("/allocations", allocationHandler.CreateAllocation)
		protected.DELETE("/allocations/:id", allocationHandler.DeleteAllocation) // New
		protected.DELETE("/allocations/:id/permanent", allocationHandler.HardDeleteAllocation) // Permanent Delete
		protected.GET("/allocations/check/:projectId", allocationHandler.CheckAllocation)
		protected.GET("/allocations", allocationHandler.GetAllAllocations)
		protected.GET("/allocations/user/:id", allocationHandler.GetUserAllocations)
		protected.PUT("/allocations/:id/progress", allocationHandler.UpdateProgress)
		protected.POST("/allocations/:id/sync", allocationHandler.SyncProgress)
		protected.POST("/allocations/sync-all", allocationHandler.SyncAllProgress) // New Sync All Route
		protected.PUT("/task-details/:id/status", taskStatusHandler.UpdateTaskStatus)
		protected.PUT("/task-details/bulk/status", taskStatusHandler.BulkUpdateTaskStatus)
		protected.GET("/allocations/:id/tasks", taskStatusHandler.GetAssignmentTasks)
		protected.GET("/allocations/lookup", taskStatusHandler.LookupAssignment)
        
        // Monitoring Routes (Task Evidence) - Using EvidenceHandler
        protected.POST("/monitoring/submit", evidenceHandler.SubmitTaskEvidence)
        protected.POST("/monitoring/reset", evidenceHandler.ResetTaskSubmission)
        protected.POST("/monitoring/sync-images", evidenceHandler.SyncAllTaskImages)
        protected.POST("/monitoring/sync-notes", evidenceHandler.SyncAllTaskNotes)
        protected.POST("/monitoring/fix-image-urls", evidenceHandler.FixLegacyImageURLs)
        protected.GET("/monitoring/evidence/:id", evidenceHandler.GetTaskEvidence)
        protected.DELETE("/monitoring/evidence", evidenceHandler.DeleteTaskEvidence)
        protected.PUT("/monitoring/note", evidenceHandler.UpdateTaskNote)
        protected.GET("/monitoring/note/:id", evidenceHandler.GetTaskNote)
    
		
		// History Endpoint - Using HistoryHandler
		protected.GET("/allocations/history", historyHandler.GetHistory)
		protected.POST("/allocations/:id/restore", historyHandler.RestoreAllocation) // New Restore Route

        // Manager Report Endpoint - Using TaskStatusHandler
		protected.GET("/manager/completed-tasks", taskStatusHandler.GetCompletedTasks)
		protected.GET("/manager/personnel", userHandler.GetMyTeam) // Added for Manager Personnel Tab
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

	// Initializing the server in a goroutine so that
	// it won't block the graceful shutdown handling below
	go func() {
		log.Info("Server listening", zap.String("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Listen: %s\n", zap.Error(err))
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with
	// a timeout of 5 seconds.
	quit := make(chan os.Signal, 1)
	// kill (no param) default send syscall.SIGTERM
	// kill -2 is syscall.SIGINT
	// kill -9 is syscall.SIGKILL but can't be caught, so don't need to add it
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown", zap.Error(err))
	}

	log.Info("Server exiting")
}
