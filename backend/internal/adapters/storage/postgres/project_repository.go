package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// ---- Project Repository (V2) ----

type projectRepositoryV2 struct{ db *gorm.DB }

func NewProjectRepository(db *gorm.DB) domain.ProjectRepository {
	return &projectRepositoryV2{db: db}
}

func (r *projectRepositoryV2) Create(project *domain.Project) error {
	return r.db.Create(project).Error
}

func (r *projectRepositoryV2) FindAll() ([]domain.Project, error) {
	var projects []domain.Project
	err := r.db.Preload("Owner").Where("deleted_at IS NULL").Order("created_at DESC").Find(&projects).Error
	return projects, err
}

func (r *projectRepositoryV2) FindByID(id uuid.UUID) (*domain.Project, error) {
	var project domain.Project
	err := r.db.Preload("Owner").Where("id = ? AND deleted_at IS NULL", id).First(&project).Error
	return &project, err
}

func (r *projectRepositoryV2) Update(project *domain.Project) error {
	return r.db.Save(project).Error
}

func (r *projectRepositoryV2) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.Project{}).Error
}

// FindAllDeleted - trả về danh sách dự án đã bị soft-delete (thùng rác)
func (r *projectRepositoryV2) FindAllDeleted() ([]domain.Project, error) {
	var projects []domain.Project
	err := r.db.Preload("Owner").Unscoped().Where("deleted_at IS NOT NULL").Order("deleted_at DESC").Find(&projects).Error
	return projects, err
}

// Restore - xóa cột deleted_at để khôi phục một dự án
func (r *projectRepositoryV2) Restore(id uuid.UUID) error {
	return r.db.Unscoped().Model(&domain.Project{}).Where("id = ?", id).Updates(map[string]interface{}{
		"deleted_at": nil,
	}).Error
}

// PermanentDelete - xóa vĩnh viễn khỏi DB (Hard Delete)
func (r *projectRepositoryV2) PermanentDelete(id uuid.UUID) error {
	return r.db.Unscoped().Where("id = ?", id).Delete(&domain.Project{}).Error
}

// BulkRestore - khôi phục nhiều dự án cùng lúc
func (r *projectRepositoryV2) BulkRestore(ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Unscoped().Model(&domain.Project{}).Where("id IN ?", ids).Updates(map[string]interface{}{
		"deleted_at": nil,
	}).Error
}

// BulkPermanentDelete - xóa vĩnh viễn nhiều dự án cùng lúc
func (r *projectRepositoryV2) BulkPermanentDelete(ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Unscoped().Where("id IN ?", ids).Delete(&domain.Project{}).Error
}
