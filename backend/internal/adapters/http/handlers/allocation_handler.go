package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
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
	AllocationRepo      domain.AllocationRepository // NEW
	UserRepo            domain.UserRepository
	StationRepo         domain.StationRepository 
	AssignmentService   *services.AssignmentService
	NotificationService *services.NotificationService
	DB                  *gorm.DB
	MinioClient         *storage.MinioClient // NEW
}

func NewAllocationHandler(
	projectRepo domain.ProjectRepository,
	allocationRepo domain.AllocationRepository, // NEW
	userRepo domain.UserRepository,
	stationRepo domain.StationRepository, // NEW
	assignmentService *services.AssignmentService,
	notificationService *services.NotificationService,
	db *gorm.DB,
	minioClient *storage.MinioClient, // NEW
) *AllocationHandler {
	return &AllocationHandler{
		ProjectRepo:         projectRepo,
		AllocationRepo:      allocationRepo,
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
		UserIDs               []uuid.UUID `json:"user_ids"`                           // Accept multiple users
		StationChildConfigIDs []uuid.UUID `json:"station_child_config_ids" binding:"required"` // Selected configs from UI
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
		
		if err := h.AllocationRepo.CreateAssign(&newAssign); err != nil {
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
			// 1. Resolve Project Name and Type
			pName := "Unknown Project"
            pType := "General"
			if proj, err := h.ProjectRepo.GetProjectByID(req.ProjectID); err == nil {
				pName = proj.ProjectName
			}

			if req.ProjectClassificationID != uuid.Nil {
				if cls, err := h.ProjectRepo.GetClassificationByID(req.ProjectClassificationID); err == nil {
					pType = cls.Name // e.g. "Solar Farm"
                    pName = fmt.Sprintf("%s (%s)", pName, cls.Name)
				}
			}
            
            // 2. Gather Created Task Details (for this user)
            // We need to re-fetch/filter the taskDetails we just created for this AssignID
            var assignedTasks []domain.TaskDetail
            h.DB.Preload("ChildCategory.MainCategory").Preload("ChildCategory").Preload("Station").Where("assign_id = ?", newAssign.ID).Find(&assignedTasks)

			// 3. Call Detailed Service
            var tStart, tEnd time.Time
            if req.StartTime != nil { tStart = *req.StartTime }
            if req.EndTime != nil { tEnd = *req.EndTime }
            
			h.NotificationService.NotifyAssignmentDetailed(user, pName, pType, tStart, tEnd, assignedTasks, newAssign.ID)
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

	if err := h.AllocationRepo.DeleteAssign(id); err != nil {
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

	if err := h.AllocationRepo.HardDeleteAssign(id); err != nil {
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
	exists, err := h.AllocationRepo.CheckProjectExistsInAssign(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"exists": exists})
}

// GetAllAllocations handles GET /allocations
func (h *AllocationHandler) GetAllAllocations(c *gin.Context) {
	assigns, err := h.AllocationRepo.GetAllAssigns()
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

	var projectID *uuid.UUID
	if pIDStr := c.Query("project_id"); pIDStr != "" {
		if pID, err := uuid.Parse(pIDStr); err == nil {
			projectID = &pID
		}
	}

	assigns, err := h.AllocationRepo.GetAssignsByUserID(userID, projectID)
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
	assigns, err := h.AllocationRepo.GetDeletedAssigns()
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





// Methods moved to EvidenceHandler
func (h *AllocationHandler) SubmitTaskEvidence(c *gin.Context) {
    c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to /monitoring/submit via EvidenceHandler"})
}

func (h *AllocationHandler) GetTaskEvidence(c *gin.Context) {
    c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to /monitoring/evidence/:id via EvidenceHandler"})
}

func (h *AllocationHandler) DeleteTaskEvidence(c *gin.Context) {
    c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to /monitoring/evidence via EvidenceHandler"})
}

func (h *AllocationHandler) UpdateTaskNote(c *gin.Context) {
    c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to EvidenceHandler"})
}

func (h *AllocationHandler) GetTaskNote(c *gin.Context) {
    c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to EvidenceHandler"})
}

func (h *AllocationHandler) SyncAllTaskImages(c *gin.Context) {
     c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to EvidenceHandler"})
}

func (h *AllocationHandler) SyncAllTaskNotes(c *gin.Context) {
     c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to EvidenceHandler"})
}

func (h *AllocationHandler) ResetTaskSubmission(c *gin.Context) {
     c.JSON(http.StatusMovedPermanently, gin.H{"error": "Moved to EvidenceHandler"})
}

func (h *AllocationHandler) SyncAllProgress(c *gin.Context) {
    res, err := h.AssignmentService.SyncAllProgress()
    if err != nil {
        c.JSON(http.StatusOK, res) // Return what we have
        if res == nil {
             c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
             return
        }
    }
    c.JSON(http.StatusOK, res)
}

