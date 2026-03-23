package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type statsRepository struct {
	db *gorm.DB
}

func NewStatsRepository(db *gorm.DB) domain.StatsRepository {
	return &statsRepository{db: db}
}

// GetManagerDashboardStats returns aggregate stats for a manager's assigned works
func (r *statsRepository) GetManagerDashboardStats(managerID uuid.UUID) (*domain.ManagerStats, error) {
	stats := &domain.ManagerStats{}

	// Total projects accessible
	r.db.Model(&domain.Project{}).Where("deleted_at IS NULL").Count(&stats.TotalProjects)

	// Active assigns (not soft-deleted)
	r.db.Model(&domain.Assign{}).Where("deleted_at IS NULL").Count(&stats.ActiveAssignments)

	// Total detail assigns
	r.db.Model(&domain.DetailAssign{}).Where("deleted_at IS NULL").Count(&stats.TotalTasks)

	// Submitted tasks (pending review)
	r.db.Model(&domain.DetailAssign{}).
		Where("status_submit = 1 AND status_approve = 0 AND deleted_at IS NULL").
		Count(&stats.SubmittedTasks)

	// Completed (approved) tasks
	r.db.Model(&domain.DetailAssign{}).
		Where("status_approve = 1 AND deleted_at IS NULL").
		Count(&stats.CompletedTasks)

	// Calculate completion rate
	if stats.TotalTasks > 0 {
		stats.CompletionRate = float64(stats.CompletedTasks) / float64(stats.TotalTasks) * 100
	}

	// Top performers (most approved tasks)
	var performers []domain.TopPerformer
	r.db.Raw(`
		SELECT u.id AS user_id, u.name, COUNT(da.id) AS task_count
		FROM detail_assigns da
		JOIN assigns a ON a.id = da.id_assign AND a.deleted_at IS NULL
		JOIN users u ON u.deleted_at IS NULL
		WHERE da.status_approve = 1 AND da.deleted_at IS NULL
		GROUP BY u.id, u.name
		ORDER BY task_count DESC
		LIMIT 5
	`).Scan(&performers)
	stats.TopPerformers = performers

	return stats, nil
}
