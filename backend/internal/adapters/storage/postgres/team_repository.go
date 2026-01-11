package postgres

import (
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type TeamRepository interface {
	FindAll() ([]domain.Team, error)
	Create(team *domain.Team) error
}

type teamRepository struct {
	db *gorm.DB
}

func NewTeamRepository(db *gorm.DB) TeamRepository {
	return &teamRepository{db: db}
}

func (r *teamRepository) FindAll() ([]domain.Team, error) {
	var teams []domain.Team
	err := r.db.Find(&teams).Error
	return teams, err
}

func (r *teamRepository) Create(team *domain.Team) error {
	return r.db.Create(team).Error
}
