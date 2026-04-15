package main

import (
	"fmt"
	"log"

	"github.com/phuc/cmms-backend/internal/config"
	"github.com/phuc/cmms-backend/internal/platform/database"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load(".env")
	config.Load()
	database.Connect()

	if database.DB == nil {
		log.Fatal("DB is nil")
	}

	var count int64
	err := database.DB.Table("reports").Count(&count).Error
	if err != nil {
		fmt.Printf("Error accessing reports table: %v\n", err)
	} else {
		fmt.Printf("Reports table exists and has %d records\n", count)
	}
}
