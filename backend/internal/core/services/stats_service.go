package services

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
)

type StatsService struct {
	statsRepo domain.StatsRepository
}

func NewStatsService(statsRepo domain.StatsRepository) *StatsService {
	return &StatsService{statsRepo: statsRepo}
}

func (s *StatsService) GetManagerStats(managerID uuid.UUID) (*domain.ManagerStats, error) {
	return s.statsRepo.GetManagerDashboardStats(managerID)
}
