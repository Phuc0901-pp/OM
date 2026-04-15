package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// PushSubscription represents a Web Push subscription from a user's browser
type PushSubscription struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Endpoint  string    `gorm:"type:text;not null;unique" json:"endpoint"` // Unique per browser profile
	P256dh    string    `gorm:"type:text;not null" json:"p256dh"`
	Auth      string    `gorm:"type:text;not null" json:"auth"`
	UserAgent string    `gorm:"type:text" json:"user_agent"` // Optional: to help user identify device
	CreatedAt time.Time `json:"created_at"`
}

// TableName overrides the table name
func (PushSubscription) TableName() string {
	return "push_subscriptions"
}

// Notification represents a system notification for history
type Notification struct {
	ID        uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID       `gorm:"type:uuid;not null;index" json:"user_id"`
	Title     string          `gorm:"type:text;not null" json:"title"`
	Message   string          `gorm:"type:text;not null" json:"message"`
	Type      string          `gorm:"type:varchar(50);default:'info'" json:"type"` // info, success, warning, error
	IsRead    bool            `gorm:"default:false;index" json:"is_read"`
	Metadata  json.RawMessage `gorm:"type:jsonb" json:"metadata"` // Changed from []byte to json.RawMessage
	CreatedAt time.Time       `json:"created_at" gorm:"index"`
}

// TableName overrides the table name
func (Notification) TableName() string {
	return "notifications"
}
