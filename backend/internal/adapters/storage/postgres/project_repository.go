package postgres

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// Struct definition remains same
type projectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) domain.ProjectRepository {
	return &projectRepository{db: db}
}

func (r *projectRepository) GetAllProjects() ([]domain.Project, error) {
	var projects []domain.Project
	if err := r.db.Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

func (r *projectRepository) GetProjectByID(id uuid.UUID) (*domain.Project, error) {
    var project domain.Project
    if err := r.db.Where("project_id = ?", id).First(&project).Error; err != nil {
        return nil, err
    }
    return &project, nil
}

func (r *projectRepository) GetAllClassifications() ([]domain.ProjectClassification, error) {
	var classifications []domain.ProjectClassification
	if err := r.db.Find(&classifications).Error; err != nil {
		return nil, err
	}
	return classifications, nil
}

func (r *projectRepository) GetClassificationByID(id uuid.UUID) (*domain.ProjectClassification, error) {
	var c domain.ProjectClassification
	if err := r.db.Where("id = ?", id).First(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *projectRepository) GetAllMainCategories() ([]domain.MainCategory, error) {
	var categories []domain.MainCategory
	if err := r.db.Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *projectRepository) GetChildCategoriesByMainID(mainID uuid.UUID) ([]domain.ChildCategory, error) {
	var categories []domain.ChildCategory
	if err := r.db.Where("id_main_categories = ?", mainID).Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *projectRepository) GetChildCategoriesByStationID(stationID uuid.UUID) ([]domain.ChildCategory, error) {
	var categories []domain.ChildCategory
	if err := r.db.Where("id_station = ?", stationID).Find(&categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}

// func (r *projectRepository) GetCharacteristicsByMainID(mainID uuid.UUID) ([]domain.ProjectCharacteristic, error) {
// 	return nil, nil // API deprecated due to schema change
// }

func (r *projectRepository) GetProjectCharacteristic(projectID uuid.UUID) (*domain.ProjectCharacteristic, error) {
	var char domain.ProjectCharacteristic
	if err := r.db.Where("id_project = ?", projectID).First(&char).Error; err != nil {
		return nil, err
	}
	return &char, nil
}

// Creation support methods
func (r *projectRepository) CreateProject(p *domain.Project) error {
	return r.db.Create(p).Error
}

func (r *projectRepository) UpdateProject(p *domain.Project) error {
    return r.db.Save(p).Error
}

func (r *projectRepository) CreateMainCategory(c *domain.MainCategory) error {
	return r.db.Create(c).Error
}

func (r *projectRepository) CreateChildCategory(c *domain.ChildCategory) error {
	return r.db.Create(c).Error
}

func (r *projectRepository) CreateClassification(c *domain.ProjectClassification) error {
	return r.db.Create(c).Error
}

func (r *projectRepository) CreateAssign(a *domain.Assign) error {
	// Transaction to ensure atomicity
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Create Assign Record
		if err := tx.Create(a).Error; err != nil {
			return err
		}

		// Ensure table exists once
		if !tx.Migrator().HasTable(&domain.TaskDetail{}) {
			if err := tx.Migrator().CreateTable(&domain.TaskDetail{}); err != nil {
				return err
			}
		}

		// Legacy Task Generation from DataWork removed (2026-01-17)
		// Allocation now relies on Station Linking (Option B) or Manual Task Creation.
		
		return nil
	})
}

func (r *projectRepository) GetAssignsByUserID(userID uuid.UUID) ([]domain.Assign, error) {
	var assigns []domain.Assign
	// Preload Classification and TaskDetails (these work normally)
	if err := r.db.Where("id_user = ?", userID).
		Preload("Classification").
		Preload("TaskDetails").
		Preload("TaskDetails.Process").
		Preload("TaskDetails.ChildCategory").
		Preload("TaskDetails.ChildCategory.MainCategory").
		Find(&assigns).Error; err != nil {
		return nil, err
	}
	
	// Manual load for Project (because id_project → project_id is non-standard FK)
	if len(assigns) > 0 {
		// Collect unique project IDs
		projectIDs := make([]uuid.UUID, 0)
		for _, a := range assigns {
			if a.ProjectID != uuid.Nil {
				projectIDs = append(projectIDs, a.ProjectID)
			}
		}
		
		if len(projectIDs) > 0 {
			var projects []domain.Project
			if err := r.db.Where("project_id IN ?", projectIDs).Find(&projects).Error; err == nil {
				// Create map for quick lookup
				projectMap := make(map[uuid.UUID]*domain.Project)
				for i := range projects {
					projectMap[projects[i].ID] = &projects[i]
				}
				// Assign to each
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

func (r *projectRepository) GetAssignByID(id uuid.UUID) (*domain.Assign, error) {
    var assign domain.Assign
    // Don't preload Project here to avoid issues, load manually below
    if err := r.db.Where("id = ?", id).Preload("Classification").Preload("TaskDetails").Preload("TaskDetails.Process").First(&assign).Error; err != nil {
        return nil, err
    }

    // Manually fetch Project to be safe (and handle Unscoped/Deleted projects if needed)
    if assign.ProjectID != uuid.Nil {
        var project domain.Project
        if err := r.db.Unscoped().Where("project_id = ?", assign.ProjectID).First(&project).Error; err == nil {
            assign.Project = &project
        }
    }

    return &assign, nil
}

// UpdateAssignDataResult removed


func (r *projectRepository) CheckProjectExistsInAssign(projectID uuid.UUID) (bool, error) {
    var count int64
    if err := r.db.Model(&domain.Assign{}).Where("id_project = ?", projectID).Count(&count).Error; err != nil {
        return false, err
    }
    return count > 0, nil
}

func (r *projectRepository) GetAssignsByProjectID(projectID uuid.UUID) ([]domain.Assign, error) {
    var assigns []domain.Assign
    if err := r.db.Where("id_project = ?", projectID).Preload("User").Find(&assigns).Error; err != nil {
        return nil, err
    }
    return assigns, nil
}

// UpdateAssign removed (DataWork deprecated)


func (r *projectRepository) GetAllAssigns() ([]domain.Assign, error) {
	var assigns []domain.Assign
	
	// 1. Find Assigns first (without Project preload to avoid GORM confusion)
	if err := r.db.
		Preload("User").
		Preload("Classification").
		Preload("TaskDetails.ChildCategory.MainCategory").
		Preload("TaskDetails.Station").
		Preload("TaskDetails.Process"). // NEW: Preload Process
		Find(&assigns).Error; err != nil {
		return nil, err
	}

	// 2. Manually collect Project IDs
	projectIDs := make([]uuid.UUID, 0)
	for _, a := range assigns {
		projectIDs = append(projectIDs, a.ProjectID)
	}

	// 3. Update Fetch Projects manually
	if len(projectIDs) > 0 {
		var projects []domain.Project
		if err := r.db.Unscoped().Where("project_id IN ?", projectIDs).Find(&projects).Error; err == nil {
			// Create map for fast lookup
			projectMap := make(map[uuid.UUID]*domain.Project)
			for i := range projects {
				projectMap[projects[i].ID] = &projects[i]
			}

			// Attach to assigns
			for i := range assigns {
				if p, ok := projectMap[assigns[i].ProjectID]; ok {
					assigns[i].Project = p
				}
			}
		}
	}

	return assigns, nil
}

func (r *projectRepository) GetDeletedAssigns() ([]domain.Assign, error) {
    var assigns []domain.Assign
    // Use Unscoped to find soft-deleted records where deleted_at IS NOT NULL
    if err := r.db.Unscoped().Where("deleted_at IS NOT NULL").Preload("Project").Preload("User").Preload("Classification").Find(&assigns).Error; err != nil {
        return nil, err
    }
    return assigns, nil
}

func (r *projectRepository) GetDeletedAssignsByUsers(userIDs []uuid.UUID) ([]domain.Assign, error) {
    var assigns []domain.Assign
    if len(userIDs) == 0 {
        return assigns, nil // Return empty if no user IDs provided
    }
    // Use Unscoped to find soft-deleted records filtered by user IDs
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


func (r *projectRepository) DeleteAssign(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
        // Safe check: Only attempt to delete details if table actually exists
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

func (r *projectRepository) HardDeleteAssign(id uuid.UUID) error {
    return r.db.Transaction(func(tx *gorm.DB) error {
        // 1. Permanently delete TaskDetails (if table exists)
        if r.db.Migrator().HasTable(&domain.TaskDetail{}) {
             if err := tx.Unscoped().Delete(&domain.TaskDetail{}, "assign_id = ?", id).Error; err != nil {
                return err
             }
        }
        // 2. Permanently delete Assign
        if err := tx.Unscoped().Delete(&domain.Assign{}, "id = ?", id).Error; err != nil {
            return err
        }
        return nil
    })
}

func (r *projectRepository) RestoreAssign(id uuid.UUID) error {
    // Unscoped() matches even soft-deleted records.
    // Update "deleted_at" to NULL to restore it.
    return r.db.Unscoped().Model(&domain.Assign{}).Where("id = ?", id).Update("deleted_at", nil).Error
}


func (r *projectRepository) CreateCharacteristic(c *domain.ProjectCharacteristic) error {
	return r.db.Create(c).Error
}

func (r *projectRepository) UpdateProjectCharacteristic(projectID uuid.UUID, c *domain.ProjectCharacteristic) error {
	// Check if exists
	var existing domain.ProjectCharacteristic
	err := r.db.Where("id_project = ?", projectID).First(&existing).Error
	
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create new
		c.ProjectID = projectID // Ensure link
		// ID generated by GORM/DB
		return r.db.Create(c).Error
	} else if err != nil {
		return err
	}

	// Update existing
	// We want to update all fields provided in 'c'. 
    // GORM 'Updates' only updates non-zero fields struct. 
    // If 'c' has 0 for some fields and we want to set them to 0, we might need map or Select("*").
    // Based on user screenshot, they want to set quantities (maybe to 0).
    // So we should be careful. 
    // Assuming 'c' comes from JSON binding which might have partial data?
    // Actually, typical use case is "Save Changes" form which sends full data.
    // Let's use Save() on the existing object with new values, or Updates() with care.
    
    // Simplest robust update for full form save:
    c.ID = existing.ID // Preserve ID
    c.ProjectID = projectID
    return r.db.Save(c).Error
}

func (r *projectRepository) DeleteProject(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Get all Assigns for this project
		var assigns []domain.Assign
		if err := tx.Where("id_project = ?", id).Find(&assigns).Error; err != nil {
			return err
		}

		// 2. Delete dependent TaskDetails and Assigns
		for _, a := range assigns {
			// Delete TaskDetails
			if tx.Migrator().HasTable(&domain.TaskDetail{}) {
				if err := tx.Where("assign_id = ?", a.ID).Delete(&domain.TaskDetail{}).Error; err != nil {
					return err
				}
			}
			// Delete Assign
			if err := tx.Delete(&domain.Assign{}, "id = ?", a.ID).Error; err != nil {
				return err
			}
		}

        // 3. Delete Project Characteristics
        if tx.Migrator().HasTable(&domain.ProjectCharacteristic{}) {
             if err := tx.Where("id_project = ?", id).Delete(&domain.ProjectCharacteristic{}).Error; err != nil {
                return err
             }
        }

		// 4. Delete Project
		return tx.Delete(&domain.Project{}, "project_id = ?", id).Error
	})
}

func (r *projectRepository) UpdateMainCategory(id uuid.UUID, name string) error {
	return r.db.Model(&domain.MainCategory{}).Where("id = ?", id).Update("name", name).Error
}

func (r *projectRepository) UpdateTaskDetailCheck(assignID, childID uuid.UUID, index int, checkStatus int) error {
	var tasks []domain.TaskDetail
    // Logic to find the specific item by index via Sorting
    // Since we don't store item_index, we rely on the naming convention (Station X, Inverter Y)
    // Sort by: Length(Station), Station, Length(Inverter), Inverter
    if err := r.db.Where("assign_id = ? AND child_category_id = ?", assignID, childID).
        Order("LENGTH(station_name), station_name, LENGTH(inverter_name), inverter_name").
        Find(&tasks).Error; err != nil {
        return err
    }
    
    // Check bounds
    if index >= 0 && index < len(tasks) {
        task := tasks[index]
        updates := map[string]interface{}{"check": checkStatus}
        
        // If status is Checked (7=Approved), mark as Approved/Reviewed
        if checkStatus == 7 {
             now := time.Now()
             updates["approval_at"] = &now
        }
        
        return r.db.Model(&task).Updates(updates).Error
    }
    
    // If index not found, we don't error, just verify nothing happened? Or warning.
    return nil
}

func (r *projectRepository) UpdateTaskDetailStatus(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&domain.TaskDetail{}).Where("id = ?", id).Updates(updates).Error
}

func (r *projectRepository) UpdateTaskDetailsStatusBulk(ids []uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&domain.TaskDetail{}).Where("id IN ?", ids).Updates(updates).Error
}

func (r *projectRepository) DeleteMainCategory(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Get Child Categories
		var children []domain.ChildCategory
		if err := tx.Where("id_main_categories = ?", id).Find(&children).Error; err != nil {
			return err
		}

		// 2. Delete dependent TaskDetails for each child
		for _, child := range children {
			if tx.Migrator().HasTable(&domain.TaskDetail{}) {
				if err := tx.Where("child_category_id = ?", child.ID).Delete(&domain.TaskDetail{}).Error; err != nil {
					return err
				}
			}
		}

		// 3. Delete Child Categories
		if err := tx.Where("id_main_categories = ?", id).Delete(&domain.ChildCategory{}).Error; err != nil {
			return err
		}

		// 4. Delete Main Category
		return tx.Delete(&domain.MainCategory{}, "id = ?", id).Error
	})
}

func (r *projectRepository) UpdateChildCategory(id uuid.UUID, name string) error {
	// 1. Get current Child Category to find its MainCategoryID
	var currentChild domain.ChildCategory
	if err := r.db.First(&currentChild, id).Error; err != nil {
		return err
	}

	// 2. Check for duplicate name in the same MainCategory (excluding itself)
	var count int64
	if err := r.db.Model(&domain.ChildCategory{}).
		Where("id_main_categories = ? AND name = ? AND id != ?", currentChild.MainCategoryID, name, id).
		Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return errors.New("Sub-category name already exists in this Main Category")
	}

	// 3. Update
	return r.db.Model(&domain.ChildCategory{}).Where("id = ?", id).Update("name", name).Error
}

func (r *projectRepository) DeleteChildCategory(id uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Delete dependent TaskDetails
		if tx.Migrator().HasTable(&domain.TaskDetail{}) {
			if err := tx.Where("child_category_id = ?", id).Delete(&domain.TaskDetail{}).Error; err != nil {
				return err
			}
		}

		// 2. Delete Child Category
		return tx.Delete(&domain.ChildCategory{}, "id = ?", id).Error
	})
}

// --- Statistics Implementations ---

func (r *projectRepository) GetProjectStatusBreakdown() ([]domain.ProjectStatusStat, error) {
    var stats []domain.ProjectStatusStat
    if err := r.db.Model(&domain.TaskDetail{}).
        Select("status, count(*) as count").
        Group("status").
        Scan(&stats).Error; err != nil {
        return nil, err
    }
    return stats, nil
}

func (r *projectRepository) GetTeamPerformance() ([]domain.TeamPerformanceStat, error) {
    var stats []domain.TeamPerformanceStat
    if err := r.db.Model(&domain.User{}).
        Select("\"users\".id as user_id, \"users\".full_name, \"roles\".name as role, count(\"task_details\".id) as tasks_done").
        Joins("JOIN \"assign\" ON \"assign\".id_user = \"users\".id").
        Joins("JOIN \"task_details\" ON \"task_details\".assign_id = \"assign\".id").
        Joins("LEFT JOIN \"roles\" ON \"roles\".id = \"users\".id_role").
        Where("\"task_details\".status = ? OR \"task_details\".accept = ?", "completed", 1).
        Group("\"users\".id, \"users\".full_name, \"roles\".name").
        Order("count(\"task_details\".id) DESC").
        Limit(10).
        Scan(&stats).Error; err != nil {
        return nil, err
    }
    return stats, nil
}

func (r *projectRepository) GetCategoryDistribution() ([]domain.CategoryStat, error) {
    var stats []domain.CategoryStat
    if err := r.db.Model(&domain.TaskDetail{}).
        Select("main_categories.name as category_name, count(task_details.id) as task_count").
        Joins("JOIN child_categories ON child_categories.id = task_details.child_category_id").
        Joins("JOIN main_categories ON main_categories.id = child_categories.id_main_categories").
        Group("main_categories.name").
        Scan(&stats).Error; err != nil {
        return nil, err
    }
    return stats, nil
}

func (r *projectRepository) SyncTaskDetails(assignID uuid.UUID, details []domain.TaskDetail) error {
    return r.db.Transaction(func(tx *gorm.DB) error {
        // 1. Get existing details
        var existingTasks []domain.TaskDetail
        if err := tx.Where("assign_id = ?", assignID).Find(&existingTasks).Error; err != nil {
            return err
        }
        
        // 2. Map existing tasks by ID
        existingMapByID := make(map[uuid.UUID]*domain.TaskDetail)
        for i := range existingTasks {
            existingMapByID[existingTasks[i].ID] = &existingTasks[i]
        }
        
        processedIDs := make(map[uuid.UUID]bool)
        
        // 3. Upsert based on new schema
        for _, d := range details {
            d.AssignID = assignID // Ensure correct assign
            
            if d.ID != uuid.Nil {
                if existing, ok := existingMapByID[d.ID]; ok {
                    // Update existing - preserve approval status if already approved
                    if existing.StatusApprove == 1 {
                        d.StatusApprove = existing.StatusApprove
                        d.ApprovalAt = existing.ApprovalAt
                        d.NoteApproval = existing.NoteApproval
                    }
                    d.CreatedAt = existing.CreatedAt
                    
                    if err := tx.Save(&d).Error; err != nil {
                        return err
                    }
                    processedIDs[d.ID] = true
                    continue
                }
            }
            
            // Insert new
            if err := tx.Create(&d).Error; err != nil {
                return err
            }
            processedIDs[d.ID] = true
        }
        
        // 4. Delete orphans (optional - only delete if explicitly removed)
        // Commented out to preserve task_details that were auto-created from stations
        // for _, t := range existingTasks {
        //     if !processedIDs[t.ID] {
        //         tx.Delete(&t)
        //     }
        // }
        
        return nil
    })
}

func (r *projectRepository) UpdateStationAssignID(stationIDs []uuid.UUID, assignID uuid.UUID) error {
    if len(stationIDs) == 0 {
        return nil
    }
    return r.db.Model(&domain.Station{}).
        Where("id IN ?", stationIDs).
        Update("assign_id", assignID).Error
}

func (r *projectRepository) GetStationIDsByChildConfigIDs(configIDs []uuid.UUID) ([]uuid.UUID, error) {
    if len(configIDs) == 0 {
        return nil, nil
    }
    var stationIDs []uuid.UUID
    // Distinct selection
    err := r.db.Model(&domain.StationChildConfig{}).
        Where("id IN ?", configIDs).
        Distinct("station_id").
        Pluck("station_id", &stationIDs).Error
    return stationIDs, err
}

func (r *projectRepository) GetDetailedStats(projectID string, timeUnit string, userID string) ([]domain.TimeStat, error) {
	// Validate timeUnit to prevent SQL injection
	validUnits := map[string]bool{
		"year": true, "quarter": true, "month": true, "week": true,
		"day": true, "hour": true, "minute": true, "second": true,
	}
	if !validUnits[timeUnit] {
		return nil, errors.New("invalid time unit")
	}

	var stats []domain.TimeStat
	
	// Base query
	query := `
		SELECT 
			to_char(date_trunc(?, task_details.created_at), 'YYYY-MM-DD HH24:MI:SS') as time_point,
			COUNT(*) as assigned,
			SUM(CASE WHEN task_details.status = 'completed' THEN 1 ELSE 0 END) as completed,
			SUM(CASE WHEN task_details.status = 'pending' THEN 1 ELSE 0 END) as in_progress
		FROM task_details
		JOIN assign ON assign.id = task_details.assign_id
		WHERE 1=1
	`
	args := []interface{}{timeUnit}

	if projectID != "" {
		query += " AND assign.id_project = ?"
		args = append(args, projectID)
	}

	if userID != "" {
		query += " AND assign.id_user = ?"
		args = append(args, userID)
	}

	query += `
		GROUP BY 1
		ORDER BY 1 DESC
		LIMIT 100
	`

	if err := r.db.Raw(query, args...).Scan(&stats).Error; err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *projectRepository) GetWorkTimeline(projectID string, limit int, userID string) ([]domain.TaskDetail, error) {
	var tasks []domain.TaskDetail
	
	db := r.db.Model(&domain.TaskDetail{}).
		Preload("Assign.User").
		Preload("Assign.Project").
		Preload("Assign.Classification"). // Added
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory"). // Added
		Where("task_details.status = ?", "completed").
		Order("task_details.submitted_at DESC") // Updated sort order

	// Always join assign to filter by user or project if needed
	db = db.Joins("JOIN assign ON assign.id = task_details.assign_id")

	if projectID != "" {
		db = db.Where("assign.id_project = ?", projectID)
	}

	if userID != "" {
		db = db.Where("assign.id_user = ?", userID)
	}

	if limit > 0 {
		db = db.Limit(limit)
	}

	if err := db.Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}
