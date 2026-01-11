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
	UserID                  uuid.UUID             `gorm:"type:uuid;column:id_user" json:"id_user"`
	User                    *User                 `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ProjectID               uuid.UUID             `gorm:"type:uuid;column:id_project" json:"id_project"`
	Project                 *Project              `gorm:"foreignKey:ProjectID;references:ID" json:"project,omitempty"`
	ProjectClassificationID uuid.UUID             `gorm:"type:uuid;column:id_project_classification" json:"id_project_classification"`
	Classification          *ProjectClassification`gorm:"foreignKey:ProjectClassificationID" json:"classification,omitempty"`
	
	// DataWork stores the specific quantities e.g. {"pv_module": 10}
	DataWork                AssetMetadata         `gorm:"column:data_work;serializer:json" json:"data_work"`

	// DataResult stores the execution progress e.g. images, notes
	DataResult              AssetMetadata         `gorm:"column:data_result;serializer:json" json:"data_result"`

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
	// GetCharacteristicsByMainID removed as schema changed
	// GetCharacteristicsByMainID(mainID uuid.UUID) ([]ProjectCharacteristic, error)
	
	GetProjectCharacteristic(projectID uuid.UUID) (*ProjectCharacteristic, error)
	CreateCharacteristic(c *ProjectCharacteristic) error
	UpdateProjectCharacteristic(projectID uuid.UUID, c *ProjectCharacteristic) error

    // Allocation
    CreateAssign(a *Assign) error
	GetAssignsByUserID(userID uuid.UUID) ([]Assign, error)
    GetAssignByID(id uuid.UUID) (*Assign, error)
	UpdateAssignDataResult(id uuid.UUID, data AssetMetadata) error
	CheckProjectExistsInAssign(projectID uuid.UUID) (bool, error)
	GetAssignsByProjectID(projectID uuid.UUID) ([]Assign, error)
    UpdateAssign(a *Assign) error
    GetAllAssigns() ([]Assign, error)
    GetDeletedAssigns() ([]Assign, error)
    GetDeletedAssignsByUsers(userIDs []uuid.UUID) ([]Assign, error)
    DeleteAssign(id uuid.UUID) error
    HardDeleteAssign(id uuid.UUID) error
    RestoreAssign(id uuid.UUID) error


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
	UpdateChildCategory(id uuid.UUID, name string) error
	DeleteChildCategory(id uuid.UUID) error

    CreateClassification(c *ProjectClassification) error
    
    // Task Detail
    UpdateTaskDetailCheck(assignID, childID uuid.UUID, index int, checkStatus int) error
    UpdateTaskDetailAccept(id uuid.UUID, accept int, note string) error

    // Statistics
    GetProjectStatusBreakdown() ([]ProjectStatusStat, error)
    GetTeamPerformance() ([]TeamPerformanceStat, error)
    GetCategoryDistribution() ([]CategoryStat, error)
    
    // Sync
    SyncTaskDetails(assignID uuid.UUID, details []TaskDetail) error

    // Advanced Statistics
    GetDetailedStats(projectID string, timeUnit string, userID string) ([]TimeStat, error)
    GetWorkTimeline(projectID string, limit int, userID string) ([]TaskDetail, error)
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

// TaskDetail represents a specific granular task item (e.g., "Inverter 1")
type TaskDetail struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AssignID        uuid.UUID      `gorm:"type:uuid;column:assign_id;index" json:"assign_id"`
	Assign          *Assign        `gorm:"foreignKey:AssignID" json:"assign,omitempty"`
	ChildCategoryID uuid.UUID      `gorm:"type:uuid;column:child_category_id" json:"child_category_id"`
	ChildCategory   *ChildCategory `gorm:"foreignKey:ChildCategoryID" json:"child_category,omitempty"`
	ProcessID       *uuid.UUID     `gorm:"type:uuid;column:process_id" json:"process_id"`
	
	// Replaced ItemIndex with Station/Inverter
	StationName     *string        `gorm:"column:station_name" json:"station_name"`
	InverterName    *string        `gorm:"column:inverter_name" json:"inverter_name"`
	
	Status          string         `gorm:"column:status;default:'pending'" json:"status"` // pending, completed, issue
	Note            string         `gorm:"column:note" json:"note"`
	ImagePath       string         `gorm:"column:image_path" json:"image_path"`
	Check           int            `gorm:"column:check;default:0" json:"check"`  // 0: default, 1: has photos (before/after)
	Accept          int            `gorm:"column:accept;default:0" json:"accept"` // 0: pending, 1: accepted, -1: rejected
	
	SubmittedAt     *time.Time     `gorm:"column:submitted_at" json:"submitted_at"`
	ApprovalAt      *time.Time     `gorm:"column:approval_at" json:"approval_at"`
	RejectedAt      *time.Time     `gorm:"column:rejected_at" json:"rejected_at"`
	
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

func (TaskDetail) TableName() string {
	return "task_details"
}
