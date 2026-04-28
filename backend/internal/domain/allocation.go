package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Template defines a group of configs (work blueprints)
type Template struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name            string         `gorm:"not null" json:"name"`
	ProjectID       uuid.UUID      `gorm:"column:id_project;type:uuid;not null" json:"id_project"`
	Project         *Project       `gorm:"foreignKey:ProjectID;references:ID" json:"project,omitempty"`
	ModelProjectID  *uuid.UUID     `gorm:"column:id_model_project;type:uuid" json:"id_model_project"`
	ModelProject    *ModelProject  `gorm:"foreignKey:ModelProjectID;references:ID" json:"model_project,omitempty"`
	ConfigIDs       datatypes.JSON `gorm:"column:id_config;type:jsonb;default:'[]'" json:"id_config"`
	PersonCreatedID *uuid.UUID     `gorm:"column:id_person_created;type:uuid" json:"id_person_created"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

func (Template) TableName() string {
	return "templates"
}

// ModelProject represents a reusable work order template/blueprint
type ModelProject struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

func (ModelProject) TableName() string {
	return "model_projects"
}

// Config maps an Asset to a SubWork as part of a project's configuration.
// A Config record means: "For Asset X, the task SubWork Y must be done."
type Config struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AssetID   uuid.UUID      `gorm:"column:id_asset;type:uuid;not null" json:"id_asset"`
	Asset     *Asset         `gorm:"foreignKey:AssetID;references:ID" json:"asset,omitempty"`
	SubWorkID           uuid.UUID      `gorm:"column:id_sub_work;type:uuid;not null" json:"id_sub_work"`
	SubWork             *SubWork       `gorm:"foreignKey:SubWorkID;references:ID" json:"sub_work,omitempty"`
	StatusSetImageCount bool           `gorm:"column:status_set_image_count;default:false" json:"status_set_image_count"`
	ImageCount          int            `gorm:"column:image_count;default:0" json:"image_count"`
	GuideText           string         `gorm:"column:guide_text" json:"guide_text"`
	GuideImages         datatypes.JSON `gorm:"column:guide_images;type:jsonb;default:'[]'" json:"guide_images"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

func (Config) TableName() string {
	return "configs"
}

// Assign represents a work assignment (Project -> multiple users).
// UserIDs is a JSONB array of user UUIDs.
type Assign struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID      uuid.UUID      `gorm:"column:id_project;type:uuid;not null" json:"id_project"`
	Project        *Project       `gorm:"foreignKey:ProjectID;references:ID" json:"project,omitempty"`
	ModelProjectID *uuid.UUID     `gorm:"column:id_model_project;type:uuid" json:"id_model_project"`
	ModelProject   *ModelProject  `gorm:"foreignKey:ModelProjectID;references:ID" json:"model_project,omitempty"`
	TemplateID     *uuid.UUID     `gorm:"column:id_template;type:uuid" json:"id_template"`
	Template       *Template      `gorm:"foreignKey:TemplateID;references:ID" json:"template,omitempty"`
	// JSONB array of user UUIDs assigned to this work
	UserIDs        datatypes.JSON `gorm:"column:id_user;type:jsonb;not null;default:'[]'" json:"id_user"`
	StartTime      *time.Time     `gorm:"column:start_time" json:"start_time"`
	EndTime        *time.Time     `gorm:"column:end_time" json:"end_time"`
	NoteAssign     string         `gorm:"column:note_assign" json:"note_assign"`
	StatusAssign   bool           `gorm:"column:status_assign;default:false" json:"status_assign"`
	DetailAssigns  []DetailAssign `gorm:"foreignKey:AssignID" json:"details,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

func (Assign) TableName() string {
	return "assigns"
}

// DetailAssign represents the actual field work report for one config entry in an assignment.
type DetailAssign struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AssignID  uuid.UUID  `gorm:"column:id_assign;type:uuid;not null" json:"id_assign"`
	Assign    *Assign    `gorm:"foreignKey:AssignID;references:ID" json:"assign,omitempty"`
	ConfigID  *uuid.UUID `gorm:"column:id_config;type:uuid" json:"id_config"`
	Config    *Config    `gorm:"foreignKey:ConfigID;references:ID" json:"config,omitempty"`
	ProcessID *uuid.UUID `gorm:"column:id_process;type:uuid" json:"id_process"`
	Process   *Process   `gorm:"foreignKey:ProcessID;references:ID" json:"process,omitempty"`

	// Evidence (array of image URLs as JSONB)
	Data     datatypes.JSON `gorm:"column:data;type:jsonb;default:'[]'" json:"data"`
	NoteData string         `gorm:"column:note_data" json:"note_data"`

	// Status flags (0 = pending, 1 = completed/approved)
	StatusWork    int `gorm:"column:status_work;default:0" json:"status_work"`
	StatusSubmit  int `gorm:"column:status_submit;default:0" json:"status_submit"`
	StatusReject  int `gorm:"column:status_reject;default:0" json:"status_reject"`
	StatusApprove int `gorm:"column:status_approve;default:0" json:"status_approve"`

	// Timestamp history (JSONB arrays for full audit trail across multiple actions)
	SubmittedAt datatypes.JSON `gorm:"column:submitted_at;type:jsonb;default:'[]'" json:"submitted_at"`
	RejectedAt  datatypes.JSON `gorm:"column:rejected_at;type:jsonb;default:'[]'" json:"rejected_at"`
	ApprovalAt  datatypes.JSON `gorm:"column:approval_at;type:jsonb;default:'[]'" json:"approval_at"`

	// Person tracking (JSONB arrays matching the timestamp arrays above)
	// Each entry corresponds to the person who approved/rejected at the matching index in ApprovalAt/RejectedAt
	IdPersonApprove datatypes.JSON `gorm:"column:id_person_approve;type:jsonb;default:'[]'" json:"id_person_approve"`
	IdPersonReject  datatypes.JSON `gorm:"column:id_person_reject;type:jsonb;default:'[]'" json:"id_person_reject"`

	// Notes
	NoteReject   string `gorm:"column:note_reject" json:"note_reject"`
	NoteApproval string `gorm:"column:note_approval" json:"note_approval"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

func (DetailAssign) TableName() string {
	return "detail_assigns"
}

// MinioPathContext contains all names needed to generate structured MinIO paths
type MinioPathContext struct {
	ProjectName      string
	ModelProjectName string
	TemplateName     string
	WorkName         string
	SubWorkName      string
	ParentAssetName  string // name of parent asset (e.g. "Inverter 01"), empty if no parent
	AssetName        string
	ProcessName      string
}

// BuildMinioPrefix generates the folder prefix based on the context. 
// Uses "Unknown" or empty for missing values to ensure consistent paths.
func BuildMinioPrefix(ctx MinioPathContext) string {
	return ""
}

type ConfigRepository interface {
	Create(config *Config) error
	FindAll() ([]Config, error)
	FindByAssetID(assetID uuid.UUID) ([]Config, error)
	FindByProjectID(projectID uuid.UUID) ([]Config, error)
	FindByID(id uuid.UUID) (*Config, error)
	Update(config *Config) error
	Delete(id uuid.UUID) error
}

type AssignRepository interface {
	Create(assign *Assign) error
	FindAll() ([]Assign, error)
	FindByUserID(userID string) ([]Assign, error)
	FindByID(id uuid.UUID) (*Assign, error)
	Update(assign *Assign) error
	Delete(id uuid.UUID) error
	FindAllDeleted() ([]Assign, error)
	Restore(id uuid.UUID) error
	PermanentDelete(id uuid.UUID) error
}

type DetailAssignRepository interface {
	Create(detail *DetailAssign) error
	FindByAssignID(assignID uuid.UUID) ([]DetailAssign, error)
	FindByID(id uuid.UUID) (*DetailAssign, error)
	Update(detail *DetailAssign) error
	Delete(id uuid.UUID) error
	GetNamesForMinioPath(detailAssignID uuid.UUID) (*MinioPathContext, error)
}

type TemplateRepository interface {
	Create(template *Template) error
	FindAll() ([]Template, error)
	FindByID(id uuid.UUID) (*Template, error)
	Update(template *Template) error
	Delete(id uuid.UUID) error
}
