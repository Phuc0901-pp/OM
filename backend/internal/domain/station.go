package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Station represents a specific area or station within a project/category
type Station struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name           string         `gorm:"not null" json:"name"`

    AssignID       *uuid.UUID     `gorm:"type:uuid;column:assign_id;index" json:"assign_id,omitempty"`
    Assign         *Assign        `gorm:"foreignKey:AssignID;references:ID" json:"assign,omitempty"`
	
	ProjectID      uuid.UUID      `gorm:"type:uuid;column:id_project;index" json:"id_project"`
	Project        *Project       `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:SET NULL" json:"project,omitempty"`
	
	MainCategoryID uuid.UUID      `gorm:"type:uuid;column:id_main_category;index" json:"id_main_category"`
	MainCategory   *MainCategory  `gorm:"foreignKey:MainCategoryID" json:"main_category,omitempty"`
	
	// Stores array of selected child category IDs for this station
	ChildCategoryIDs datatypes.JSON `gorm:"column:child_category_ids;type:jsonb" json:"child_category_ids"`
	
	// Stores per-child-category configuration using a separate relationship
    ChildConfigs []StationChildConfig `gorm:"foreignKey:StationID;constraint:OnDelete:CASCADE" json:"child_configs"`
	
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// StationChildConfig represents configuration for a specific child category within a station
type StationChildConfig struct {
    ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    StationID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"station_id"`
    ChildCategoryID uuid.UUID      `gorm:"type:uuid;not null;index" json:"child_category_id"`
    
    ProcessIDs      datatypes.JSON `gorm:"type:jsonb" json:"process_ids"`
    ProjectClassificationID *uuid.UUID `gorm:"type:uuid;column:id_project_classification" json:"project_classification_id"`
    GuideText       string         `gorm:"type:text" json:"guide_text"`
    GuideImages     datatypes.JSON `gorm:"type:jsonb" json:"guide_images"`
    ImageCount      int            `gorm:"default:0" json:"image_count"`
    
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
}

type StationRepository interface {
	CreateStation(station *Station) error
	GetStationsByMainCategoryID(mainCategoryID uuid.UUID, projectID uuid.UUID) ([]Station, error)
	GetStationByID(id uuid.UUID) (*Station, error)
	GetStationsByUserID(userID uuid.UUID) ([]Station, error) // NEW: For Environment Page
	GetStationsByProjectID(projectID uuid.UUID) ([]Station, error) // NEW: For Allocation
	GetAllStations() ([]Station, error) // NEW: For Operations Page Lookup
	UpdateStation(station *Station) error
	UpdateStationConfig(id uuid.UUID, childCategoryIDs []string) error // Save child category list
	SaveChildConfig(id uuid.UUID, childConfigs map[string]interface{}) error // Save per-child config
	DeleteStation(id uuid.UUID) error
}

func (Station) TableName() string {
	return "stations"
}
