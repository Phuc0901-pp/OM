package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage" // Ensure imported
	"gorm.io/gorm"
)

type AllocationHandler struct {
	ProjectRepo         domain.ProjectRepository
	UserRepo            domain.UserRepository
	StationRepo         domain.StationRepository 
	AssignmentService   *services.AssignmentService
	NotificationService *services.NotificationService
	DB                  *gorm.DB
	MinioClient         *storage.MinioClient // NEW
}

func NewAllocationHandler(
	projectRepo domain.ProjectRepository,
	userRepo domain.UserRepository,
	stationRepo domain.StationRepository, // NEW
	assignmentService *services.AssignmentService,
	notificationService *services.NotificationService,
	db *gorm.DB,
	minioClient *storage.MinioClient, // NEW
) *AllocationHandler {
	return &AllocationHandler{
		ProjectRepo:         projectRepo,
		UserRepo:            userRepo,
		StationRepo:         stationRepo,
		AssignmentService:   assignmentService,
		NotificationService: notificationService,
		DB:                  db,
		MinioClient:         minioClient,
	}
}

// CreateAllocation handles POST /allocations
// Creates task_details ONLY for selected station_child_config_ids from frontend
func (h *AllocationHandler) CreateAllocation(c *gin.Context) {
	type AllocationRequest struct {
		domain.Assign
		UserIDs               []uuid.UUID `json:"user_ids"`                 // Accept multiple users
		StationChildConfigIDs []uuid.UUID `json:"station_child_config_ids"` // Selected configs from UI
	}
	var req AllocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Basic validation
	if req.ProjectID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID is required"})
		return
	}

	if len(req.UserIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one user must be selected"})
		return
	}

	// Fetch selected StationChildConfigs (only the ones user selected)
	var selectedConfigs []domain.StationChildConfig
	if len(req.StationChildConfigIDs) > 0 {
		if err := h.DB.Preload("Station").Where("id IN ?", req.StationChildConfigIDs).Find(&selectedConfigs).Error; err != nil {
			log.Printf("Failed to fetch selected configs: %v", err)
		}
	}

	// Create assignment for each user
	var created []domain.Assign
	for _, uid := range req.UserIDs {
		newAssign := req.Assign // Copy base fields
		newAssign.ID = uuid.New()
		newAssign.UserID = uid
		
		if err := h.ProjectRepo.CreateAssign(&newAssign); err != nil {
			log.Printf("Failed to assign to user %s: %v", uid, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create assignment for user " + uid.String()})
			return
		}
		
		// Create task_details ONLY for selected configs
		// ONE TaskDetail per process_id in the array
		var taskDetailsCreated int
		for _, config := range selectedConfigs {
			// Link station to this assignment
			if config.StationID != uuid.Nil {
				h.DB.Model(&domain.Station{}).Where("id = ?", config.StationID).Update("assign_id", newAssign.ID)
			}
			
			// Extract ALL process_ids from ProcessIDs JSON array
			var processIDs []string
			if config.ProcessIDs != nil {
				json.Unmarshal(config.ProcessIDs, &processIDs)
			}
			
			// If no process_ids, create one TaskDetail without process_id
			if len(processIDs) == 0 {
				taskDetail := domain.TaskDetail{
					AssignID:         newAssign.ID,
					StationID:        &config.StationID,
					ChildCategoryID:  &config.ChildCategoryID,
					ProcessID:        nil,
					ProjectStartTime: req.StartTime,
					ProjectEndTime:   req.EndTime,
					DataNote:         req.Note,
					StatusWork:       0,
					StatusSubmit:     0,
					StatusApprove:    0,
				}
				if err := h.DB.Create(&taskDetail).Error; err != nil {
					log.Printf("Failed to create task_detail for config %s: %v", config.ID, err)
				} else {
					taskDetailsCreated++
				}
			} else {
				// Create ONE TaskDetail per process_id
				for _, pidStr := range processIDs {
					var processID *uuid.UUID
					if pid, err := uuid.Parse(pidStr); err == nil {
						processID = &pid
					}
					
					taskDetail := domain.TaskDetail{
						AssignID:         newAssign.ID,
						StationID:        &config.StationID,
						ChildCategoryID:  &config.ChildCategoryID,
						ProcessID:        processID,
						ProjectStartTime: req.StartTime,
						ProjectEndTime:   req.EndTime,
						DataNote:         req.Note,
						StatusWork:       0,
						StatusSubmit:     0,
						StatusApprove:    0,
					}
					if err := h.DB.Create(&taskDetail).Error; err != nil {
						log.Printf("Failed to create task_detail for config %s, process %s: %v", config.ID, pidStr, err)
					} else {
						taskDetailsCreated++
					}
				}
			}
		}
		log.Printf("Created %d task_details for assign %s (from %d selected configs)", taskDetailsCreated, newAssign.ID, len(req.StationChildConfigIDs))
		
		created = append(created, newAssign)

		// NOTIFICATION
		user, err := h.UserRepo.FindByID(uid)
		if err == nil && user != nil {
			// demind Project Name
			pName := "Unknown Project"
			if proj, err := h.ProjectRepo.GetProjectByID(req.ProjectID); err == nil {
				pName = proj.ProjectName
			}

			if req.ProjectClassificationID != uuid.Nil {
				if cls, err := h.ProjectRepo.GetClassificationByID(req.ProjectClassificationID); err == nil {
					pName = fmt.Sprintf("%s (%s)", pName, cls.Name)
				}
			}
			// Call Service
			h.NotificationService.NotifyAssignment(user, pName)
		}
	}

	c.JSON(http.StatusCreated, created)
}

// DeleteAllocation handles DELETE /allocations/:id
func (h *AllocationHandler) DeleteAllocation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Allocation ID"})
		return
	}

	if err := h.ProjectRepo.DeleteAssign(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Allocation deleted successfully"})
}

// HardDeleteAllocation handles DELETE /allocations/:id/permanent
func (h *AllocationHandler) HardDeleteAllocation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Allocation ID"})
		return
	}

	if err := h.ProjectRepo.HardDeleteAssign(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Allocation permanently deleted"})
}

// CheckAllocation handles GET /allocations/check/:projectId
func (h *AllocationHandler) CheckAllocation(c *gin.Context) {
	idStr := c.Param("projectId")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Project ID"})
		return
	}
	exists, err := h.ProjectRepo.CheckProjectExistsInAssign(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"exists": exists})
}

// GetAllAllocations handles GET /allocations
func (h *AllocationHandler) GetAllAllocations(c *gin.Context) {
	assigns, err := h.ProjectRepo.GetAllAssigns()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch allocations"})
		return
	}
	
	// Legacy DataWork sync removed.
	c.JSON(http.StatusOK, assigns)
}

// GetUserAllocations handles GET /allocations/user/:id
func (h *AllocationHandler) GetUserAllocations(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid User ID"})
		return
	}
	assigns, err := h.ProjectRepo.GetAssignsByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Legacy DataWork sync removed.
	c.JSON(http.StatusOK, assigns)
}

// UpdateProgress handles PUT /allocations/:id/progress
func (h *AllocationHandler) UpdateProgress(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Endpoint deprecated. Uses Station Monitoring."})
}

// SyncProgress handles POST /allocations/:id/sync
func (h *AllocationHandler) SyncProgress(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Endpoint deprecated."})
}

// GetHistory handles GET /allocations/history
func (h *AllocationHandler) GetHistory(c *gin.Context) {
	// log.Println("DEBUG: HISTORY ENDPOINT HIT")
	var assigns []domain.Assign

	// Get all deleted assigns
	assigns, err := h.ProjectRepo.GetDeletedAssigns()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type DeletedAssignDTO struct {
		ID      uuid.UUID `json:"id"`
		Project struct {
			ProjectName string `json:"project_name"`
			Location    string `json:"location"`
		} `json:"project"`
		User           domain.User `json:"user"`
		Classification struct {
			Name string `json:"name"`
		} `json:"classification"`
		DeletedAt time.Time `json:"deleted_at"`
	}

	var result []DeletedAssignDTO

	// We also fetch all projects to manually look up if Preload failed
	projects, _ := h.ProjectRepo.GetAllProjects()
	projMap := make(map[uuid.UUID]domain.Project)
	for _, p := range projects {
		projMap[p.ID] = p
	}

	for _, a := range assigns {
		dto := DeletedAssignDTO{
			ID:        a.ID,
			User:      *a.User,
			DeletedAt: a.DeletedAt.Time,
		}

		// Resolve Project Name
		pName := "Unknown Project"
		pLoc := "N/A"

		if a.Project != nil {
			pName = a.Project.ProjectName
			pLoc = a.Project.Location
		} else if p, ok := projMap[a.ProjectID]; ok {
			// Fallback to manual lookup
			pName = p.ProjectName
			pLoc = p.Location
		}

		dto.Project.ProjectName = pName
		dto.Project.Location = pLoc

		if a.Classification != nil {
			dto.Classification.Name = a.Classification.Name
		} else {
			dto.Classification.Name = "Unknown"
		}

		result = append(result, dto)
	}

	c.JSON(http.StatusOK, result)
}

// --- Completed Tasks and Helper Types ---

// TaskEvidence holds images for before and after states
type TaskEvidence struct {
	Before []string `json:"before"`
	After  []string `json:"after"`
}

// CompletedTaskResponse represents a completed task for manager reports
type CompletedTaskResponse struct {
	ID            uuid.UUID    `json:"id"`
	ProjectName   string       `json:"project_name"`
	UserName      string       `json:"user_name"`
	MainCategory  string       `json:"main_category"`
	ChildCategory string       `json:"child_category"`
	StationID     *uuid.UUID   `json:"station_id"` // NEW: Link to station instead of name
	Evidence      TaskEvidence `json:"evidence"`
	CompletedAt   *time.Time   `json:"completed_at"`
}

var reNum = regexp.MustCompile(`\d+`)

func extractNumber(s string) int {
	match := reNum.FindString(s)
	if match == "" {
		return 0
	}
	val, _ := strconv.Atoi(match)
	return val
}

func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// GetCompletedTasks returns all tasks where accept = 1
func (h *AllocationHandler) GetCompletedTasks(c *gin.Context) {
	// 1. Parse Query Parameters
	projectID := c.Query("project_id")
	userID := c.Query("user_id")
	pageStr := c.Query("page")
	limitStr := c.Query("limit")

	page := 1
	limit := 100 // Default limit to 100
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	offset := (page - 1) * limit

	var taskDetails []domain.TaskDetail

	// 2. Build Query
	query := h.DB.Model(&domain.TaskDetail{}).
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Preload("Assign").
		Preload("Assign.Project").
		Preload("Assign.User").
		Where("task_details.status_approve = ?", 1) // NEW SCHEMA: status_approve = 1 means approved

	// 3. Apply Filters using Joins if necessary
	if projectID != "" || userID != "" {
		query = query.Joins("JOIN assigns ON assigns.id = task_details.assign_id")

		if projectID != "" {
			query = query.Where("assigns.project_id = ?", projectID)
		}
		if userID != "" {
			query = query.Where("assigns.user_id = ?", userID)
		}
	}

	// 4. Execute with Pagination
	err := query.
		Order("task_details.updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&taskDetails).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch completed tasks"})
		return
	}

	// Transform to response format
	var response []CompletedTaskResponse
	for _, task := range taskDetails {
		// DataResult removed - evidence extraction deprecated
		evidence := TaskEvidence{Before: []string{}, After: []string{}}

		item := CompletedTaskResponse{
			ID:          task.ID,
			Evidence:    evidence,
			StationID:   task.StationID,
			CompletedAt: task.ApprovalAt,
		}

		// 1. Populate Names
		if task.ChildCategory != nil {
			item.ChildCategory = task.ChildCategory.Name
			if task.ChildCategory.MainCategory != nil {
				item.MainCategory = task.ChildCategory.MainCategory.Name
			}
		}

		if task.Assign != nil {
			// DataWork removed - use Preload only
			if task.Assign.Project != nil {
				item.ProjectName = task.Assign.Project.ProjectName
			}

			if task.Assign.User != nil {
				item.UserName = task.Assign.User.FullName
			}
		}

		response = append(response, item)
	}

	c.JSON(http.StatusOK, response)
}

// UpdateTaskStatus handles PUT /task-details/:id/status
func (h *AllocationHandler) UpdateTaskStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Task ID"})
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
    
    // Standardized Logic for Status Updates
    updates := make(map[string]interface{})
    
    // Handle 'accept' flag (legacy & new manager UI)
    if val, ok := req["accept"]; ok {
        acceptVal := 0
        // Type assertion safety
        switch v := val.(type) {
        case float64:
            acceptVal = int(v)
        case int:
            acceptVal = v
        }

        if acceptVal == 1 {
            // APPROVE: Set status_approve = 1.
            // Reset status_reject = 0 (Cleared) as per new requirement
            updates["status_approve"] = 1
            updates["status_reject"] = 0
            updates["approval_at"] = time.Now()
            
        } else if acceptVal == -1 {
            // REJECT: Set status_reject = 1, status_approve = 0
            updates["status_reject"] = 1
            updates["status_approve"] = 0 
           // updates["rejected_at"] = time.Now() // Removed per user request
        }
    }
    
    // Copy other fields (notes, timestamps specific keys)
    if val, ok := req["note"]; ok {
        // updates["note"] = val // legacy removed
        updates["note_approval"] = val // if approved
        updates["note_reject"] = val // if rejected
    }
    
	// Explicit reject_at override
	if val, ok := req["reject_at"]; ok {
		updates["rejected_at"] = val
	}
	if val, ok := req["rejected_at"]; ok {
		updates["rejected_at"] = val
	}


	if err := h.ProjectRepo.UpdateTaskDetailStatus(id, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}

// BulkUpdateTaskStatus handles PUT /task-details/bulk/status
func (h *AllocationHandler) BulkUpdateTaskStatus(c *gin.Context) {
	type BulkRequest struct {
		IDs    []string               `json:"ids"`
		Accept int                    `json:"accept"` // Optional, if provided uses standard accept logic
		Note   string                 `json:"note"`   // Optional
	}

	var req BulkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No IDs provided"})
		return
	}

	var uuids []uuid.UUID
	for _, idStr := range req.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue // Skip invalid? Or fail? Let's skip valid but warn logs
		}
		uuids = append(uuids, id)
	}

	if len(uuids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid UUIDs"})
		return
	}

	// Standardized Logic akin to UpdateTaskStatus
	updates := make(map[string]interface{})

	// Handle 'accept' flag
	if req.Accept != 0 {
		if req.Accept == 1 {
			// APPROVE
			updates["status_approve"] = 1
			updates["status_reject"] = 0
			updates["approval_at"] = time.Now()
			
			if req.Note != "" {
				updates["note_approval"] = req.Note
			}
		} else if req.Accept == -1 {
			// REJECT
			updates["status_reject"] = 1
			updates["status_approve"] = 0
			updates["reject_at"] = time.Now() // Re-enabled per user request
			
			if req.Note != "" {
				updates["note_reject"] = req.Note
			}
		}
	}

	// General Note
	// General Note
	// Removed legacy "note" update (2026-01-22)
	// if req.Note != "" {
	// 	updates["note"] = req.Note
	// }

	if err := h.ProjectRepo.UpdateTaskDetailsStatusBulk(uuids, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Bulk status updated successfully",
		"count":   len(uuids),
	})
}

// SubmitTaskEvidence handles POST /monitoring/submit
// Uploads file to MinIO with specific structure and updates task status
func (h *AllocationHandler) SubmitTaskEvidence(c *gin.Context) {
    // 1. Parse Form Data
    assignIDStr := c.PostForm("assign_id")
    taskDetailsIDStr := c.PostForm("task_details_id")
    
    // DEBUG LOGGING
    log.Printf("[SubmitTaskEvidence] Received: assign_id='%s', task_details_id='%s'", assignIDStr, taskDetailsIDStr)

    if assignIDStr == "" || taskDetailsIDStr == "" {
        log.Printf("[SubmitTaskEvidence] Error: Missing required fields")
        c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Missing fields: assign_id='%s' task_details_id='%s'", assignIDStr, taskDetailsIDStr)})
        return
    }

    _, err := uuid.Parse(assignIDStr)
    taskID, err2 := uuid.Parse(taskDetailsIDStr)
    if err != nil || err2 != nil {
        log.Printf("[SubmitTaskEvidence] Error: Invalid UUIDs. err=%v, err2=%v", err, err2)
        c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid UUIDs: assign_id='%s' task_details_id='%s'", assignIDStr, taskDetailsIDStr)})
        return
    }

    // 2. Get File (Optional)
    fileHeader, _ := c.FormFile("file")

    // 3. Fetch Task Detail with ALL Preloads to build path
    var task domain.TaskDetail
    if err := h.DB.
        Preload("Assign").
        Preload("Assign.Project").
        Preload("Assign.Classification").
        Preload("ChildCategory").
        Preload("ChildCategory.MainCategory").
        Preload("ChildCategory.Station"). // Try to preload Station via ChildCategory? No, StationID is on TaskDetail usually or ChildCat
        // Wait, TaskDetail has StationID, but maybe no relation defined in struct line 228?
        // Let's try Preload("Station") if relation added, or fetch manually.
        // Based on struct review, 'Station' field is NOT present in TaskDetail, only StationID. 
        // But ChildCategory has Station relation? Yes line 56.
        // Let's rely on ChildCategory.Station if possible, or fetch Station manually.
        Where("id = ?", taskID).First(&task).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
        return
    }

    // Manual Fetch for Station if missing from ChildCat (ChildCat Station is optional? "id_station" json:"station_id")
    var objectPath string
    now := time.Now()
    if fileHeader != nil {
        var stationName = "UnknownStation"
    if task.StationID != nil {
        var s domain.Station
        if err := h.DB.First(&s, *task.StationID).Error; err == nil {
            stationName = s.Name
        }
    } else if task.ChildCategory != nil && task.ChildCategory.Station != nil {
         stationName = task.ChildCategory.Station.Name
    }

    // Manual Fetch for Process Name
    processName := "UnknownProcess"
    if task.ProcessID != nil {
        // Query generic 'process' table? Or just raw SQL?
        // Let's assume table "process" exists matching `admin/tables/process`
        var p struct { Name string }
        if err := h.DB.Table("process").Select("name").Where("id = ?", *task.ProcessID).First(&p).Error; err == nil {
            processName = p.Name
        }
    }
    
    // 4. Build Path
    // <bucket>/<năm>/<quý>/<dự án>/<thể loại dự án>/<hạng mục chính>/<hạng mục phụ>/<station>/<quy trình làm việc>
    year := fmt.Sprintf("%d", now.Year())
    quarter := fmt.Sprintf("Q%d", (int(now.Month())-1)/3+1)
    
    projectName := "UnknownProject"
    if task.Assign != nil {
        if task.Assign.Project != nil {
            projectName = task.Assign.Project.ProjectName
        } else {
            // Manual Lookup as per user request
            var p domain.Project
            if err := h.DB.Where("project_id = ?", task.Assign.ProjectID).First(&p).Error; err == nil {
                projectName = p.ProjectName
            } else {
                 fmt.Printf("Error fetching project manually: %v\n", err)
            }
        }
    }
    
    className := "UnknownClass"
    if task.Assign != nil && task.Assign.Classification != nil {
        className = task.Assign.Classification.Name
    }
    
    mainName := "UnknownMain"
    if task.ChildCategory != nil && task.ChildCategory.MainCategory != nil {
        mainName = task.ChildCategory.MainCategory.Name
    }
    
    childName := "UnknownChild"
    if task.ChildCategory != nil {
        childName = task.ChildCategory.Name
    }

    // Generate UUID for filename
    fileUUID := uuid.New().String()
    ext := ""
    // Simple extension extraction
    if len(fileHeader.Filename) > 4 {
        ext = fileHeader.Filename[len(fileHeader.Filename)-4:] // primitive
        // Better:
        for i := len(fileHeader.Filename) - 1; i >= 0; i-- {
             if fileHeader.Filename[i] == '.' {
                 ext = fileHeader.Filename[i:]
                 break
             }
        }
    }

    objectPath := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/%s%s", 
        year, quarter, projectName, className, mainName, childName, stationName, processName, fileUUID, ext)
    
    // 5. Upload
    src, _ := fileHeader.Open()
    defer src.Close()
    content := make([]byte, fileHeader.Size)
    src.Read(content)
    
    if h.MinioClient == nil {
         c.JSON(http.StatusInternalServerError, gin.H{"error": "MinIO not configured"})
         return
    }
    
    // Bucket name obtained from client config usually, or prepended?
    // User said: "<bucket> (ở đây là dev)/..."
    // MinioClient.UploadBytes usually appends to bucket.
    // So 'objectPath' should NOT contain the bucket name if the client methods puts it in the bucket.
    
    _, err = h.MinioClient.UploadBytes(content, objectPath, fileHeader.Header.Get("Content-Type"))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload failed: " + err.Error()})
        return
    }
    }

    // 6. Update Status
    // Logic: If currently Rejected (status_reject == 1), set status_reject = -1 (Resubmitted)
    // Always set status_work=1, status_submit=1, status_approve=0
    updates := map[string]interface{}{
        "status_work":    1,
        "status_submit":  1,
        "submitted_at":   now,
        "status_approve": 0, // Reset approval to Pending
    }

    // Check if currently rejected to set status_reject = -1
    if task.StatusReject == 1 {
        updates["status_reject"] = -1
    }
    // Else leave status_reject as is (likely 0)

    if err := h.DB.Model(&task).Updates(updates).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task status"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Submitted successfully", "path": objectPath})
}

// ResetTaskSubmission handles POST /monitoring/reset
// Resets status_submit to 0 for debugging/re-testing
func (h *AllocationHandler) ResetTaskSubmission(c *gin.Context) {
    taskDetailsIDStr := c.PostForm("task_details_id")
    if taskDetailsIDStr == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "task_details_id is required"})
        return
    }

    id, err := uuid.Parse(taskDetailsIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
        return
    }

    if err := h.DB.Model(&domain.TaskDetail{}).Where("id = ?", id).Updates(map[string]interface{}{
        "status_submit": 0,
        "status_work": 0, // Optional: reset work status too
        "submitted_at": nil,
    }).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset task"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Task reset successfully"})
}

// GetTaskEvidence handles GET /monitoring/evidence/:id
// Returns list of image URLs for a submitted task
func (h *AllocationHandler) GetTaskEvidence(c *gin.Context) {
    taskIDStr := c.Param("id")
    taskID, err := uuid.Parse(taskIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Task ID"})
        return
    }

    // 1. Fetch Task
    var task domain.TaskDetail
    if err := h.DB.
        Preload("Assign").
        Preload("Assign.Project").
        Preload("Assign.Classification").
        Preload("ChildCategory").
        Preload("ChildCategory.MainCategory").
        Preload("ChildCategory.Station").
        Where("id = ?", taskID).First(&task).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
        return
    }

    if task.StatusSubmit != 1 || task.SubmittedAt == nil {
        c.JSON(http.StatusOK, []string{}) // Not submitted, no images
        return
    }

    // 2. Reconstruct Path
    submittedAt := *task.SubmittedAt
    year := fmt.Sprintf("%d", submittedAt.Year())
    quarter := fmt.Sprintf("Q%d", (int(submittedAt.Month())-1)/3+1)
    
     projectName := "UnknownProject"
    if task.Assign != nil {
        if task.Assign.Project != nil {
            projectName = task.Assign.Project.ProjectName
        } else {
            // Manual Lookup 
            var p domain.Project
            if err := h.DB.Where("project_id = ?", task.Assign.ProjectID).First(&p).Error; err == nil {
                projectName = p.ProjectName
            }
        }
    }
    
    className := "UnknownClass"
    if task.Assign != nil && task.Assign.Classification != nil {
        className = task.Assign.Classification.Name
    }
    
    mainName := "UnknownMain"
    if task.ChildCategory != nil && task.ChildCategory.MainCategory != nil {
        mainName = task.ChildCategory.MainCategory.Name
    }
    
    childName := "UnknownChild"
    if task.ChildCategory != nil {
        childName = task.ChildCategory.Name
    }

    stationName := "UnknownStation"
    if task.StationID != nil {
        var s domain.Station
        if err := h.DB.First(&s, *task.StationID).Error; err == nil {
            stationName = s.Name
        }
    } else if task.ChildCategory != nil && task.ChildCategory.Station != nil {
         stationName = task.ChildCategory.Station.Name
    }

    processName := "UnknownProcess"
    if task.ProcessID != nil {
        var p struct { Name string }
        if err := h.DB.Table("process").Select("name").Where("id = ?", *task.ProcessID).First(&p).Error; err == nil {
            processName = p.Name
        }
    }

    prefix := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/", 
        year, quarter, projectName, className, mainName, childName, stationName, processName)

    // 3. List Objects
    urls, err := h.MinioClient.ListObjects(prefix)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list MinIO objects: " + err.Error()})
        return
    }

    // 4. Filter to only include image files (exclude .txt notes)
    var imageUrls []string
    for _, url := range urls {
        lowerUrl := strings.ToLower(url)
        if strings.HasSuffix(lowerUrl, ".jpg") || 
           strings.HasSuffix(lowerUrl, ".jpeg") || 
           strings.HasSuffix(lowerUrl, ".png") || 
           strings.HasSuffix(lowerUrl, ".gif") || 
           strings.HasSuffix(lowerUrl, ".webp") ||
           strings.HasSuffix(lowerUrl, ".webm") {
            imageUrls = append(imageUrls, url)
        }
    }

    // Sort by object name to ensure consistent order
    sort.Strings(imageUrls)

    c.JSON(http.StatusOK, imageUrls)
}

// DeleteTaskEvidence handles DELETE /monitoring/evidence
func (h *AllocationHandler) DeleteTaskEvidence(c *gin.Context) {
	type DeleteRequest struct {
		TaskDetailsID string `json:"task_details_id"`
		ObjectName    string `json:"object_name"` // Full object path or URL
	}

	var req DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Basic validation
	if req.ObjectName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Object name is required"})
		return
	}

	// Logic to extract object key from URL if needed
	objectKey := req.ObjectName
	if strings.Contains(req.ObjectName, h.MinioClient.Bucket) {
		// Example URL: https://endpoint/bucket/key
		parts := strings.Split(req.ObjectName, h.MinioClient.Bucket+"/")
		if len(parts) > 1 {
			objectKey = parts[1]
		}
	}

	if err := h.MinioClient.RemoveObject(objectKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove object from MinIO: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Evidence deleted successfully", "key": objectKey})
}

// UpdateTaskNote handles PUT /monitoring/note
// Uploads note as text file to MinIO and stores path in work_note
func (h *AllocationHandler) UpdateTaskNote(c *gin.Context) {
	type NoteRequest struct {
		TaskDetailsID string `json:"task_details_id"`
		Note          string `json:"note"`
	}

	var req NoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.TaskDetailsID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task_details_id is required"})
		return
	}

	taskID, err := uuid.Parse(req.TaskDetailsID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task_details_id"})
		return
	}

	// Fetch task with preloads to build MinIO path
	var task domain.TaskDetail
	if err := h.DB.
		Preload("Assign").
		Preload("Assign.Project").
		Preload("Assign.Classification").
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Build MinIO path (same structure as images but with .txt extension)
	now := time.Now()
	year := fmt.Sprintf("%d", now.Year())
	quarter := fmt.Sprintf("Q%d", (int(now.Month())-1)/3+1)

	projectName := "UnknownProject"
	if task.Assign != nil {
		if task.Assign.Project != nil {
			projectName = task.Assign.Project.ProjectName
		} else {
			// Manual lookup if preload failed
			var p domain.Project
			if err := h.DB.Where("project_id = ?", task.Assign.ProjectID).First(&p).Error; err == nil {
				projectName = p.ProjectName
			}
		}
	}

	className := "UnknownClass"
	if task.Assign != nil && task.Assign.Classification != nil {
		className = task.Assign.Classification.Name
	}

	mainName := "UnknownMain"
	if task.ChildCategory != nil && task.ChildCategory.MainCategory != nil {
		mainName = task.ChildCategory.MainCategory.Name
	}

	childName := "UnknownChild"
	if task.ChildCategory != nil {
		childName = task.ChildCategory.Name
	}

	stationName := "UnknownStation"
	if task.StationID != nil {
		var s domain.Station
		if err := h.DB.First(&s, *task.StationID).Error; err == nil {
			stationName = s.Name
		}
	}

	processName := "UnknownProcess"
	if task.ProcessID != nil {
		var p struct{ Name string }
		if err := h.DB.Table("process").Select("name").Where("id = ?", *task.ProcessID).First(&p).Error; err == nil {
			processName = p.Name
		}
	}

	// Note file path
	noteFileName := fmt.Sprintf("note_%s.txt", uuid.New().String())
	objectPath := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/%s",
		year, quarter, projectName, className, mainName, childName, stationName, processName, noteFileName)

	// Upload note to MinIO
	if h.MinioClient != nil {
		_, err = h.MinioClient.UploadBytes([]byte(req.Note), objectPath, "text/plain")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload note: " + err.Error()})
			return
		}
	}

	// Update work_note column with MinIO path
	if err := h.DB.Model(&task).Update("work_note", objectPath).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update work_note: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note saved successfully", "path": objectPath})
}

// GetTaskNote handles GET /monitoring/note/:id
// Fetches note content from MinIO using work_note path
func (h *AllocationHandler) GetTaskNote(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Task ID"})
		return
	}

	var task domain.TaskDetail
	if err := h.DB.Select("id", "work_note").Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if task.WorkNote == "" {
		c.JSON(http.StatusOK, gin.H{"note": ""})
		return
	}

	// Fetch note content from MinIO
	if h.MinioClient != nil {
		content, err := h.MinioClient.GetObject(task.WorkNote)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"note": "", "error": "Failed to fetch note from MinIO"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"note": string(content)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"note": ""})
}

func (h *AllocationHandler) SyncAllProgress(c *gin.Context) {
    res, err := h.AssignmentService.SyncAllProgress()
    if err != nil {
        c.JSON(http.StatusOK, res) // Return what we have, even with errors
        if res == nil {
             c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
             return
        }
    }
    c.JSON(http.StatusOK, res)
}
