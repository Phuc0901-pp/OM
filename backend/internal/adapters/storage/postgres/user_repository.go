package postgres

import (
	"errors"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// UserRepository implements domain.UserRepository


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
	err := r.db.Preload("RoleModel").Preload("Team").Preload("Leader").Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Not found, but not an error
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByID(id uuid.UUID) (*domain.User, error) {
	var user domain.User
	err := r.db.Preload("RoleModel").Preload("Team").Preload("Leader").First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Delete(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Nullify leader_id for subordinates
		if err := tx.Model(&domain.User{}).Where("id_leader = ?", id).Update("id_leader", nil).Error; err != nil {
			return err
		}

		// 2. Delete assigned work (Assigns) and their TaskDetails
		var assigns []domain.Assign
		if err := tx.Where("id_user = ?", id).Find(&assigns).Error; err != nil {
			return err
		}

		for _, a := range assigns {
			// Delete TaskDetails
			if tx.Migrator().HasTable(&domain.TaskDetail{}) {
				if err := tx.Where("assign_id = ?", a.ID).Delete(&domain.TaskDetail{}).Error; err != nil {
					return err
				}
			}
			// Delete Assign (Unscoped to ensure cleanup if hard delete is intended, otherwise soft delete)
            // Here we assume standard delete is soft delete if model supports it, but for cleanup we might want hard delete?
            // The original method was Unscoped().Delete, implying Hard Delete. 
            // Let's stick to Unscoped for consistency with original method.
			if err := tx.Unscoped().Delete(&domain.Assign{}, "id = ?", a.ID).Error; err != nil {
				return err
			}
		}

		// 3. Delete Attendance Records (?) - Optional but good for cleanup
        // If table exists
        // tx.Exec("DELETE FROM attendances WHERE id_user = ?", id)

		// 4. Delete User (Hard Delete as per original)
		return tx.Unscoped().Delete(&domain.User{}, id).Error
	})
}

func (r *userRepository) FindAll() ([]domain.User, error) {
	var users []domain.User
	err := r.db.Preload("RoleModel").Preload("Team").Preload("Leader").Find(&users).Error
	if err != nil {
		return nil, err
	}
	// Populate Role string for each user
	for i := range users {
		if users[i].RoleModel != nil {
			users[i].Role = domain.UserRole(users[i].RoleModel.Name)
		}
	}
	return users, nil
}

func (r *userRepository) UpdateRole(userID uuid.UUID, roleID uuid.UUID) error {
	return r.db.Model(&domain.User{}).Where("id = ?", userID).Update("role_id", roleID).Error
}

func (r *userRepository) UpdateLeader(userID uuid.UUID, leaderID *uuid.UUID) error {
	return r.db.Model(&domain.User{}).Where("id = ?", userID).Update("id_leader", leaderID).Error
}

func (r *userRepository) Update(user *domain.User) error {
	return r.db.Omit("RoleModel", "Team", "Leader").Save(user).Error
}

func (r *userRepository) GetUserByID(id uuid.UUID) (*domain.User, error) {
	// Alias for FindByID to maintain compatibility
	return r.FindByID(id)
}

func (r *userRepository) GetUsersByLeaderID(leaderID uuid.UUID) ([]domain.User, error) {
	var users []domain.User
	if err := r.db.Preload("RoleModel").Preload("Team").Preload("Assigns").Preload("Assigns.Project").Preload("Assigns.TaskDetails").Where("id_leader = ?", leaderID).Find(&users).Error; err != nil {
		return nil, err
	}

	// Populate transient Role field for each user
	for i := range users {
		if users[i].RoleModel != nil {
			users[i].Role = domain.UserRole(users[i].RoleModel.Name)
		}
	}

	return users, nil
}

func (r *userRepository) GetDB() *gorm.DB {
	return r.db
}

// Optimized Method Implementations

func (r *userRepository) GetUserCount() (int64, error) {
    var count int64
    if err := r.db.Model(&domain.User{}).Count(&count).Error; err != nil {
        return 0, err
    }
    return count, nil
}

func (r *userRepository) GetUserCountByLeaderID(leaderID uuid.UUID) (int64, error) {
    var count int64
    if err := r.db.Model(&domain.User{}).Where("id_leader = ?", leaderID).Count(&count).Error; err != nil {
        return 0, err
    }
    return count, nil
}

func (r *userRepository) GetTeamCount() (int64, error) {
    // Count distinct teams used by users
    var count int64
    // Using Distinct on id_team might be what is needed if we count "Active Teams" or just all teams from teams table?
    // "Total Teams" stats logic was: count unique team_ids from all users.
    if err := r.db.Model(&domain.User{}).Distinct("id_team").Where("id_team IS NOT NULL").Count(&count).Error; err != nil {
        return 0, err
    }
    return count, nil
}
