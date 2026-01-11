package domain

import (
	"errors"
	"time"
    "database/sql/driver"
    "encoding/json"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AssetMetadata is a custom JSONB type
type AssetMetadata map[string]interface{}

// Scan implements sql.Scanner
func (m *AssetMetadata) Scan(value interface{}) error {
	if value == nil {
		*m = make(AssetMetadata)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, m)
}

// Value implements driver.Valuer
func (m AssetMetadata) Value() (driver.Value, error) {
	if m == nil {
		return nil, nil
	}
	return json.Marshal(m)
}

type WorkOrderPriority string
type WorkOrderStatus string

const (
	PriorityLow    WorkOrderPriority = "low"
	PriorityMedium WorkOrderPriority = "medium"
	PriorityHigh   WorkOrderPriority = "high"
)

const (
	StatusOpen       WorkOrderStatus = "open"
	StatusInProgress WorkOrderStatus = "in_progress"
	StatusOnHold     WorkOrderStatus = "on_hold"
	StatusCompleted  WorkOrderStatus = "completed"
	StatusCancelled  WorkOrderStatus = "cancelled"
)

var ErrOptimisticLock = errors.New("optimistic lock conflict")

// WorkOrder represents a maintenance task with SLA tracking
type WorkOrder struct {
	ID          uint                `gorm:"primaryKey" json:"id"`
	Title       string              `gorm:"not null" json:"title"`
	Description string              `json:"description"`
	// Asset Removed
	RequesterID uuid.UUID           `gorm:"not null;type:uuid" json:"requester_id"`
	Requester   *User               `json:"requester,omitempty"`
	AssigneeID  *uuid.UUID          `gorm:"type:uuid" json:"assignee_id"`
	Assignee    *User               `json:"assignee,omitempty"`
	Priority    WorkOrderPriority   `gorm:"default:medium" json:"priority"`
	Status      WorkOrderStatus     `gorm:"default:open" json:"status"`
	
	// Allocation / Project Details
	ProjectID               *uuid.UUID             `gorm:"type:uuid" json:"project_id"`
	Project                 *Project               `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	ProjectClassificationID *uuid.UUID             `gorm:"type:uuid" json:"project_classification_id"`
	ProjectClassification   *ProjectClassification `gorm:"foreignKey:ProjectClassificationID" json:"project_classification,omitempty"`
	
	// Categories
	// Categories
	MainCategoryID          *uuid.UUID             `gorm:"type:uuid" json:"main_category_id"`
	MainCategory            *MainCategory          `gorm:"foreignKey:MainCategoryID" json:"main_category,omitempty"`
	ChildCategoryID         *uuid.UUID             `gorm:"type:uuid" json:"child_category_id"`
	ChildCategory           *ChildCategory         `gorm:"foreignKey:ChildCategoryID" json:"child_category,omitempty"`

	// Characteristics Data (Stored as JSON)
	// Example: {"pv_module": "Value"}
	CharacteristicsData     AssetMetadata          `gorm:"serializer:json" json:"characteristics_data"`

	DueDate     *time.Time          `json:"due_date,omitempty"`
	Version     int                 `gorm:"default:1" json:"version"` // Optimistic locking
	
	// SLA Tracking fields
	ExpectedStartAt  *time.Time    `json:"expected_start_at,omitempty"`  // Planned start time for SLA
	ExpectedFinishAt *time.Time    `json:"expected_finish_at,omitempty"` // Planned completion time for SLA
	ActualStartAt    *time.Time    `json:"actual_start_at,omitempty"`    // Actual start time for KPI
	ActualFinishAt   *time.Time    `json:"actual_finish_at,omitempty"`   // Actual completion time for KPI
	
	CompletedAt *time.Time          `json:"completed_at,omitempty"`
	
	// Checklist data - snapshot of checklist results at execution time
	ChecklistData AssetMetadata     `gorm:"serializer:json" json:"checklist_data"`
	
	Activities  []WorkOrderActivity `json:"activities,omitempty"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
	DeletedAt   gorm.DeletedAt      `gorm:"index" json:"-"`
}

type ActivityType string

const (
	ActivityStatusChange ActivityType = "status_change"
	ActivityComment      ActivityType = "comment"
	ActivityAttachment   ActivityType = "attachment"
	ActivityAssignment   ActivityType = "assignment"
	ActivityFieldUpdate  ActivityType = "field_update"
)

// WorkOrderActivity represents audit log entries with JSONB change tracking
type WorkOrderActivity struct {
	ID           uint          `gorm:"primaryKey" json:"id"`
	WorkOrderID  uint          `gorm:"not null" json:"work_order_id"`
	UserID       uuid.UUID     `gorm:"not null;type:uuid" json:"user_id"`
	User         *User         `json:"user,omitempty"`
	ActivityType ActivityType  `gorm:"not null" json:"activity_type"`
	
	// Changed to JSONB to support complex change objects
	OldValue     AssetMetadata `gorm:"serializer:json" json:"old_value,omitempty"`
	NewValue     AssetMetadata `gorm:"serializer:json" json:"new_value,omitempty"`
	
	Comment      string        `json:"comment,omitempty"`
	Metadata     AssetMetadata `gorm:"serializer:json" json:"metadata,omitempty"`
	CreatedAt    time.Time     `json:"created_at"`
}

// TableName overrides the table name
func (WorkOrderActivity) TableName() string {
	return "work_order_activities"
}

// CalculateSLAStatus returns the SLA status: "on-time", "at-risk", "overdue"
func (w *WorkOrder) CalculateSLAStatus() string {
	if w.ExpectedFinishAt == nil {
		return "no-sla"
	}
	
	now := time.Now()
	
	// If already completed, check if it was on time
	if w.ActualFinishAt != nil {
		if w.ActualFinishAt.Before(*w.ExpectedFinishAt) || w.ActualFinishAt.Equal(*w.ExpectedFinishAt) {
			return "on-time"
		}
		return "overdue"
	}
	
	// If not completed yet, check current status
	if now.After(*w.ExpectedFinishAt) {
		return "overdue"
	}
	
	// Calculate if at risk (within 20% of deadline)
	if w.ExpectedStartAt != nil {
		totalDuration := w.ExpectedFinishAt.Sub(*w.ExpectedStartAt)
		timeRemaining := w.ExpectedFinishAt.Sub(now)
		
		if float64(timeRemaining) < float64(totalDuration)*0.2 {
			return "at-risk"
		}
	}
	
	return "on-time"
}

// GetDuration returns the actual duration of the work order
func (w *WorkOrder) GetDuration() time.Duration {
	if w.ActualStartAt == nil || w.ActualFinishAt == nil {
		return 0
	}
	return w.ActualFinishAt.Sub(*w.ActualStartAt)
}

// GetSLAVariance returns the difference between expected and actual completion time
// Positive value means completed early, negative means late
func (w *WorkOrder) GetSLAVariance() time.Duration {
	if w.ExpectedFinishAt == nil || w.ActualFinishAt == nil {
		return 0
	}
	return w.ExpectedFinishAt.Sub(*w.ActualFinishAt)
}

// BeforeUpdate hook to automatically set actual times based on status changes
func (w *WorkOrder) BeforeUpdate(tx *gorm.DB) error {
	// Get old status
	var oldWorkOrder WorkOrder
	if err := tx.Model(&WorkOrder{}).Select("status", "actual_start_at", "actual_finish_at").
		Where("id = ?", w.ID).First(&oldWorkOrder).Error; err != nil {
		return err
	}
	
	// If status changed to in_progress and actual_start_at not set, set it now
	if w.Status == StatusInProgress && oldWorkOrder.Status != StatusInProgress && w.ActualStartAt == nil {
		now := time.Now()
		w.ActualStartAt = &now
	}
	
	// If status changed to completed and actual_finish_at not set, set it now
	if w.Status == StatusCompleted && oldWorkOrder.Status != StatusCompleted && w.ActualFinishAt == nil {
		now := time.Now()
		w.ActualFinishAt = &now
		w.CompletedAt = &now
	}
	
	return nil
}
