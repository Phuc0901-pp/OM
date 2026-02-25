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

// User represents a system user
type User struct {
	ID           uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email        string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string         `json:"-"`
	FullName     string         `json:"full_name"`
	
	// Role Management
	// We use id_role to join with roles table
	RoleID       *uuid.UUID     `gorm:"column:id_role;type:uuid" json:"role_id"`
	RoleModel    *Role          `gorm:"foreignKey:RoleID;references:ID" json:"-"`
	Role         UserRole       `gorm:"-" json:"role"` // Transient field for JSON response, populated from RoleModel

	// Team Management
	// We use id_team to join with teams table
	TeamID       *uuid.UUID     `gorm:"column:id_team;type:uuid" json:"team_id"`
	Team         *Team          `gorm:"foreignKey:TeamID;references:ID" json:"team,omitempty"`
	
	// Leader Management (Self Reference)
	LeaderID     *uuid.UUID     `gorm:"column:id_leader;type:uuid" json:"leader_id"`
	Leader       *User          `gorm:"foreignKey:LeaderID;references:ID" json:"leader,omitempty"`

	NumberPhone    string         `gorm:"column:number_phone" json:"number_phone"`
    TelegramChatID string         `gorm:"column:telegram_chat_id" json:"telegram_chat_id"`
	
	// Assigned Projects (Preloaded for Managers)
	Assigns        []Assign       `gorm:"foreignKey:UserID" json:"assigned_projects"`

	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// Role represents a user role in the system
type Role struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string         `gorm:"uniqueIndex:uni_roles_name_new;not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Team represents a maintenance team
type Team struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string         `gorm:"uniqueIndex;not null" json:"name"`
	Character   string         `json:"character"`
	Description string         `json:"description"`
	Users       []User         `json:"users,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type UserRepository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByID(id uuid.UUID) (*User, error)
	GetUserByID(id uuid.UUID) (*User, error)
	GetUsersByLeaderID(leaderID uuid.UUID) ([]User, error)
	FindAll() ([]User, error)
	Delete(id uuid.UUID) error
	UpdateRole(userID uuid.UUID, roleID uuid.UUID) error
	UpdateLeader(userID uuid.UUID, leaderID *uuid.UUID) error
	Update(user *User) error
	
	// Statistics Optimized
	GetUserCount() (int64, error)
	GetUserCountByLeaderID(leaderID uuid.UUID) (int64, error)
	GetTeamCount() (int64, error)
	GetDB() *gorm.DB // Exposed for advanced querying/debugging
}
