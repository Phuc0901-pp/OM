package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Process represents a type of work procedure/process
type Process struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

func (Process) TableName() string {
	return "process"
}

// Asset represents a physical piece of equipment under a project
type Asset struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	ProjectID uuid.UUID      `gorm:"column:id_project;type:uuid;not null" json:"id_project"`
	Project   *Project       `gorm:"foreignKey:ProjectID;references:ID" json:"project,omitempty"`
	ParentID  *uuid.UUID     `gorm:"column:parent_id;type:uuid" json:"parent_id,omitempty"`
	Parent    *Asset         `gorm:"foreignKey:ParentID;references:ID" json:"parent,omitempty"`
	SubAssets []Asset        `gorm:"foreignKey:ParentID" json:"sub_assets,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

// Work represents a maintenance task linked to an asset.
// ProcessIDs stores an array of process UUIDs (JSONB).
type Work struct {
	ID         uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name       string         `gorm:"not null" json:"name"`
	SubWorks   []SubWork      `gorm:"foreignKey:WorkID" json:"sub_works,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

// SubWork represents a specific step or sub-task under a Work.
// GuideImages stores an array of image URLs (JSONB).
type SubWork struct {
	ID                  uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name                string         `gorm:"not null" json:"name"`
	WorkID              uuid.UUID      `gorm:"column:id_work;type:uuid;not null" json:"id_work"`
	Work                *Work          `gorm:"foreignKey:WorkID;references:ID" json:"work,omitempty"`
	ProcessIDs          datatypes.JSON `gorm:"column:id_process;type:jsonb;default:'[]'" json:"id_process"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

type AssetRepository interface {
	Create(asset *Asset) error
	FindAll() ([]Asset, error)
	FindByProjectID(projectID uuid.UUID) ([]Asset, error)
	FindByID(id uuid.UUID) (*Asset, error)
	Update(asset *Asset) error
	Delete(id uuid.UUID) error
	FindDeleted() ([]Asset, error)
	Restore(id uuid.UUID) error
	HardDelete(id uuid.UUID) error
}

type WorkRepository interface {
	Create(work *Work) error
	FindAll() ([]Work, error)
	FindByID(id uuid.UUID) (*Work, error)
	Update(work *Work) error
	Delete(id uuid.UUID) error
	FindDeleted() ([]Work, error)
	Restore(id uuid.UUID) error
	HardDelete(id uuid.UUID) error
}

type SubWorkRepository interface {
	Create(subWork *SubWork) error
	FindAll() ([]SubWork, error)
	FindByWorkID(workID uuid.UUID) ([]SubWork, error)
	FindByID(id uuid.UUID) (*SubWork, error)
	Update(subWork *SubWork) error
	Delete(id uuid.UUID) error
	FindDeleted() ([]SubWork, error)
	Restore(id uuid.UUID) error
	HardDelete(id uuid.UUID) error
}
