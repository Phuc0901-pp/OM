package services

import (
	"github.com/phuc/cmms-backend/internal/domain"
)

type StatsService struct {
	projectRepo domain.ProjectRepository
	userRepo    domain.UserRepository
}

func NewStatsService(projectRepo domain.ProjectRepository, userRepo domain.UserRepository) *StatsService {
	return &StatsService{
		projectRepo: projectRepo,
		userRepo:    userRepo,
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
	// 1. Basic Counts (Legacy - Optimize later if needed)
	projects, err := s.projectRepo.GetAllProjects()
	if err != nil { return nil, err }
	
	users, err := s.userRepo.FindAll()
	if err != nil { return nil, err }

	assigns, err := s.projectRepo.GetAllAssigns()
	if err != nil { return nil, err }

    // 2. Aggregations
    taskStats, err := s.projectRepo.GetProjectStatusBreakdown()
    if err != nil { return nil, err }

    teamStats, err := s.projectRepo.GetTeamPerformance()
    if err != nil { return nil, err }
    
    catStats, err := s.projectRepo.GetCategoryDistribution()
    if err != nil { return nil, err }

    // Ensure slices are not nil (to avoid JSON null)
    if taskStats == nil { taskStats = []domain.ProjectStatusStat{} }
    if teamStats == nil { teamStats = []domain.TeamPerformanceStat{} }
    if catStats == nil { catStats = []domain.CategoryStat{} }

	stats := &AdminStats{
		TotalProjects:   int64(len(projects)),
		TotalUsers:      int64(len(users)),
		ActiveAssigns:   int64(len(assigns)),
        
        TaskStatusStats:      taskStats,
        TeamPerformanceStats: teamStats,
        CategoryStats:        catStats,
	}

	// Count Teams
	teamMap := make(map[string]bool)
	for _, u := range users {
		if u.Team != nil {
			teamMap[u.Team.ID.String()] = true
		}
	}
	stats.TotalTeams = int64(len(teamMap))
	
	return stats, nil
}

type ManagerStats struct {
    MyTeamCount int64 `json:"my_team_count"`
    AssignedProjects int64 `json:"assigned_projects"`
    CompletionRate float64 `json:"completion_rate"`
}

func (s *StatsService) GetManagerStats(managerID string) (*ManagerStats, error) {
    // 1. Get Manager's Assignments
    // We need a proper repo method for this, or just filter all assigns (inefficient but works for small app)
    // Using simple filter for MVP
    
    // Fetch all users to count "My Team" (users who have this manager as leader)
    users, err := s.userRepo.FindAll()
    if err != nil {
        return nil, err
    }
    
    myTeamCount := 0
    for _, u := range users {
        if u.Leader != nil && u.Leader.ID.String() == managerID {
            myTeamCount++
        }
    }

    // Fetch assigns to count "Assigned Projects" (projects managed by this manager via their team members?)
    // Or just projects assigned to the manager themselves? 
    // Requirement is ambiguous. Let's assume projects assigned to their team members.
    assigns, err := s.projectRepo.GetAllAssigns()
    if err != nil {
        return nil, err
    }

    assignedProjects := 0
    completedProjects := 0
    
    // Create set of users managed by this manager
    managedUserIDs := make(map[string]bool)
    for _, u := range users {
        if u.Leader != nil && u.Leader.ID.String() == managerID {
            managedUserIDs[u.ID.String()] = true
        }
    }
    
    for _, a := range assigns {
        if managedUserIDs[a.UserID.String()] {
            assignedProjects++
             // Check progress (mock logic as in handler)
             if len(a.DataResult) > 0 {
                 completedProjects++
             }
        }
    }
    
    rate := 0.0
    if assignedProjects > 0 {
        rate = (float64(completedProjects) / float64(assignedProjects)) * 100
    }

    return &ManagerStats{
        MyTeamCount: int64(myTeamCount),
        AssignedProjects: int64(assignedProjects),
        CompletionRate: rate,
    }, nil
}

// Advanced Stats
func (s *StatsService) GetDetailedStats(projectID string, timeUnit string, userID string) ([]domain.TimeStat, error) {
    if timeUnit == "" { timeUnit = "day" } // Default
    return s.projectRepo.GetDetailedStats(projectID, timeUnit, userID)
}

func (s *StatsService) GetTimeline(projectID string, limit int, userID string) ([]domain.TaskDetail, error) {
    if limit <= 0 { limit = 50 }
    return s.projectRepo.GetWorkTimeline(projectID, limit, userID)
}
