package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ChecklistTemplate stores the inverter distribution structure per site/area for an assignment
type ChecklistTemplate struct {
	ID                       uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AssignID                 uuid.UUID      `gorm:"type:uuid;not null;column:assign_id;index" json:"assign_id"`
	StructureSiteOfInverter  datatypes.JSON `gorm:"column:structure_site_of_inverter" json:"structure_site_of_inverter"` // e.g., {"Building 1": 3, "Building 2": 5}
	CreatedAt                time.Time      `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt                time.Time      `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
	DeletedAt                gorm.DeletedAt `gorm:"index;column:deleted_at" json:"-"`

	// Associations
	Assign *Assign `gorm:"foreignKey:AssignID;references:ID" json:"assign,omitempty"`
}

func (ChecklistTemplate) TableName() string {
	return "checklist_templates"
}

