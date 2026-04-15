package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// ---- Config Repository ----

type configRepository struct{ db *gorm.DB }

func NewConfigRepository(db *gorm.DB) domain.ConfigRepository {
	return &configRepository{db: db}
}

func (r *configRepository) Create(config *domain.Config) error {
	return r.db.Create(config).Error
}

func (r *configRepository) FindAll() ([]domain.Config, error) {
	var configs []domain.Config
	err := r.db.Preload("Asset").Preload("SubWork").
		Where("deleted_at IS NULL").Order("created_at DESC").Find(&configs).Error
	return configs, err
}

func (r *configRepository) FindByAssetID(assetID uuid.UUID) ([]domain.Config, error) {
	var configs []domain.Config
	err := r.db.Preload("Asset").Preload("SubWork").
		Where("id_asset = ? AND deleted_at IS NULL", assetID).
		Order("created_at ASC").Find(&configs).Error
	return configs, err
}

func (r *configRepository) FindByProjectID(projectID uuid.UUID) ([]domain.Config, error) {
	var configs []domain.Config
	err := r.db.Preload("Asset").Preload("SubWork").
		Joins("JOIN assets ON assets.id = configs.id_asset AND assets.deleted_at IS NULL").
		Where("assets.id_project = ? AND configs.deleted_at IS NULL", projectID).
		Order("configs.created_at ASC").Find(&configs).Error
	return configs, err
}

func (r *configRepository) FindByID(id uuid.UUID) (*domain.Config, error) {
	var config domain.Config
	err := r.db.Preload("Asset").Preload("SubWork").
		Where("id = ? AND deleted_at IS NULL", id).First(&config).Error
	return &config, err
}

func (r *configRepository) Update(config *domain.Config) error {
	return r.db.Save(config).Error
}

func (r *configRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.Config{}).Error
}
