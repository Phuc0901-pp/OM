package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Project represents a solar project (e.g., a specific site or plant)
type Project struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey;column:project_id" json:"project_id"`
	ProjectName string         `gorm:"column:project_name;not null" json:"project_name"`
	Owner       string         `gorm:"column:owner" json:"owner"`
	Area        float64        `gorm:"column:area" json:"area"`
	Location    string         `gorm:"column:location" json:"location"`
	CreatedAt   time.Time      `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"column:updated_at" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index;column:deleted_at" json:"-"`
}

func (Project) TableName() string {
	return "projects"
}

// ProjectClassification represents the type of project (e.g., Solar Farm, Rooftop, etc.)
type ProjectClassification struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string         `gorm:"uniqueIndex;not null" json:"name"`
	Description string         `json:"description"`
	Character   string         `gorm:"column:character;default:''" json:"character"`
}

func (ProjectClassification) TableName() string {
	return "project_classification"
}

// MainCategory represents a main category of work (e.g., Electrical, Mechanical)
type MainCategory struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"uniqueIndex;not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ChildCategory represents a sub-category belonging to a MainCategory
type ChildCategory struct {
	ID               uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name             string         `gorm:"not null;index:idx_child_name_main,unique" json:"name"`
	MainCategoryID   uuid.UUID      `gorm:"type:uuid;not null;column:id_main_categories;index:idx_child_name_main,unique" json:"main_category_id"`
	MainCategory     *MainCategory  `gorm:"foreignKey:MainCategoryID" json:"main_category,omitempty"`
	
	StationID        *uuid.UUID     `gorm:"type:uuid;column:id_station" json:"station_id"` // Always include in response
	Station          *Station       `gorm:"foreignKey:StationID" json:"station,omitempty"`

	RequiresInverter bool           `gorm:"column:requires_inverter;default:false" json:"requires_inverter"`
	ColumnKey        string         `gorm:"column:column_key" json:"column_key"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// ProjectCharacteristic stores dynamic characteristics for a project
// Each child category's column_key maps to a value in the ChildCategoryData JSON field
type ProjectCharacteristic struct {
	ID                uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID         uuid.UUID      `gorm:"type:uuid;column:id_project;uniqueIndex" json:"id_project"`
	Project           *Project       `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	
	// Dynamic child category data stored as JSON
	// Example: {"cleaning_pv_modules": {"quantity": 10, "process_ids": [...], "area_name": "A"}, ...}
	ChildCategoryData datatypes.JSON `gorm:"column:child_category_data;type:jsonb" json:"child_category_data"`
	
	// Inverter specific fields (Global)
	Inverter             int            `gorm:"column:inverter;default:0" json:"inverter"`
	InverterSubAreaCount int            `gorm:"column:inverter_sub_area_count;default:0" json:"inverter_sub_area_count"`
	InverterDetails      datatypes.JSON `gorm:"column:inverter_details;type:jsonb" json:"inverter_details"` // Array of counts per zone


	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProjectCharacteristic) TableName() string {
	return "project_characteristics"
}

// Assign represents the allocation record
type Assign struct {
	ID                      uuid.UUID             `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID                  uuid.UUID             `gorm:"type:uuid;column:id_user;index" json:"id_user"`
	User                    *User                 `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ProjectID               uuid.UUID             `gorm:"type:uuid;column:id_project;index" json:"id_project"`
	Project                 *Project              `gorm:"foreignKey:ProjectID;references:ID" json:"project,omitempty"`
	ProjectClassificationID uuid.UUID             `gorm:"type:uuid;column:id_project_classification;index" json:"id_project_classification"`
	Classification          *ProjectClassification`gorm:"foreignKey:ProjectClassificationID" json:"classification,omitempty"`
	
	// DataWork and DataResult removed as per user request (2026-01-17)
	// These were used for the old JSON-based workflow.
	// DataWork                AssetMetadata         `gorm:"column:data_work;serializer:json" json:"data_work"`
	// DataResult              AssetMetadata         `gorm:"column:data_result;serializer:json" json:"data_result"`

    // Timeline
    StartTime               *time.Time            `gorm:"column:start_time" json:"start_time"`
    EndTime                 *time.Time            `gorm:"column:end_time" json:"end_time"`
    Note                    string                `gorm:"column:note" json:"note"`
	
	// Details
	TaskDetails             []TaskDetail          `gorm:"foreignKey:AssignID" json:"task_details,omitempty"`
	
	CreatedAt               time.Time             `json:"created_at"`
	UpdatedAt               time.Time             `json:"updated_at"`
	DeletedAt               gorm.DeletedAt        `gorm:"index" json:"-"`
}

func (Assign) TableName() string {
	return "assign"
}

// Repository Interface
type ProjectRepository interface {
	GetAllProjects() ([]Project, error)
	GetAllClassifications() ([]ProjectClassification, error)
	GetAllMainCategories() ([]MainCategory, error)
	GetClassificationByID(id uuid.UUID) (*ProjectClassification, error)
	GetChildCategoriesByMainID(mainID uuid.UUID) ([]ChildCategory, error)
	GetChildCategoriesByStationID(stationID uuid.UUID) ([]ChildCategory, error) // New Logic
	// GetCharacteristicsByMainID removed as schema changed
	// GetCharacteristicsByMainID(mainID uuid.UUID) ([]ProjectCharacteristic, error)
	
	GetProjectCharacteristic(projectID uuid.UUID) (*ProjectCharacteristic, error)
	CreateCharacteristic(c *ProjectCharacteristic) error
	UpdateProjectCharacteristic(projectID uuid.UUID, c *ProjectCharacteristic) error

	// Helper to seed or create if needed
	CreateProject(p *Project) error
    GetProjectByID(id uuid.UUID) (*Project, error)
    UpdateProject(p *Project) error // New Update Method
	DeleteProject(id uuid.UUID) error
	// Category CRUD
	CreateMainCategory(c *MainCategory) error
	UpdateMainCategory(id uuid.UUID, name string) error
	DeleteMainCategory(id uuid.UUID) error
	
	CreateChildCategory(c *ChildCategory) error
	UpdateChildCategory(id uuid.UUID, updates map[string]interface{}) error
	DeleteChildCategory(id uuid.UUID) error

    CreateClassification(c *ProjectClassification) error
    
    // Statistics Optimized
    GetProjectCount() (int64, error)
	GetProjectsByUserID(userID uuid.UUID) ([]Project, error)
	// Clone a project and its full configuration
	CloneProject(id uuid.UUID) (*Project, error)
}

type TimeStat struct {
    TimePoint   string `json:"time_point"`
    Assigned    int64  `json:"assigned"`
    Completed   int64  `json:"completed"`
    InProgress  int64  `json:"in_progress"`
}

// Stats DTOs
type ProjectStatusStat struct {
    Status string `json:"status"`
    Count  int64  `json:"count"`
}

type TeamPerformanceStat struct {
    UserID    uuid.UUID `json:"user_id"`
    FullName  string    `json:"full_name"`
    Role      string    `json:"role"`
    TasksDone int64     `json:"tasks_done"`
}

type CategoryStat struct {
    CategoryName string `json:"category_name"`
    TaskCount    int64  `json:"task_count"`
}

type UserTaskStats struct {
    Assigned      int64 `json:"assigned"`
    Completed     int64 `json:"completed"`
    PendingReview int64 `json:"pending_review"`
    Rejected      int64 `json:"rejected"`
}

// TaskDetail represents a specific granular task item
// NEW SCHEMA (2026-01-17): Restructured to link directly to Station and Process
type TaskDetail struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AssignID        uuid.UUID      `gorm:"type:uuid;column:assign_id;index;not null" json:"assign_id"`
	Assign          *Assign        `gorm:"foreignKey:AssignID" json:"assign,omitempty"`
	
	// Child Category (for categorization)
	ChildCategoryID *uuid.UUID     `gorm:"type:uuid;column:child_category_id;index" json:"child_category_id"`
	ChildCategory   *ChildCategory `gorm:"foreignKey:ChildCategoryID" json:"child_category,omitempty"`
	
	// NEW: Direct link to Station
	StationID       *uuid.UUID     `gorm:"type:uuid;column:station_id;index" json:"station_id"`
	Station         *Station       `gorm:"foreignKey:StationID" json:"station,omitempty"` // Added for Preload
	
	// NEW: Process ID from station_child_configs
	ProcessID       *uuid.UUID     `gorm:"type:uuid;column:process_id" json:"process_id"`
	Process         *Process       `gorm:"foreignKey:ProcessID" json:"process,omitempty"` // Added for relation

	// NEW: Project Timeline (from allocation UI)
	ProjectStartTime *time.Time    `gorm:"column:project_start_time" json:"project_start_time"`
	ProjectEndTime   *time.Time    `gorm:"column:project_end_time" json:"project_end_time"`
	
	// NEW: Notes from allocation UI
	DataNote        string         `gorm:"column:data_note;type:text" json:"data_note"`
	
	// NEW: Work note stored in MinIO (2026-01-20)
	WorkNote        string         `gorm:"column:work_note;type:text" json:"work_note"`
	
	// NEW: Status fields (integer-based for clarity)
	StatusWork      int            `gorm:"column:status_work;default:0" json:"status_work"`     // 0=pending, 1=in_progress, 2=completed
	StatusSubmit    int            `gorm:"column:status_submit;default:0" json:"status_submit"` // 0=not_submitted, 1=submitted
	StatusApprove   int            `gorm:"column:status_approve;default:0" json:"status_approve"` // 0=pending, 1=approved
	StatusReject    int            `gorm:"column:status_reject;default:0" json:"status_reject"`   // 0=none, 1=rejected
	
	// NEW: Image URL for MinIO Sync (2026-01-24)
	ImageURL        string         `gorm:"column:image_url" json:"image_url"`

	// Timestamps
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	SubmittedAt     *time.Time     `gorm:"column:submitted_at" json:"submitted_at"`
	ApprovalAt      *time.Time     `gorm:"column:approval_at" json:"approval_at"`
	// RejectedAt      *time.Time     `gorm:"column:rejected_at" json:"rejected_at"` // Removed per user request
	RejectAt        *time.Time     `gorm:"column:reject_at" json:"reject_at,omitempty"` // Legacy field
	NoteReject      string         `gorm:"column:note_reject" json:"note_reject"`
	NoteApproval    string         `gorm:"column:note_approval" json:"note_approval"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// Process represents a specific process/step in a checklist
type Process struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Process) TableName() string {
	return "process"
}

func (TaskDetail) TableName() string {
	return "task_details"
}

