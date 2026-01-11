package domain

import (
	"time"

	"gorm.io/gorm"
)

// AuditAction represents the type of action performed
type AuditAction string

const (
	ActionCreate       AuditAction = "CREATE"
	ActionUpdate       AuditAction = "UPDATE"
	ActionDelete       AuditAction = "DELETE"
	ActionStatusChange AuditAction = "STATUS_CHANGE"
	ActionAssign       AuditAction = "ASSIGN"
	ActionComment      AuditAction = "COMMENT"
)

// AuditLog represents a comprehensive audit trail for any entity in the system
// Uses polymorphic association pattern to track changes across different models
type AuditLog struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	
	// Polymorphic fields - can track any entity type
	EntityType string         `gorm:"type:varchar(50);not null;index:idx_audit_entity,priority:1" json:"entity_type"` // e.g., "Asset", "WorkOrder", "User"
	EntityID   uint           `gorm:"not null;index:idx_audit_entity,priority:2" json:"entity_id"`                     // ID of the entity being tracked
	
	// Action and user tracking
	Action     AuditAction    `gorm:"type:varchar(50);not null" json:"action"`
	UserID     uint           `gorm:"not null;index:idx_audit_user" json:"user_id"`
	User       *User          `json:"user,omitempty"`
	
	// Changes stored as JSONB - flexible structure for any field changes
	// Format: {"field_name": {"old": "value1", "new": "value2"}}
	// Example: {"status": {"old": "OPEN", "new": "IN_PROGRESS"}, "assignee_id": {"old": null, "new": 5}}
	Changes    AssetMetadata  `gorm:"serializer:json" json:"changes"`
	
	// Request metadata for security tracking
	IPAddress  string         `gorm:"type:varchar(45)" json:"ip_address"`  // IPv4 or IPv6
	UserAgent  string         `gorm:"type:text" json:"user_agent"`         // Browser/client info
	
	CreatedAt  time.Time      `gorm:"index:idx_audit_created_at" json:"created_at"`
}

// TableName overrides the table name
func (AuditLog) TableName() string {
	return "audit_logs"
}

// GetChangedFields returns a list of field names that were changed
func (a *AuditLog) GetChangedFields() []string {
	if a.Changes == nil {
		return []string{}
	}
	
	fields := make([]string, 0, len(a.Changes))
	for field := range a.Changes {
		fields = append(fields, field)
	}
	return fields
}

// GetFieldChange returns the old and new values for a specific field
func (a *AuditLog) GetFieldChange(field string) (old, new interface{}, exists bool) {
	if a.Changes == nil {
		return nil, nil, false
	}
	
	changeData, exists := a.Changes[field]
	if !exists {
		return nil, nil, false
	}
	
	// changeData should be a map with "old" and "new" keys
	changeMap, ok := changeData.(map[string]interface{})
	if !ok {
		return nil, nil, false
	}
	
	return changeMap["old"], changeMap["new"], true
}

// CreateAuditLog is a helper function to create audit log entries
func CreateAuditLog(tx *gorm.DB, entityType string, entityID uint, action AuditAction, 
	userID uint, changes AssetMetadata, ipAddress, userAgent string) error {
	
	auditLog := AuditLog{
		EntityType: entityType,
		EntityID:   entityID,
		Action:     action,
		UserID:     userID,
		Changes:    changes,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
	}
	
	return tx.Create(&auditLog).Error
}

// GetEntityHistory retrieves all audit logs for a specific entity
func GetEntityHistory(db *gorm.DB, entityType string, entityID uint) ([]AuditLog, error) {
	var logs []AuditLog
	err := db.Where("entity_type = ? AND entity_id = ?", entityType, entityID).
		Order("created_at DESC").
		Preload("User").
		Find(&logs).Error
	
	return logs, err
}

// GetUserActivity retrieves all audit logs for a specific user
func GetUserActivity(db *gorm.DB, userID uint, limit int) ([]AuditLog, error) {
	var logs []AuditLog
	query := db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Preload("User")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	err := query.Find(&logs).Error
	return logs, err
}

// GetRecentChanges retrieves recent audit logs across all entities
func GetRecentChanges(db *gorm.DB, limit int) ([]AuditLog, error) {
	var logs []AuditLog
	query := db.Order("created_at DESC").
		Preload("User")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	err := query.Find(&logs).Error
	return logs, err
}
