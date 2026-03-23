package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type TemplateRepository struct {
	db *gorm.DB
}

func NewTemplateRepository(db *gorm.DB) *TemplateRepository {
	return &TemplateRepository{db: db}
}

func (r *TemplateRepository) Create(template *domain.Template) error {
	return r.db.Create(template).Error
}

func (r *TemplateRepository) FindAll() ([]domain.Template, error) {
	var templates []domain.Template
	if err := r.db.Preload("Project").Preload("ModelProject").Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

func (r *TemplateRepository) FindByID(id uuid.UUID) (*domain.Template, error) {
	var template domain.Template
	if err := r.db.Preload("Project").Preload("ModelProject").First(&template, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &template, nil
}

func (r *TemplateRepository) Update(template *domain.Template) error {
	return r.db.Save(template).Error
}

func (r *TemplateRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&domain.Template{}, "id = ?", id).Error
}
