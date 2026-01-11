// internal/domain/dtos/work_order_dto.go
package dtos

import (
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
)

// FilterOptions represents the filtering and searching options
type FilterOptions struct {
	Page     int
	Limit    int
	Status   string
	Priority string
	Search   string // Searches in WorkOrder.Title AND Asset.Name
}

// CreateWorkOrderRequest for creating a new WO
type CreateWorkOrderRequest struct {
	Title            string     `json:"title" binding:"required"`
	Description      string     `json:"description"`
	Priority         string     `json:"priority" binding:"required,oneof=low medium high"`
	AssigneeID       *uuid.UUID `json:"assignee_id"`
	DueDate          *time.Time `json:"due_date"`
	ExpectedStartAt  *time.Time             `json:"expected_start_at"`
	ExpectedFinishAt *time.Time             `json:"expected_finish_at"`
	
	// Allocation Fields
	ProjectID               *uuid.UUID           `json:"project_id"`
	ProjectClassificationID *uuid.UUID           `json:"project_classification_id"`
	MainCategoryID          *uuid.UUID           `json:"main_category_id"`
	ChildCategoryID         *uuid.UUID           `json:"child_category_id"`
	CharacteristicsData     domain.AssetMetadata `json:"characteristics_data"`
}

// UpdateWorkOrderRequest for general updates
type UpdateWorkOrderRequest struct {
	Title            string     `json:"title"`
	Description      string     `json:"description"`
	Priority         string     `json:"priority"`
	AssigneeID       *uuid.UUID `json:"assignee_id"`
	DueDate          *time.Time `json:"due_date"`
	ExpectedStartAt  *time.Time `json:"expected_start_at"`
	ExpectedFinishAt *time.Time `json:"expected_finish_at"`
	Version          int        `json:"version" binding:"required"`
}

// UpdateWorkOrderStatusRequest handles status transitions
type UpdateWorkOrderStatusRequest struct {
	Status  string `json:"status" binding:"required"`
	Comment string `json:"comment"`
	Version int    `json:"version" binding:"required"`
}

// WorkOrderResponse is the DTO for Work Order details (Flattened for Frontend)
type WorkOrderResponse struct {
	ID               uint                   `json:"id"`
	Title            string                 `json:"title"`
	Description      string                 `json:"description"`
	Status           string                 `json:"status"`
	Priority         string                 `json:"priority"`
	
	// Flattened Relationship Info
	RequesterID      uuid.UUID              `json:"requester_id"`
	RequesterName    string                 `json:"requester_name"`
	AssigneeID       *uuid.UUID             `json:"assignee_id"`
	AssigneeName     string                 `json:"assignee_name"`

	// Allocation Info
	ProjectID               *uuid.UUID           `json:"project_id"`
	ProjectName             string               `json:"project_name,omitempty"`
	ProjectClassificationID *uuid.UUID           `json:"project_classification_id"`
	MainCategoryID          *uuid.UUID           `json:"main_category_id"`
	MainCategoryName        string               `json:"main_category_name,omitempty"`
	ChildCategoryID         *uuid.UUID           `json:"child_category_id"`
	CharacteristicsData     domain.AssetMetadata `json:"characteristics_data"`

	// Timestamps & SLA
	DueDate          *time.Time             `json:"due_date,omitempty"`
	ExpectedStartAt  *time.Time             `json:"expected_start_at,omitempty"`
	ExpectedFinishAt *time.Time             `json:"expected_finish_at,omitempty"`
	ActualStartAt    *time.Time             `json:"actual_start_at,omitempty"`
	ActualFinishAt   *time.Time             `json:"actual_finish_at,omitempty"`
	CompletedAt      *time.Time             `json:"completed_at,omitempty"`
	
	SLAStatus        string                 `json:"sla_status"` // calculated field
	Version          int                    `json:"version"`
	
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	
	ChecklistData    domain.AssetMetadata   `json:"checklist_data"`
}

// ListWorkOrdersResponse is the paginated response
type ListWorkOrdersResponse struct {
	Data       []WorkOrderResponse `json:"data"`
	Total      int64               `json:"total"`
	Page       int                 `json:"page"`
	Limit      int                 `json:"limit"`
	TotalPages int                 `json:"total_pages"`
}
