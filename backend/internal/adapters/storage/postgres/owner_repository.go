package postgres

import (
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type ownerRepository struct {
	db *gorm.DB
}

func NewOwnerRepository(db *gorm.DB) domain.OwnerRepository {
	return &ownerRepository{db: db}
}

func (r *ownerRepository) Create(owner *domain.Owner) error {
	return r.db.Create(owner).Error
}

func (r *ownerRepository) FindAll() ([]domain.Owner, error) {
	var owners []domain.Owner
	err := r.db.Where("deleted_at IS NULL").Find(&owners).Error
	return owners, err
}

func (r *ownerRepository) FindByID(id uuid.UUID) (*domain.Owner, error) {
	var owner domain.Owner
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&owner).Error
	if err != nil {
		return nil, err
	}
	return &owner, nil
}

func (r *ownerRepository) Update(owner *domain.Owner) error {
	return r.db.Save(owner).Error
}

func (r *ownerRepository) Delete(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&domain.Owner{}).Error
}
