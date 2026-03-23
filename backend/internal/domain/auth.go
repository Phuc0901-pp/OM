package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRole string

const (
	RoleAdmin    UserRole = "admin"
	RoleManager  UserRole = "manager"
	RoleEngineer UserRole = "engineer"
)

// Role represents a system role (admin, manager, engineer)
type Role struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"uniqueIndex;not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

// Team represents a maintenance team
type Team struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"uniqueIndex;not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

// User represents a system user
type User struct {
	ID           uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name         string         `gorm:"column:name;not null" json:"name"`
	Email        string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string         `gorm:"column:password_hash" json:"-"`
	NumberPhone  string         `gorm:"column:number_phone" json:"number_phone"`

	// Role relation
	RoleID    *uuid.UUID `gorm:"column:id_role;type:uuid" json:"role_id"`
	RoleModel *Role      `gorm:"foreignKey:RoleID;references:ID" json:"role,omitempty"`
	RoleName  UserRole   `gorm:"-" json:"role_name"`

	// Team relation
	TeamID *uuid.UUID `gorm:"column:id_team;type:uuid" json:"team_id"`
	Team   *Team      `gorm:"foreignKey:TeamID;references:ID" json:"team,omitempty"`

	// Creator relation (người đã tạo tài khoản này)
	PersonCreatedID *uuid.UUID `gorm:"column:id_person_created;type:uuid" json:"id_person_created"`
	PersonCreated   *User      `gorm:"foreignKey:PersonCreatedID;references:ID" json:"person_created,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}

type UserRepository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByID(id uuid.UUID) (*User, error)
	FindByIDUnscoped(id uuid.UUID) (*User, error)
	GetUserByID(id uuid.UUID) (*User, error)
	FindAll() ([]User, error)
	Delete(id uuid.UUID) error
	UpdateRole(userID uuid.UUID, roleID uuid.UUID) error
	Update(user *User) error
	GetUserCount() (int64, error)
	GetTeamCount() (int64, error)
	GetDB() *gorm.DB
	// Trash-related
	FindAllDeleted() ([]User, error)
	Restore(id uuid.UUID) error
	PermanentDelete(id uuid.UUID) error
	BulkRestore(ids []uuid.UUID) error
	BulkPermanentDelete(ids []uuid.UUID) error
}

