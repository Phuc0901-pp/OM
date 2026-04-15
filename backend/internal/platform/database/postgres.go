package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	var db *gorm.DB
	var err error

	driver := os.Getenv("DB_DRIVER")
	if driver == "" {
		driver = "sqlite" // Default to sqlite for local dev/testing
	}

	if driver == "sqlite" {
		log.Println("Using SQLite Database for Testing/Dev...")
		// Ensure data directory exists
		if err := os.MkdirAll("data", 0755); err != nil {
			log.Fatal("Failed to create data directory:", err)
		}
		dbPath := filepath.Join("data", "cmms.db")
		db, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	} else {
		log.Println("Using PostgreSQL Database...")
		dsn := fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Ho_Chi_Minh",
			os.Getenv("DB_HOST"),
			os.Getenv("DB_USER"),
			os.Getenv("DB_PASSWORD"),
			os.Getenv("DB_NAME"),
			os.Getenv("DB_PORT"),
		)
		maxRetries := 15
		for attempt := 1; attempt <= maxRetries; attempt++ {
			db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
			if err == nil {
				break
			}
			log.Printf("Failed to connect to database (attempt %d/%d): %v. Retrying in 4s...", attempt, maxRetries, err)
			time.Sleep(4 * time.Second)
		}
	}

	if err != nil {
		log.Fatal("Could not connect to database after maximum retries: ", err)
	}

	DB = db
	log.Println("Database connected successfully")

	log.Println("Database connected successfully")
	// Migration moved to main.go to allow better control
}
