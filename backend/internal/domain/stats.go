package domain

import (


	"github.com/google/uuid"
)

// StatsRepository defines methods for retrieving system statistics
type StatsRepository interface {
	// Admin Stats
	GetProjectStatusBreakdown() ([]ProjectStatusStat, error)
	GetTeamPerformance() ([]TeamPerformanceStat, error)
	GetCategoryDistribution() ([]CategoryStat, error)
	
	// Manager Stats
	GetDetailedStats(projectID string, timeUnit string, userID string) ([]TimeStat, error)
	GetWorkTimeline(projectID string, limit int, userID string) ([]TaskDetail, error)
	
	// User Stats
	GetUserTaskStats(userID uuid.UUID, projectID *uuid.UUID) (*UserTaskStats, error)
}
