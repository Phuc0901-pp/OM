package postgres

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
    "gorm.io/datatypes"
)

type stationRepository struct {
	db *gorm.DB
}

func NewStationRepository(db *gorm.DB) domain.StationRepository {
	return &stationRepository{db: db}
}

func (r *stationRepository) CreateStation(station *domain.Station) error {
	return r.db.Create(station).Error
}

func (r *stationRepository) GetStationsByMainCategoryID(mainCategoryID uuid.UUID, projectID uuid.UUID) ([]domain.Station, error) {
	var stations []domain.Station
	if err := r.db.Preload("ChildConfigs").Where("id_main_category = ? AND id_project = ?", mainCategoryID, projectID).Find(&stations).Error; err != nil {
		return nil, err
	}
	return stations, nil
}

// GetStationsByProjectID fetches all stations for a project (for allocation task creation)
func (r *stationRepository) GetStationsByProjectID(projectID uuid.UUID) ([]domain.Station, error) {
	var stations []domain.Station
	if err := r.db.Preload("ChildConfigs").Where("id_project = ?", projectID).Find(&stations).Error; err != nil {
		return nil, err
	}

	return stations, nil
}

// GetAllStations fetches all stations (for lookup maps)
func (r *stationRepository) GetAllStations() ([]domain.Station, error) {
	var stations []domain.Station
	if err := r.db.Preload("ChildConfigs").Find(&stations).Error; err != nil {
		return nil, err
	}
	return stations, nil
}

func (r *stationRepository) GetStationByID(id uuid.UUID) (*domain.Station, error) {
	var station domain.Station
    // Preload ChildConfigs (the new separate table)
	if err := r.db.Preload("Project").Preload("MainCategory").Preload("ChildConfigs").Where("id = ?", id).First(&station).Error; err != nil {
		return nil, err
	}

    // Manual Fallback for Project/MainCategory (Keep existing logic)
    if station.Project == nil && station.ProjectID != uuid.Nil {
        var project domain.Project
        if err := r.db.Where("project_id = ?", station.ProjectID).First(&project).Error; err == nil {
            station.Project = &project
        } else {
             if err := r.db.Where("id = ?", station.ProjectID).First(&project).Error; err == nil {
                 station.Project = &project
             }
        }
    }

    if station.MainCategory == nil && station.MainCategoryID != uuid.Nil {
        var mainCategory domain.MainCategory
        if err := r.db.Where("id = ?", station.MainCategoryID).First(&mainCategory).Error; err == nil {
            station.MainCategory = &mainCategory
        }
    }
    
    // Compatibility: Convert ChildConfigs list back to JSONB map if needed for frontend backward compatibility
    // OR we can rely on the frontend reading the new `child_configs` array. 
    // For now, let's keep the struct field populated.

	return &station, nil
}

// GetStationsByUserID fetches all stations assigned to a user
// via assign_id -> assign.id_user relationship
func (r *stationRepository) GetStationsByUserID(userID uuid.UUID) ([]domain.Station, error) {
	var stations []domain.Station
	
	// Join stations to assign table and filter by user ID
	err := r.db.
		Preload("Project").
		Preload("MainCategory").
		Preload("ChildConfigs").
		Preload("Assign").
		Preload("Assign.Classification").
		Joins("JOIN assign ON stations.assign_id = assign.id").
		Where("assign.id_user = ?", userID).
		Where("stations.assign_id IS NOT NULL").
		Find(&stations).Error
	
	if err != nil {
		return nil, err
	}
	
	return stations, nil
}

func (r *stationRepository) UpdateStation(station *domain.Station) error {
	return r.db.Save(station).Error
}

func (r *stationRepository) UpdateStationConfig(id uuid.UUID, childCategoryIDs []string) error {
	jsonData, err := json.Marshal(childCategoryIDs)
	if err != nil {
		return err
	}
	return r.db.Model(&domain.Station{}).Where("id = ?", id).Update("child_category_ids", jsonData).Error
}

// SaveChildConfig saves configuration into the NEW station_child_configs table
// It iterates over the map keys (which are childCategoryID strings) and upserts records
func (r *stationRepository) SaveChildConfig(stationID uuid.UUID, childConfigs map[string]interface{}) error {
    // Legacy JSONB update removed to avoid type conflict with new Relation struct field.
	// We rely solely on station_child_configs table now.

    // 2. Iterate and Upsert into station_child_configs
    for childIDStr, configData := range childConfigs {
        childID, err := uuid.Parse(childIDStr)
        if err != nil {
            continue 
        }

        configMap, ok := configData.(map[string]interface{})
        if !ok {
            continue
        }

        // Extract fields
        var guideText string
        if val, ok := configMap["guide_text"].(string); ok {
            guideText = val
        }

        var imageCount int
        // handle float64 which often comes from JSON unmarshal
        if val, ok := configMap["image_count"].(float64); ok {
            imageCount = int(val)
        } else if val, ok := configMap["image_count"].(int); ok {
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
        if val, ok := configMap["project_classification_id"].(string); ok && val != "" {
            if id, err := uuid.Parse(val); err == nil {
                projectClassificationID = &id
            }
        }

        // UPSERT using GORM Clause
        // Postgres ON CONFLICT requires a unique constraint. We should have one on (station_id, child_category_id).
        // Since we didn't explicitly add a UNIQUE constraint in migration (only index), we'll do a check-and-update or create.
        
        var existingConfig domain.StationChildConfig
        result := r.db.Where("station_id = ? AND child_category_id = ?", stationID, childID).First(&existingConfig)
        
        if result.Error == nil {
            // Update
            existingConfig.GuideText = guideText
            existingConfig.ImageCount = imageCount
            existingConfig.ProcessIDs = processIDs
            existingConfig.GuideImages = guideImages
            existingConfig.ProjectClassificationID = projectClassificationID
             r.db.Save(&existingConfig)
        } else {
            // Create
            newConfig := domain.StationChildConfig{
                StationID: stationID,
                ChildCategoryID: childID,
                GuideText: guideText,
                ImageCount: imageCount,
                ProcessIDs: processIDs,
                GuideImages: guideImages,
                ProjectClassificationID: projectClassificationID,
            }
             r.db.Create(&newConfig)
        }
    }
    return nil
}

func (r *stationRepository) DeleteStation(id uuid.UUID) error {
	return r.db.Delete(&domain.Station{}, "id = ?", id).Error
}
