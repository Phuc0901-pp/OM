package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// 1. Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	// 2. Connect to Database (Lightweight version of database.Connect)
	dsn := fmtStr()
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 3. Reset Data
	log.Println("Deleting all records from 'attendances' table...")
	if err := db.Exec("DELETE FROM attendances").Error; err != nil {
		log.Fatalf("Failed to delete attendances: %v", err)
	}

	log.Println("Successfully reset attendance data!")
}

func fmtStr() string {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	port := os.Getenv("DB_PORT")
	sslmode := os.Getenv("DB_SSLMODE")
	timezone := os.Getenv("DB_TIMEZONE")
	if timezone == "" {
		timezone = "Asia/Ho_Chi_Minh"
	}

	if sslmode == "" {
		sslmode = "disable"
	}

	return "host=" + host + " user=" + user + " password=" + password + " dbname=" + dbname + " port=" + port + " sslmode=" + sslmode + " TimeZone=" + timezone
}
