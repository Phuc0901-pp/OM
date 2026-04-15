package domain

import (
	"github.com/google/uuid"
)

// StatsRepository defines methods for retrieving system statistics
type StatsRepository interface {
	// Manager Stats
	GetManagerDashboardStats(managerID uuid.UUID) (*ManagerStats, error)
}

// TopPerformer represents a user with high task approval count
type TopPerformer struct {
	UserID    uuid.UUID `json:"user_id"`
	Name      string    `json:"name"`
	TaskCount int       `json:"task_count"`
}

// ManagerStats is used by Manager Dashboard statistics
type ManagerStats struct {
	TotalProjects     int64          `json:"total_projects"`
	ActiveAssignments int64          `json:"active_assignments"`
	CompletedTasks    int64          `json:"completed_tasks"`
	TotalUsers        int64          `json:"total_users"`
	TotalTasks        int64          `json:"total_tasks"`
	SubmittedTasks    int64          `json:"submitted_tasks"`
	CompletionRate    float64        `json:"completion_rate"`
	TopPerformers     []TopPerformer `json:"top_performers"`
}
