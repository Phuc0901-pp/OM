// @title           Solar O&M API
// @version         1.0
// @description     Backend API for Solar O&M Management System
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:3000
// @BasePath  /api

package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	handler "github.com/phuc/cmms-backend/internal/adapters/http/handlers"
	"github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"github.com/phuc/cmms-backend/internal/platform/database"
    "github.com/phuc/cmms-backend/internal/platform/migrations"
    
    // Swagger imports
    _ "github.com/phuc/cmms-backend/docs"
    swaggerFiles "github.com/swaggo/files"
    ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// 0. Load Env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
    log.Println("DEBUG ENV: DB_DRIVER =", os.Getenv("DB_DRIVER"))

	// 1. Initialize Database
	database.Connect()
    db := database.DB

    // Run Migrations
    migrations.RunManualMigrations(db)

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
        log.Printf("Warning: Failed to initialize MinIO: %v", err)
    } else {
        log.Printf("Success: Connected to MinIO (Bucket: %s)", minioClient.Bucket)
    }

	// Project Module
	projectRepo := postgres.NewProjectRepository(database.DB)
	projectHandler := handler.NewProjectHandlerWithDB(projectRepo, database.DB) // Uses DB for auto column creation

	// Work Order Module
	workOrderRepo := postgres.NewWorkOrderRepository(database.DB)
	services.NewWorkOrderService(workOrderRepo)
	// workOrderHandler := handler.NewWorkOrderHandler(workOrderService)

    // Assignment Module (MinIO Uploads)
    assignmentService := services.NewAssignmentService(projectRepo, minioClient)

    // Stats Module
    statsService := services.NewStatsService(projectRepo, userRepo)
    statsHandler := handler.NewStatsHandler(statsService)

	// Attendance Module
	attendanceRepo := postgres.NewAttendanceRepository(database.DB)
	attendanceService := services.NewAttendanceService(attendanceRepo, minioClient)
	attendanceHandler := handler.NewAttendanceHandler(attendanceService)

    // Notification Module
    notificationService := services.NewNotificationService()

	// Station Module (moved before Allocation Handler since it's now a dependency)
	stationRepo := postgres.NewStationRepository(database.DB)
	stationHandler := handler.NewStationHandler(stationRepo, minioClient)

	// Allocation Handler (Aggregates multiple services/repos)
	allocationHandler := handler.NewAllocationHandler(
		projectRepo,
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
    
    // Checklist Handler (New)
    checklistService := services.NewChecklistService(database.DB)
    checklistHandler := handler.NewChecklistHandler(checklistService)

	// 3. Setup Gin Server
	r := gin.Default()

	// CORS Configuration
	config := cors.DefaultConfig()
    config.AllowAllOrigins = true
    config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
    config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
    r.Use(cors.New(config))

	// 4. Routes
	api := r.Group("/api")
    // Swagger Route
    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	{
		// Health Check
		r.GET("/", func(c *gin.Context) {
			c.String(http.StatusOK, "CMMS Backend is running (Gin Framework)!")
		})

		// User Routes
		api.GET("/users/my-team", userHandler.GetMyTeam) // New Endpoint
		api.GET("/users", userHandler.GetAllUsers)
		api.GET("/users/:id", userHandler.GetUserByID)
		api.POST("/users", userHandler.CreateUser)
		api.PUT("/users/:id", userHandler.UpdateUser) // General Update
		api.PUT("/users/:id/leader", userHandler.AssignLeader) // Assign Leader
		api.DELETE("/users/:id", userHandler.DeleteUser)

		// Stats Routes
		api.GET("/admin/stats", statsHandler.GetAdminStats)
        api.GET("/admin/tables", adminHandler.GetAllTables) // List all tables
        api.GET("/admin/tables/:table", adminHandler.GetTableData)
        api.POST("/admin/tables/:table", adminHandler.CreateRow)
        api.PUT("/admin/tables/:table/:id", adminHandler.UpdateRow)
        api.DELETE("/admin/tables/:table/:id", adminHandler.DeleteRow)
		api.POST("/admin/tables/:table/bulk-delete", adminHandler.DeleteRows)

		// Concept Routes
		api.GET("/admin/concepts", conceptHandler.GetAllConcepts)
		api.GET("/admin/concepts/:id", conceptHandler.GetConcept)
		api.POST("/admin/concepts", conceptHandler.CreateConcept)
		api.PUT("/admin/concepts/:id", conceptHandler.UpdateConcept)
		api.DELETE("/admin/concepts/:id", conceptHandler.DeleteConcept)

		// Schema Management Routes
		api.POST("/admin/schema/:table/preview-add-column", schemaHandler.PreviewAddColumn)
		api.POST("/admin/schema/:table/add-column", schemaHandler.AddColumn)

		api.GET("/manager/stats", statsHandler.GetManagerStats)
        api.GET("/manager/stats/detailed", statsHandler.GetDetailedStats)
        api.GET("/manager/stats/timeline", statsHandler.GetTimeline)

		// Attendance Routes
		api.POST("/attendance/checkin-with-photos", attendanceHandler.CheckInWithPhotos)
		api.POST("/attendance/checkin", attendanceHandler.CheckIn)
		api.POST("/attendance/checkout", attendanceHandler.CheckOut)
		api.POST("/attendance/request-checkout", attendanceHandler.RequestCheckout)
		api.POST("/attendance/approve-checkout/:id", attendanceHandler.ApproveCheckout)
		api.POST("/attendance/reject-checkout/:id", attendanceHandler.RejectCheckout)
		api.GET("/attendance/pending-checkouts", attendanceHandler.GetPendingCheckouts)
		api.GET("/attendance/today/:user_id", attendanceHandler.GetTodayAttendance)
		api.GET("/attendance/history/:user_id", attendanceHandler.GetUserHistory)
		api.GET("/attendance/today/all", attendanceHandler.GetAllTodayAttendances)
		api.GET("/attendance/history/all", attendanceHandler.GetAllHistory)
		api.GET("/attendance/onsite", attendanceHandler.GetUsersOnSite)

		// Role Routes
		api.GET("/roles", roleHandler.GetAllRoles)
		api.POST("/roles", roleHandler.CreateRole)

		// Team Routes
		api.GET("/teams", teamHandler.GetAllTeams)
		api.POST("/teams", teamHandler.CreateTeam)

		// Project / Allocation Routes
		api.GET("/projects", projectHandler.GetAllProjects)
        api.GET("/projects/:id", projectHandler.GetProjectByID) // New Route
		api.POST("/projects", projectHandler.CreateProject) // New
        api.PUT("/projects/:id", projectHandler.UpdateProject) // Update Project Info
		api.GET("/project-classification", projectHandler.GetProjectClassifications)
		api.GET("/main-categories", projectHandler.GetAllMainCategories)
		api.GET("/main-categories/:id/children", projectHandler.GetChildCategories)
		api.POST("/main-categories", projectHandler.CreateMainCategory)
		api.POST("/child-categories", projectHandler.CreateChildCategory)
		api.PUT("/child-categories/:id", projectHandler.UpdateChildCategory) // Update requires_inverter
		api.GET("/projects/:id/characteristics", projectHandler.GetProjectCharacteristics)
		api.PUT("/projects/:id/characteristics", projectHandler.UpdateProjectCharacteristics)
		api.DELETE("/projects/:id", projectHandler.DeleteProject) // New
		api.DELETE("/main-categories/:id", projectHandler.DeleteMainCategory) // New
		api.DELETE("/child-categories/:id", projectHandler.DeleteChildCategory) // New
        
		// Station Routes
		api.GET("/stations", stationHandler.GetStations)
		api.GET("/stations/user/:userId", stationHandler.GetStationsByUserID) // NEW: For Environment Page
		api.GET("/stations/:id", stationHandler.GetStationByID)
		api.POST("/stations", stationHandler.CreateStation)
		api.PUT("/stations/:id", stationHandler.UpdateStation)
		api.DELETE("/stations/:id", stationHandler.DeleteStation)
		api.PUT("/stations/:id/config", stationHandler.SaveStationConfig) // Save child category list
		api.PUT("/stations/:id/child-config", stationHandler.SaveChildConfig) // Save per-child config
		api.POST("/stations/:id/upload-guide", stationHandler.UploadGuideFile) // Upload Guide Images
		api.GET("/stations/:id/child-categories", projectHandler.GetChildCategoriesByStationID) // New Nested Route

        // Checklist Routes (Site Inverter Structure)
        api.POST("/checklists", checklistHandler.SaveConfig)
        api.GET("/checklists/:assign_id", checklistHandler.GetConfig)
        api.GET("/projects/:id/checklists", checklistHandler.GetProjectChecklists)
        api.DELETE("/checklists/:assign_id", checklistHandler.DeleteConfig)
        api.DELETE("/projects/:id/checklist/:childId", checklistHandler.DeleteByProjectAndChild) // New

		// Allocation Routes
		api.POST("/allocations", allocationHandler.CreateAllocation)
		api.DELETE("/allocations/:id", allocationHandler.DeleteAllocation) // New
		api.DELETE("/allocations/:id/permanent", allocationHandler.HardDeleteAllocation) // Permanent Delete
		api.GET("/allocations/check/:projectId", allocationHandler.CheckAllocation)
		api.GET("/allocations", allocationHandler.GetAllAllocations)
		api.GET("/allocations/user/:id", allocationHandler.GetUserAllocations)
		api.PUT("/allocations/:id/progress", allocationHandler.UpdateProgress)
		api.POST("/allocations/:id/sync", allocationHandler.SyncProgress)
		api.POST("/allocations/sync-all", allocationHandler.SyncAllProgress) // New Sync All Route
		api.PUT("/task-details/:id/status", allocationHandler.UpdateTaskStatus) // New Route
		api.PUT("/task-details/bulk/status", allocationHandler.BulkUpdateTaskStatus) // New Bulk Route
        
        // Monitoring Route (Task Submission)
        api.POST("/monitoring/submit", allocationHandler.SubmitTaskEvidence)
        api.POST("/monitoring/reset", allocationHandler.ResetTaskSubmission) // NEW RESET ROUTE
        api.GET("/monitoring/evidence/:id", allocationHandler.GetTaskEvidence) // NEW EVIDENCE ROUTE
        api.DELETE("/monitoring/evidence", allocationHandler.DeleteTaskEvidence) // NEW DELETE ROUTE
        api.PUT("/monitoring/note", allocationHandler.UpdateTaskNote) // NEW NOTE UPDATE ROUTE
        api.GET("/monitoring/note/:id", allocationHandler.GetTaskNote) // NEW NOTE GET ROUTE
		
		// History Endpoint
		api.GET("/allocations/history", allocationHandler.GetHistory)

        // Manager Report Endpoint (Completed Tasks)
		api.GET("/manager/completed-tasks", allocationHandler.GetCompletedTasks)
		api.GET("/manager/personnel", userHandler.GetMyTeam) // Added for Manager Personnel Tab

		// Auth Routes (Login)
		api.POST("/auth/login", authHandler.Login)
        api.POST("/auth/logout", authHandler.Logout)

		// Work Order Routes (Placeholder if needed)
		// api.GET("/work-orders", workOrderHandler.GetAll)
	}

	// Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	r.Run(":" + port)
}
