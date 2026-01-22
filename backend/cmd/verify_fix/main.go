package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
    "gorm.io/datatypes"
)

// Define basic structs needed for the test (simplified from domain)
type StationChildConfig struct {
	ID                      uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	StationID               uuid.UUID      `gorm:"type:uuid;not null;index"`
	ChildCategoryID         uuid.UUID      `gorm:"type:uuid;not null;index"`
	ProcessIDs              datatypes.JSON `gorm:"type:jsonb"`
	ProjectClassificationID *uuid.UUID     `gorm:"type:uuid;column:id_project_classification"`
	GuideText               string         `gorm:"type:text"`
	GuideImages             datatypes.JSON `gorm:"type:jsonb"`
	ImageCount              int            `gorm:"default:0"`
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

func main() {
	// 1. Connect to Database (User's local DB)
	dsn := "host=localhost user=postgres password=yourpassword dbname=solar_om port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Error),
	})
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	fmt.Println("Successfully connected to Database.")

	// 2. Generate UUIDs for test
	stationID := uuid.New()
	childCategoryID := uuid.New()
	classificationID := uuid.New()

	fmt.Printf("Test IDs:\n Station: %s\n ChildCategory: %s\n Classification: %s\n", stationID, childCategoryID, classificationID)

	// 3. Define the Repo logic inline (simulating station_handler.go -> station_repository.go flow)
	// We want to test if passing the ID in the map correctly saves to the DB.
    
    // Simulate the data map constructed in StationHandler
    configMap := map[string]interface{}{
        "process_ids": []string{"proc1", "proc2"},
        "guide_text": "Test Guide",
        "image_count": 5,
        "project_classification_id": classificationID.String(), // This is what the frontend sends and handler maps
    }
    
    // Repository Logic Simulation (copied from station_repository.go)
    err = SaveChildConfigSimulated(db, stationID, childCategoryID, configMap)
    if err != nil {
        log.Fatalf("SaveChildConfig failed: %v", err)
    }
    fmt.Println("SaveChildConfig executed successfully.")

    // 4. Verify Results
    var savedConfig StationChildConfig
    err = db.Where("station_id = ? AND child_category_id = ?", stationID, childCategoryID).First(&savedConfig).Error
    if err != nil {
        log.Fatalf("Failed to query saved config: %v", err)
    }

    if savedConfig.ProjectClassificationID == nil {
        fmt.Println("FAILURE: ProjectClassificationID is NIL in database!")
        os.Exit(1)
    } else if *savedConfig.ProjectClassificationID != classificationID {
        fmt.Printf("FAILURE: ID Mismatch! Expected %s, Got %s\n", classificationID, *savedConfig.ProjectClassificationID)
        os.Exit(1)
    }

    fmt.Println("SUCCESS: ProjectClassificationID was correctly saved to the database!")
    
    // Cleanup
    db.Delete(&savedConfig)
    fmt.Println("Test data cleaned up.")
}

func SaveChildConfigSimulated(db *gorm.DB, stationID uuid.UUID, childID uuid.UUID, configMap map[string]interface{}) error {
        // Extract fields
        var guideText string
        if val, ok := configMap["guide_text"].(string); ok {
            guideText = val
        }

        var imageCount int
        if val, ok := configMap["image_count"].(int); ok {
            imageCount = val
        }
        
        var processIDs datatypes.JSON
        if val, ok := configMap["process_ids"]; ok {
             if bytes, err := json.Marshal(val); err == nil {
                 processIDs = datatypes.JSON(bytes)
             }
        }
        
        var guideImages datatypes.JSON
        if val, ok := configMap["guide_images"]; ok {
             if bytes, err := json.Marshal(val); err == nil {
                 guideImages = datatypes.JSON(bytes)
             }
        }

        var projectClassificationID *uuid.UUID
        // THIS IS THE FIX WE ARE TESTING
        if val, ok := configMap["project_classification_id"].(string); ok && val != "" {
            if id, err := uuid.Parse(val); err == nil {
                projectClassificationID = &id
            }
        }

        var existingConfig StationChildConfig
        result := db.Table("station_child_configs").Where("station_id = ? AND child_category_id = ?", stationID, childID).First(&existingConfig)
        
        if result.Error == nil {
            existingConfig.GuideText = guideText
            existingConfig.ImageCount = imageCount
            existingConfig.ProcessIDs = processIDs
            existingConfig.GuideImages = guideImages
            existingConfig.ProjectClassificationID = projectClassificationID
             return db.Table("station_child_configs").Save(&existingConfig).Error
        } else {
            newConfig := StationChildConfig{
                StationID: stationID,
                ChildCategoryID: childID,
                GuideText: guideText,
                ImageCount: imageCount,
                ProcessIDs: processIDs,
                GuideImages: guideImages,
                ProjectClassificationID: projectClassificationID,
            }
             return db.Table("station_child_configs").Create(&newConfig).Error
        }
}
