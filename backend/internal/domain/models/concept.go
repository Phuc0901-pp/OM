package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Concept represents a user-defined database concept/schema
type Concept struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string         `json:"name" gorm:"unique;not null"`
	Description string         `json:"description"`
	Columns     datatypes.JSON `json:"columns" gorm:"type:jsonb"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// ColumnDef defines the structure of a column in a concept
type ColumnDef struct {
	Name     string `json:"name"`
	Label    string `json:"label"`
	Type     string `json:"type"` // "text", "number", "boolean", "date"
	Required bool   `json:"required"`
	Unit     string `json:"unit,omitempty"`
}

// TableName specifies the table name for GORM
func (Concept) TableName() string {
	return "concepts"
}
