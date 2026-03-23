package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// ---- Asset Repository ----

type assetRepository struct{ db *gorm.DB }

func NewAssetRepository(db *gorm.DB) domain.AssetRepository {
	return &assetRepository{db: db}
}

func (r *assetRepository) Create(asset *domain.Asset) error {
	return r.db.Create(asset).Error
}

func (r *assetRepository) FindAll() ([]domain.Asset, error) {
	var assets []domain.Asset
	err := r.db.Preload("Project").Where("deleted_at IS NULL").Order("created_at DESC").Find(&assets).Error
	return assets, err
}

func (r *assetRepository) FindByProjectID(projectID uuid.UUID) ([]domain.Asset, error) {
	var assets []domain.Asset
	err := r.db.Where("id_project = ? AND deleted_at IS NULL", projectID).Order("name ASC").Find(&assets).Error
	return assets, err
}

func (r *assetRepository) FindByID(id uuid.UUID) (*domain.Asset, error) {
	var asset domain.Asset
	err := r.db.Preload("Project").Where("id = ? AND deleted_at IS NULL", id).First(&asset).Error
	return &asset, err
}

func (r *assetRepository) Update(asset *domain.Asset) error {
	return r.db.Save(asset).Error
}

func (r *assetRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.Asset{}).Error
}

func (r *assetRepository) FindDeleted() ([]domain.Asset, error) {
	var assets []domain.Asset
	err := r.db.Unscoped().Preload("Project").Where("deleted_at IS NOT NULL").Order("deleted_at DESC").Find(&assets).Error
	return assets, err
}

func (r *assetRepository) Restore(id uuid.UUID) error {
	return r.db.Unscoped().Model(&domain.Asset{}).Where("id = ?", id).Update("deleted_at", nil).Error
}

func (r *assetRepository) HardDelete(id uuid.UUID) error {
	return r.db.Unscoped().Where("id = ?", id).Delete(&domain.Asset{}).Error
}

// ---- Work Repository ----

type workRepository struct{ db *gorm.DB }

func NewWorkRepository(db *gorm.DB) domain.WorkRepository {
	return &workRepository{db: db}
}

func (r *workRepository) Create(work *domain.Work) error {
	return r.db.Create(work).Error
}

func (r *workRepository) FindAll() ([]domain.Work, error) {
	var works []domain.Work
	err := r.db.Preload("SubWorks").Where("deleted_at IS NULL").Order("created_at DESC").Find(&works).Error
	return works, err
}



func (r *workRepository) FindByID(id uuid.UUID) (*domain.Work, error) {
	var work domain.Work
	err := r.db.Preload("SubWorks").Where("id = ? AND deleted_at IS NULL", id).First(&work).Error
	return &work, err
}

func (r *workRepository) Update(work *domain.Work) error {
	return r.db.Save(work).Error
}

func (r *workRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.Work{}).Error
}

func (r *workRepository) FindDeleted() ([]domain.Work, error) {
	var works []domain.Work
	err := r.db.Unscoped().Where("deleted_at IS NOT NULL").Order("deleted_at DESC").Find(&works).Error
	return works, err
}

func (r *workRepository) Restore(id uuid.UUID) error {
	return r.db.Unscoped().Model(&domain.Work{}).Where("id = ?", id).Update("deleted_at", nil).Error
}

func (r *workRepository) HardDelete(id uuid.UUID) error {
	// Need to handle cascading sub-works if necessary, but HardDelete implies manual cleanup or db CASCADE
	return r.db.Unscoped().Where("id = ?", id).Delete(&domain.Work{}).Error
}

// ---- SubWork Repository ----

type subWorkRepository struct{ db *gorm.DB }

func NewSubWorkRepository(db *gorm.DB) domain.SubWorkRepository {
	return &subWorkRepository{db: db}
}

func (r *subWorkRepository) Create(subWork *domain.SubWork) error {
	return r.db.Create(subWork).Error
}

func (r *subWorkRepository) FindAll() ([]domain.SubWork, error) {
	var subWorks []domain.SubWork
	err := r.db.Preload("Work").Where("deleted_at IS NULL").Order("created_at DESC").Find(&subWorks).Error
	return subWorks, err
}

func (r *subWorkRepository) FindByWorkID(workID uuid.UUID) ([]domain.SubWork, error) {
	var subWorks []domain.SubWork
	err := r.db.Where("id_work = ? AND deleted_at IS NULL", workID).Order("created_at ASC").Find(&subWorks).Error
	return subWorks, err
}

func (r *subWorkRepository) FindByID(id uuid.UUID) (*domain.SubWork, error) {
	var subWork domain.SubWork
	err := r.db.Preload("Work").Where("id = ? AND deleted_at IS NULL", id).First(&subWork).Error
	return &subWork, err
}

func (r *subWorkRepository) Update(subWork *domain.SubWork) error {
	return r.db.Save(subWork).Error
}

func (r *subWorkRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.SubWork{}).Error
}

func (r *subWorkRepository) FindDeleted() ([]domain.SubWork, error) {
	var subWorks []domain.SubWork
	err := r.db.Unscoped().Preload("Work").Where("deleted_at IS NOT NULL").Order("deleted_at DESC").Find(&subWorks).Error
	return subWorks, err
}

func (r *subWorkRepository) Restore(id uuid.UUID) error {
	return r.db.Unscoped().Model(&domain.SubWork{}).Where("id = ?", id).Update("deleted_at", nil).Error
}

func (r *subWorkRepository) HardDelete(id uuid.UUID) error {
	return r.db.Unscoped().Where("id = ?", id).Delete(&domain.SubWork{}).Error
}
