package main

import (
    "fmt"
    "log"

    "github.com/joho/godotenv"
    "github.com/phuc/cmms-backend/internal/platform/database"
    "gorm.io/datatypes"
)

type StationChildConfig struct {
    StationID       string         `gorm:"primaryKey"`
    ChildCategoryID string         `gorm:"primaryKey"`
    GuideText       string
    ImageCount      int
    ProcessIDs      datatypes.JSON
    GuideImages     datatypes.JSON
}

func main() {
    // Load env
    if err := godotenv.Load("../../.env"); err != nil {
         // try relative to where it runs
         if err := godotenv.Load(); err != nil {
             log.Printf("Error loading .env: %v", err)
         }
    }
    
    // Connect DB
    database.Connect()
    db := database.DB
    
    var configs []StationChildConfig
    if err := db.Table("station_child_configs").Find(&configs).Error; err != nil {
        log.Fatalf("Query Failed: %v", err)
    }
    
    fmt.Printf("Found %d configs in station_child_configs:\n", len(configs))
    for _, c := range configs {
        fmt.Printf("Station: %s | Child: %s | Count: %d | Text: %s\n", c.StationID, c.ChildCategoryID, c.ImageCount, c.GuideText)
    }
}
