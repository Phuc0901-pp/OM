package postgres

import (
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type RoleRepository interface {
	FindAll() ([]domain.Role, error)
	Create(role *domain.Role) error
}

type roleRepository struct {
	db *gorm.DB
}

func NewRoleRepository(db *gorm.DB) RoleRepository {
	return &roleRepository{db: db}
}

func (r *roleRepository) FindAll() ([]domain.Role, error) {
	var roles []domain.Role
	err := r.db.Find(&roles).Error
	return roles, err
}

func (r *roleRepository) Create(role *domain.Role) error {
	return r.db.Create(role).Error
}
