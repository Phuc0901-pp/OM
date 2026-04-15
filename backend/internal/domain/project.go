package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Owner represents a project owner/client company
type Owner struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

// Project represents a solar project site
type Project struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"column:name;not null" json:"name"`
	Location  string         `gorm:"column:location" json:"location"`
	OwnerID   *uuid.UUID     `gorm:"column:id_owner;type:uuid" json:"id_owner"`
	Owner     *Owner         `gorm:"foreignKey:OwnerID;references:ID" json:"owner,omitempty"`
	Assets    []Asset        `gorm:"foreignKey:ProjectID" json:"assets,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

type ProjectRepository interface {
	Create(project *Project) error
	FindAll() ([]Project, error)
	FindByID(id uuid.UUID) (*Project, error)
	Update(project *Project) error
	Delete(id uuid.UUID) error
	// Trash-related
	FindAllDeleted() ([]Project, error)
	Restore(id uuid.UUID) error
	PermanentDelete(id uuid.UUID) error
	BulkRestore(ids []uuid.UUID) error
	BulkPermanentDelete(ids []uuid.UUID) error
}

type OwnerRepository interface {
	Create(owner *Owner) error
	FindAll() ([]Owner, error)
	FindByID(id uuid.UUID) (*Owner, error)
	Update(owner *Owner) error
	Delete(id uuid.UUID) error
}
