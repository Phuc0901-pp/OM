package services

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
)

type StatsService struct {
	projectRepo    domain.ProjectRepository
	allocationRepo domain.AllocationRepository // NEW
	statsRepo      domain.StatsRepository      // NEW
	userRepo       domain.UserRepository
}

func NewStatsService(
	projectRepo domain.ProjectRepository,
	allocationRepo domain.AllocationRepository, // NEW
	statsRepo domain.StatsRepository,           // NEW
	userRepo domain.UserRepository,
) *StatsService {
	return &StatsService{
		projectRepo:    projectRepo,
		allocationRepo: allocationRepo,
		statsRepo:      statsRepo,
		userRepo:       userRepo,
	}
}

type AdminStats struct {
	TotalProjects   int64 `json:"total_projects"`
	TotalUsers      int64 `json:"total_users"`
	TotalTeams      int64 `json:"total_teams"`
	ActiveAssigns   int64 `json:"active_assigns"`
    
    // Charts Data
    TaskStatusStats      []domain.ProjectStatusStat   `json:"task_status_stats"`
    TeamPerformanceStats []domain.TeamPerformanceStat `json:"team_performance_stats"`
    CategoryStats        []domain.CategoryStat        `json:"category_stats"`
}

func (s *StatsService) GetAdminStats() (*AdminStats, error) {
	// 1. Optimized Counts using SQL Count(*)
	projCount, err := s.projectRepo.GetProjectCount()
	if err != nil { return nil, err }
	
	userCount, err := s.userRepo.GetUserCount()
	if err != nil { return nil, err }

	teamCount, err := s.userRepo.GetTeamCount()
	if err != nil { return nil, err }

	assignCount, err := s.allocationRepo.GetAssignCount()
	if err != nil { return nil, err }

    // 2. Aggregations
    taskStats, err := s.statsRepo.GetProjectStatusBreakdown()
    if err != nil { return nil, err }

    teamStats, err := s.statsRepo.GetTeamPerformance()
    if err != nil { return nil, err }
    
    catStats, err := s.statsRepo.GetCategoryDistribution()
    if err != nil { return nil, err }

    // Ensure slices are not nil (to avoid JSON null)
    if taskStats == nil { taskStats = []domain.ProjectStatusStat{} }
    if teamStats == nil { teamStats = []domain.TeamPerformanceStat{} }
    if catStats == nil { catStats = []domain.CategoryStat{} }

	stats := &AdminStats{
		TotalProjects:   projCount,
		TotalUsers:      userCount,
		TotalTeams:      teamCount,
		ActiveAssigns:   assignCount,
        
        TaskStatusStats:      taskStats,
        TeamPerformanceStats: teamStats,
        CategoryStats:        catStats,
	}
	
	return stats, nil
}

type ManagerStats struct {
    MyTeamCount int64 `json:"my_team_count"`
    AssignedProjects int64 `json:"assigned_projects"`
    CompletionRate float64 `json:"completion_rate"`
}

func (s *StatsService) GetManagerStats(managerID string) (*ManagerStats, error) {
    // Convert to UUID
    mID, err := uuid.Parse(managerID)
    if err != nil {
        return nil, err
    }
    
    // 1. My Team Count
    myTeamCount, err := s.userRepo.GetUserCountByLeaderID(mID)
    if err != nil {
        return nil, err
    }
    
    // 2. Assigned Projects (Assigns managed by this user's team)
    totalAssigns, completedAssigns, err := s.allocationRepo.GetAssignCountByManagerID(mID)
    if err != nil {
        return nil, err
    }
    
    rate := 0.0
    if totalAssigns > 0 {
        rate = (float64(completedAssigns) / float64(totalAssigns)) * 100
    }

    return &ManagerStats{
        MyTeamCount:      myTeamCount,
        AssignedProjects: totalAssigns,
        CompletionRate:   rate,
    }, nil
}

func (s *StatsService) GetUserStats(userID string, projectID string) (*domain.UserTaskStats, error) {
    uID, err := uuid.Parse(userID)
    if err != nil {
        return nil, err
    }
    
    var pID *uuid.UUID
    if projectID != "" {
        if parsedPID, err := uuid.Parse(projectID); err == nil {
            pID = &parsedPID
        }
    }
    
    return s.statsRepo.GetUserTaskStats(uID, pID)
}

// Advanced Stats
func (s *StatsService) GetDetailedStats(projectID string, timeUnit string, userID string) ([]domain.TimeStat, error) {
    if timeUnit == "" { timeUnit = "day" } // Default
    return s.statsRepo.GetDetailedStats(projectID, timeUnit, userID)
}

func (s *StatsService) GetTimeline(projectID string, limit int, userID string) ([]domain.TaskDetail, error) {
    // Wire up to the Repository method that exists
    return s.statsRepo.GetWorkTimeline(projectID, limit, userID)
}
