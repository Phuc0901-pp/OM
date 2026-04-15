package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// ---- Process Repository ----

type ProcessRepository struct{ db *gorm.DB }

func NewProcessRepository(db *gorm.DB) *ProcessRepository {
	return &ProcessRepository{db: db}
}

func (r *ProcessRepository) Create(p *domain.Process) error {
	return r.db.Create(p).Error
}

func (r *ProcessRepository) FindAll() ([]domain.Process, error) {
	var items []domain.Process
	err := r.db.Where("deleted_at IS NULL").Order("name ASC").Find(&items).Error
	return items, err
}

func (r *ProcessRepository) FindByID(id uuid.UUID) (*domain.Process, error) {
	var p domain.Process
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&p).Error
	return &p, err
}

func (r *ProcessRepository) Update(p *domain.Process) error {
	return r.db.Save(p).Error
}

func (r *ProcessRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.Process{}).Error
}

// ---- ModelProject Repository ----

type ModelProjectRepository struct{ db *gorm.DB }

func NewModelProjectRepository(db *gorm.DB) *ModelProjectRepository {
	return &ModelProjectRepository{db: db}
}

func (r *ModelProjectRepository) Create(m *domain.ModelProject) error {
	return r.db.Create(m).Error
}

func (r *ModelProjectRepository) FindAll() ([]domain.ModelProject, error) {
	var items []domain.ModelProject
	err := r.db.Where("deleted_at IS NULL").Order("name ASC").Find(&items).Error
	return items, err
}

func (r *ModelProjectRepository) FindByID(id uuid.UUID) (*domain.ModelProject, error) {
	var m domain.ModelProject
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&m).Error
	return &m, err
}

func (r *ModelProjectRepository) Update(m *domain.ModelProject) error {
	return r.db.Save(m).Error
}

func (r *ModelProjectRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.ModelProject{}).Error
}
