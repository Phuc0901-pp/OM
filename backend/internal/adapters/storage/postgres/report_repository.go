package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type ReportRepository struct {
	DB *gorm.DB
}

func NewReportRepository(db *gorm.DB) domain.ReportRepository {
	return &ReportRepository{DB: db}
}

func (r *ReportRepository) Create(report *domain.Report) error {
	return r.DB.Create(report).Error
}

func (r *ReportRepository) FindByID(id uuid.UUID) (*domain.Report, error) {
	var report domain.Report
	err := r.DB.Preload("Assign").Preload("Assign.Project").Preload("Assign.Template").Where("id = ?", id).First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *ReportRepository) FindByAssignID(assignID uuid.UUID) ([]domain.Report, error) {
	var reports []domain.Report
	err := r.DB.Where("id_assign = ?", assignID).Find(&reports).Error
	return reports, err
}

func (r *ReportRepository) Delete(id uuid.UUID) error {
	return r.DB.Delete(&domain.Report{}, id).Error
}
