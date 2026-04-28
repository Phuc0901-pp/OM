package postgres

import (
	"errors"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) domain.UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(user *domain.User) error {
	return r.db.Create(user).Error
}

func (r *userRepository) FindByEmail(email string) (*domain.User, error) {
	var user domain.User
	err := r.db.Preload("RoleModel").Preload("Team").Preload("PersonCreated").Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByID(id uuid.UUID) (*domain.User, error) {
	var user domain.User
	err := r.db.Preload("RoleModel").Preload("Team").Preload("PersonCreated").First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// FindByIDUnscoped - Tìm user kể cả đã bị soft-delete (dùng cho gán PersonCreatedID)
func (r *userRepository) FindByIDUnscoped(id uuid.UUID) (*domain.User, error) {
	var user domain.User
	err := r.db.Unscoped().First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetUserByID(id uuid.UUID) (*domain.User, error) {
	return r.FindByID(id)
}

func (r *userRepository) Delete(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Soft delete the user
		return tx.Delete(&domain.User{}, "id = ?", id).Error
	})
}

func (r *userRepository) FindAll() ([]domain.User, error) {
	var users []domain.User
	err := r.db.Preload("RoleModel").Preload("Team").Preload("PersonCreated").Where("deleted_at IS NULL").Find(&users).Error
	if err != nil {
		return nil, err
	}
	// Populate transient RoleName field for each user
	for i := range users {
		if users[i].RoleModel != nil {
			users[i].RoleName = domain.UserRole(users[i].RoleModel.Name)
		}
	}
	return users, nil
}

func (r *userRepository) UpdateRole(userID uuid.UUID, roleID uuid.UUID) error {
	return r.db.Model(&domain.User{}).Where("id = ?", userID).Update("id_role", roleID).Error
}

func (r *userRepository) Update(user *domain.User) error {
	return r.db.Omit("RoleModel", "Team", "PersonCreated").Save(user).Error
}

func (r *userRepository) UpdateStatus(userID uuid.UUID, status int) error {
	return r.db.Model(&domain.User{}).Where("id = ?", userID).Update("status_user", status).Error
}

func (r *userRepository) GetUserCount() (int64, error) {
	var count int64
	if err := r.db.Model(&domain.User{}).Where("deleted_at IS NULL").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *userRepository) GetTeamCount() (int64, error) {
	var count int64
	if err := r.db.Model(&domain.Team{}).Where("deleted_at IS NULL").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *userRepository) GetDB() *gorm.DB {
	return r.db
}

// FindAllDeleted - trả về danh sách User đã bị soft-delete (thùng rác)
func (r *userRepository) FindAllDeleted() ([]domain.User, error) {
	var users []domain.User
	err := r.db.Preload("RoleModel").Preload("Team").Unscoped().Where("deleted_at IS NOT NULL").Order("deleted_at DESC").Find(&users).Error
	if err != nil {
		return nil, err
	}
	for i := range users {
		if users[i].RoleModel != nil {
			users[i].RoleName = domain.UserRole(users[i].RoleModel.Name)
		}
	}
	return users, nil
}

// Restore
func (r *userRepository) Restore(id uuid.UUID) error {
	return r.db.Unscoped().Model(&domain.User{}).Where("id = ?", id).Update("deleted_at", nil).Error
}

// PermanentDelete
func (r *userRepository) PermanentDelete(id uuid.UUID) error {
	return r.db.Unscoped().Where("id = ?", id).Delete(&domain.User{}).Error
}

// BulkRestore - khôi phục nhiều người dùng cùng lúc
func (r *userRepository) BulkRestore(ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Unscoped().Model(&domain.User{}).Where("id IN ?", ids).Update("deleted_at", nil).Error
}

// BulkPermanentDelete - xóa vĩnh viễn nhiều User cùng lúc
func (r *userRepository) BulkPermanentDelete(ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Unscoped().Where("id IN ?", ids).Delete(&domain.User{}).Error
}
