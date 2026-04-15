package services

import (
	"errors"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
)

type ReportService struct {
	Repo domain.ReportRepository
}

func NewReportService(repo domain.ReportRepository) *ReportService {
	return &ReportService{Repo: repo}
}

func (s *ReportService) CreateReport(r *domain.Report) error {
	if r.AssignID == uuid.Nil {
		return errors.New("AssignID is required")
	}
	if r.Title == "" {
		return errors.New("Title is required")
	}
	return s.Repo.Create(r)
}

func (s *ReportService) GetReport(id uuid.UUID) (*domain.Report, error) {
	return s.Repo.FindByID(id)
}
