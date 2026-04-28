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
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"go.uber.org/zap"

	"github.com/phuc/cmms-backend/internal/config"
	"github.com/phuc/cmms-backend/internal/di"
	"github.com/phuc/cmms-backend/internal/platform/database"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"github.com/phuc/cmms-backend/internal/platform/migrations"

	// Swagger imports
	_ "github.com/phuc/cmms-backend/docs"
)

func main() {
	// 1. Initialize Logger
	logger.Initialize()
	log := logger.Get()

	// 2. Load Environment Variables (fallback to OS/Docker)
	if err := godotenv.Load(); err != nil {
		log.Info("No .env file found. Falling back to system environment variables (Docker).")
	}

	// 3. Load Typed Configuration
	cfg := config.Load()

	log.Info("Starting Solar O&M Backend API",
		zap.String("db_driver", cfg.Database.Driver),
		zap.String("version", "2.0"),
	)

	// 4. Initialize Database & Run Migrations
	database.Connect()
	db := database.DB

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("Failed to get underlying sql.DB", zap.Error(err))
	}
	if err := migrations.RunMigrations(sqlDB, "migrations"); err != nil {
		log.Fatal("Migration failed", zap.Error(err))
	}

	// 4.5 Reset all user statuses to OFFLINE (0) on server startup
	// Because if the server was killed aggressively, WebSocket disconnect events wouldn't fire.
	// Active clients will auto-reconnect within 5 seconds and set themselves back to ONLINE (1)
	if err := db.Exec("UPDATE users SET status_user = 0").Error; err != nil {
		log.Warn("Failed to reset user statuses on startup", zap.Error(err))
	} else {
		log.Info("Successfully reset all user statuses to offline globally")
	}

	// 5. Build Dependency Injection Container
	container := di.BuildContainer(cfg, db)

	// 6. Start Background Workers (RabbitMQ, Cron Jobs, Expiry Reminders)
	ctxBackground := context.Background()
	container.StartBackgroundWorkers(ctxBackground)
	defer container.StopBackgroundWorkers()

	// 7. Setup Gin Router
	r := container.SetupRouter()

	// 8. Start HTTP Server Gracefully
	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: r,
	}

	go func() {
		log.Info("Server listening", zap.String("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Listen error", zap.Error(err))
		}
	}()

	// 9. Await Shutdown Signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("Shutting down server...")

	ctxTimeout, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxTimeout); err != nil {
		log.Fatal("Server forced to shutdown", zap.Error(err))
	}

	log.Info("Server exiting gracefully")
}
