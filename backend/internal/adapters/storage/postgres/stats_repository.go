package postgres

import (
    "errors"
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

func (r *statsRepository) GetProjectStatusBreakdown() ([]domain.ProjectStatusStat, error) {
    var stats []domain.ProjectStatusStat
    if err := r.db.Model(&domain.TaskDetail{}).
        Select("status, count(*) as count").
        Group("status").
        Scan(&stats).Error; err != nil {
        return nil, err
    }
    return stats, nil
}

func (r *statsRepository) GetTeamPerformance() ([]domain.TeamPerformanceStat, error) {
    var stats []domain.TeamPerformanceStat
    if err := r.db.Model(&domain.User{}).
        Select("\"users\".id as user_id, \"users\".full_name, \"roles\".name as role, count(\"task_details\".id) as tasks_done").
        Joins("JOIN \"assign\" ON \"assign\".id_user = \"users\".id").
        Joins("JOIN \"task_details\" ON \"task_details\".assign_id = \"assign\".id").
        Joins("LEFT JOIN \"roles\" ON \"roles\".id = \"users\".id_role").
        Where("\"task_details\".status = ? OR \"task_details\".accept = ?", "completed", 1).
        Group("\"users\".id, \"users\".full_name, \"roles\".name").
        Order("count(\"task_details\".id) DESC").
        Limit(10).
        Scan(&stats).Error; err != nil {
        return nil, err
    }
    return stats, nil
}

func (r *statsRepository) GetCategoryDistribution() ([]domain.CategoryStat, error) {
    var stats []domain.CategoryStat
    if err := r.db.Model(&domain.TaskDetail{}).
        Select("main_categories.name as category_name, count(task_details.id) as task_count").
        Joins("JOIN child_categories ON child_categories.id = task_details.child_category_id").
        Joins("JOIN main_categories ON main_categories.id = child_categories.id_main_categories").
        Group("main_categories.name").
        Scan(&stats).Error; err != nil {
        return nil, err
    }
    return stats, nil
}

func (r *statsRepository) GetDetailedStats(projectID string, timeUnit string, userID string) ([]domain.TimeStat, error) {
	validUnits := map[string]bool{
		"year": true, "quarter": true, "month": true, "week": true,
		"day": true, "hour": true, "minute": true, "second": true,
	}
	if !validUnits[timeUnit] {
		return nil, errors.New("invalid time unit")
	}

	var stats []domain.TimeStat
	
	query := `
		SELECT 
			to_char(date_trunc(?, task_details.created_at), 'YYYY-MM-DD HH24:MI:SS') as time_point,
			COUNT(*) as assigned,
			SUM(CASE WHEN task_details.status_approve = 1 THEN 1 ELSE 0 END) as completed,
			SUM(CASE WHEN task_details.status_work = 1 AND task_details.status_approve = 0 THEN 1 ELSE 0 END) as in_progress
		FROM task_details
		JOIN assign ON assign.id = task_details.assign_id
		WHERE 1=1
	`
	args := []interface{}{timeUnit}

	if projectID != "" {
		query += " AND assign.id_project = ?"
		args = append(args, projectID)
	}

	if userID != "" {
		query += " AND assign.id_user = ?"
		args = append(args, userID)
	}

	query += `
		GROUP BY 1
		ORDER BY 1 DESC
		LIMIT 100
	`

	if err := r.db.Raw(query, args...).Scan(&stats).Error; err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *statsRepository) GetWorkTimeline(projectID string, limit int, userID string) ([]domain.TaskDetail, error) {
	var tasks []domain.TaskDetail
	
	db := r.db.Model(&domain.TaskDetail{}).
		Preload("Assign.User").
		Preload("Assign.Project").
		Preload("Assign.Classification").
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Where("task_details.status_approve = ?", 1).
		Order("task_details.submitted_at DESC")

	db = db.Joins("JOIN assign ON assign.id = task_details.assign_id")

	if projectID != "" {
		db = db.Where("assign.id_project = ?", projectID)
	}

	if userID != "" {
		db = db.Where("assign.id_user = ?", userID)
	}

	if limit > 0 {
		db = db.Limit(limit)
	}

	if err := db.Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (r *statsRepository) GetUserTaskStats(userID uuid.UUID, projectID *uuid.UUID) (*domain.UserTaskStats, error) {
    var stats domain.UserTaskStats
    
    query := r.db.Model(&domain.TaskDetail{}).
        Select("COUNT(*) as assigned, SUM(CASE WHEN task_details.status_approve = 1 THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN task_details.status_submit = 1 AND task_details.status_approve = 0 THEN 1 ELSE 0 END) as pending_review, SUM(CASE WHEN task_details.status_reject = 1 AND task_details.status_approve = 0 THEN 1 ELSE 0 END) as rejected").
        Joins("JOIN assign ON assign.id = task_details.assign_id").
        Where("assign.id_user = ?", userID)

    if projectID != nil {
        query = query.Where("assign.id_project = ?", projectID)
    }

    if err := query.Scan(&stats).Error; err != nil {
        return nil, err
    }
    return &stats, nil
}
