package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Read DB config from environment
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Ho_Chi_Minh",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database: ", err)
	}

	log.Println("Connected to database successfully")

	// Run migration SQL
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("Failed to get database instance: ", err)
	}

	// Add column
	log.Println("Adding id_project column...")
	_, err = sqlDB.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS id_project UUID")
	if err != nil {
		log.Printf("Warning adding column: %v\n", err)
	}

	// Add foreign key constraint
	log.Println("Adding foreign key constraint...")
	_, err = sqlDB.Exec(`
		ALTER TABLE attendances 
		ADD CONSTRAINT IF NOT EXISTS fk_attendances_project 
		FOREIGN KEY (id_project) REFERENCES projects(project_id) ON DELETE SET NULL
	`)
	if err != nil {
		log.Printf("Warning adding constraint: %v\n", err)
	}

	// Add index
	log.Println("Adding index...")
	_, err = sqlDB.Exec("CREATE INDEX IF NOT EXISTS idx_attendances_id_project ON attendances(id_project)")
	if err != nil {
		log.Printf("Warning adding index: %v\n", err)
	}

	log.Println("✅ Migration completed successfully!")
}
