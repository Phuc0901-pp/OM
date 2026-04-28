package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=192.168.31.254 user=phucraitek0539 password=090103Phuc dbname=solar_om port=2602 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	var subWorks []domain.SubWork
	if err := db.Limit(5).Find(&subWorks).Error; err != nil {
		log.Fatalf("Failed to load subworks: %v", err)
	}

	for _, sw := range subWorks {
		var ids []string
		_ = json.Unmarshal(sw.ProcessIDs, &ids)
		fmt.Printf("SubWork: %s, ProcessIDs: %v\n", sw.Name, ids)
	}
}
