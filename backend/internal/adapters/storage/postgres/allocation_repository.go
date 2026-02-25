package postgres

import (

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type allocationRepository struct {
	db *gorm.DB
}

func NewAllocationRepository(db *gorm.DB) domain.AllocationRepository {
	return &allocationRepository{db: db}
}

func (r *allocationRepository) CreateAssign(a *domain.Assign) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(a).Error; err != nil {
			return err
		}
		if !tx.Migrator().HasTable(&domain.TaskDetail{}) {
			if err := tx.Migrator().CreateTable(&domain.TaskDetail{}); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *allocationRepository) GetAssignByID(id uuid.UUID) (*domain.Assign, error) {
    var assign domain.Assign
    if err := r.db.Where("id = ?", id).Preload("Classification").Preload("TaskDetails").Preload("TaskDetails.Process").First(&assign).Error; err != nil {
        return nil, err
    }
    if assign.ProjectID != uuid.Nil {
        var project domain.Project
        if err := r.db.Unscoped().Where("project_id = ?", assign.ProjectID).First(&project).Error; err == nil {
            assign.Project = &project
        }
    }
    return &assign, nil
}

func (r *allocationRepository) GetAllAssigns() ([]domain.Assign, error) {
	var assigns []domain.Assign
	if err := r.db.
		Preload("User").
		Preload("Classification").
		Preload("TaskDetails.ChildCategory.MainCategory").
		Preload("TaskDetails.Station").
		Preload("TaskDetails.Process").
		Find(&assigns).Error; err != nil {
		return nil, err
	}

	projectIDs := make([]uuid.UUID, 0)
	for _, a := range assigns {
		projectIDs = append(projectIDs, a.ProjectID)
	}

	if len(projectIDs) > 0 {
		var projects []domain.Project
		if err := r.db.Unscoped().Where("project_id IN ?", projectIDs).Find(&projects).Error; err == nil {
			projectMap := make(map[uuid.UUID]*domain.Project)
			for i := range projects {
				projectMap[projects[i].ID] = &projects[i]
			}
			for i := range assigns {
				if p, ok := projectMap[assigns[i].ProjectID]; ok {
					assigns[i].Project = p
				}
			}
		}
	}
	return assigns, nil
}

func (r *allocationRepository) GetAssignsByUserID(userID uuid.UUID, projectID *uuid.UUID) ([]domain.Assign, error) {
	var assigns []domain.Assign
	
	db := r.db.Where("id_user = ?", userID).
		Preload("Classification").
		Preload("TaskDetails").
		Preload("TaskDetails.Process").
		Preload("TaskDetails.ChildCategory").
		Preload("TaskDetails.ChildCategory.MainCategory").
		Preload("TaskDetails.ChildCategory.Station").
		Preload("TaskDetails.Station")

	if projectID != nil {
		db = db.Where("id_project = ?", projectID)
	}

	if err := db.Find(&assigns).Error; err != nil {
		return nil, err
	}
	
	if len(assigns) > 0 {
		projectIDs := make([]uuid.UUID, 0)
		for _, a := range assigns {
			if a.ProjectID != uuid.Nil {
				projectIDs = append(projectIDs, a.ProjectID)
			}
		}
		if len(projectIDs) > 0 {
			var projects []domain.Project
			if err := r.db.Where("project_id IN ?", projectIDs).Find(&projects).Error; err == nil {
				projectMap := make(map[uuid.UUID]*domain.Project)
				for i := range projects {
					projectMap[projects[i].ID] = &projects[i]
				}
				for i := range assigns {
					if p, ok := projectMap[assigns[i].ProjectID]; ok {
						assigns[i].Project = p
					}
				}
			}
		}
	}
	return assigns, nil
}

func (r *allocationRepository) GetAssignsByProjectID(projectID uuid.UUID) ([]domain.Assign, error) {
    var assigns []domain.Assign
    if err := r.db.Where("id_project = ?", projectID).Preload("User").Find(&assigns).Error; err != nil {
        return nil, err
    }
    return assigns, nil
}

func (r *allocationRepository) CheckProjectExistsInAssign(projectID uuid.UUID) (bool, error) {
    var count int64
    if err := r.db.Model(&domain.Assign{}).Where("id_project = ?", projectID).Count(&count).Error; err != nil {
        return false, err
    }
    return count > 0, nil
}

func (r *allocationRepository) UpdateStationAssignID(stationIDs []uuid.UUID, assignID uuid.UUID) error {
    if len(stationIDs) == 0 {
        return nil
    }
    return r.db.Model(&domain.Station{}).
        Where("id IN ?", stationIDs).
        Update("assign_id", assignID).Error
}

func (r *allocationRepository) DeleteAssign(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
        if r.db.Migrator().HasTable(&domain.TaskDetail{}) {
            if err := tx.Delete(&domain.TaskDetail{}, "assign_id = ?", id).Error; err != nil {
                return err
            }
        }
		if err := tx.Delete(&domain.Assign{}, "id = ?", id).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *allocationRepository) HardDeleteAssign(id uuid.UUID) error {
    return r.db.Transaction(func(tx *gorm.DB) error {
        if r.db.Migrator().HasTable(&domain.TaskDetail{}) {
             if err := tx.Unscoped().Delete(&domain.TaskDetail{}, "assign_id = ?", id).Error; err != nil {
                return err
             }
        }
        if err := tx.Unscoped().Delete(&domain.Assign{}, "id = ?", id).Error; err != nil {
            return err
        }
        return nil
    })
}

func (r *allocationRepository) GetDeletedAssigns() ([]domain.Assign, error) {
    var assigns []domain.Assign
    if err := r.db.Unscoped().Where("deleted_at IS NOT NULL").
        Preload("Project", func(db *gorm.DB) *gorm.DB {
            return db.Unscoped()
        }).
        Preload("User").
        Preload("Classification").
        Find(&assigns).Error; err != nil {
        return nil, err
    }
    return assigns, nil
}

func (r *allocationRepository) GetDeletedAssignsByUsers(userIDs []uuid.UUID) ([]domain.Assign, error) {
    var assigns []domain.Assign
    if len(userIDs) == 0 {
        return assigns, nil
    }
    if err := r.db.Unscoped().
        Where("deleted_at IS NOT NULL").
        Where("id_user IN ?", userIDs).
        Preload("Project").
        Preload("User").
        Preload("Classification").
        Find(&assigns).Error; err != nil {
        return nil, err
    }
    return assigns, nil
}

func (r *allocationRepository) RestoreAssign(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Restore the parameters (TaskDetails)
		if err := tx.Unscoped().Model(&domain.TaskDetail{}).
			Where("assign_id = ?", id).
			Update("deleted_at", nil).Error; err != nil {
			return err
		}

		// 2. Restore the Assignment
		if err := tx.Unscoped().Model(&domain.Assign{}).
			Where("id = ?", id).
			Update("deleted_at", nil).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *allocationRepository) GetAssignCount() (int64, error) {
    var count int64
    if err := r.db.Model(&domain.Assign{}).Count(&count).Error; err != nil {
        return 0, err
    }
    return count, nil
}

func (r *allocationRepository) GetAssignCountByManagerID(managerID uuid.UUID) (total int64, completed int64, err error) {
	var subUserIDs []uuid.UUID
	if err := r.db.Model(&domain.User{}).Where("id_leader = ?", managerID).Pluck("id", &subUserIDs).Error; err != nil {
		return 0, 0, err
	}

	if len(subUserIDs) == 0 {
		return 0, 0, nil
	}

	if err := r.db.Model(&domain.Assign{}).Where("id_user IN ?", subUserIDs).Count(&total).Error; err != nil {
		return 0, 0, err
	}

	completed = total 
	return total, completed, nil
}

func (r *allocationRepository) SyncTaskDetails(assignID uuid.UUID, details []domain.TaskDetail) error {
    return r.db.Transaction(func(tx *gorm.DB) error {
        // 1. Get existing details
        var existingTasks []domain.TaskDetail
        if err := tx.Where("assign_id = ?", assignID).Find(&existingTasks).Error; err != nil {
            return err
        }
        
        existingMapByID := make(map[uuid.UUID]*domain.TaskDetail)
        for i := range existingTasks {
            existingMapByID[existingTasks[i].ID] = &existingTasks[i]
        }
        
        for _, d := range details {
            d.AssignID = assignID
            
            if d.ID != uuid.Nil {
                if existing, ok := existingMapByID[d.ID]; ok {
                    if existing.StatusApprove == 1 {
                        d.StatusApprove = existing.StatusApprove
                        d.ApprovalAt = existing.ApprovalAt
                        d.NoteApproval = existing.NoteApproval
                    }
                    d.CreatedAt = existing.CreatedAt
                    
                    if err := tx.Save(&d).Error; err != nil {
                        return err
                    }
                    continue
                }
            }
            
            if err := tx.Create(&d).Error; err != nil {
                return err
            }
        }
        return nil
    })
}

func (r *allocationRepository) UpdateTaskDetailCheck(assignID, childID uuid.UUID, index int, checkStatus int) error {
    return nil
}

func (r *allocationRepository) UpdateTaskDetailStatus(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&domain.TaskDetail{}).Where("id = ?", id).Updates(updates).Error
}

func (r *allocationRepository) UpdateTaskDetailsStatusBulk(ids []uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&domain.TaskDetail{}).Where("id IN ?", ids).Updates(updates).Error
}

func (r *allocationRepository) GetStationIDsByChildConfigIDs(configIDs []uuid.UUID) ([]uuid.UUID, error) {
    if len(configIDs) == 0 {
        return nil, nil
    }
    var stationIDs []uuid.UUID
    err := r.db.Model(&domain.StationChildConfig{}).
        Where("id IN ?", configIDs).
        Distinct("station_id").
        Pluck("station_id", &stationIDs).Error
    return stationIDs, err
}
