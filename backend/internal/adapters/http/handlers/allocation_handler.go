package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type AllocationHandler struct {
	ProjectRepo         domain.ProjectRepository
	UserRepo            domain.UserRepository
	AssignmentService   *services.AssignmentService
	NotificationService *services.NotificationService
	DB                  *gorm.DB
}

func NewAllocationHandler(
	projectRepo domain.ProjectRepository,
	userRepo domain.UserRepository,
	assignmentService *services.AssignmentService,
	notificationService *services.NotificationService,
	db *gorm.DB,
) *AllocationHandler {
	return &AllocationHandler{
		ProjectRepo:         projectRepo,
		UserRepo:            userRepo,
		AssignmentService:   assignmentService,
		NotificationService: notificationService,
		DB:                  db,
	}
}

// CreateAllocation handles POST /allocations
func (h *AllocationHandler) CreateAllocation(c *gin.Context) {
	type AllocationRequest struct {
		domain.Assign
		UserIDs []uuid.UUID `json:"user_ids"` // Accept multiple users
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

	// Create assignment for each user
	var created []domain.Assign
	for _, uid := range req.UserIDs {
		newAssign := req.Assign // Copy base fields
		newAssign.ID = uuid.New()
		newAssign.UserID = uid
		// Reset data result if needed, though default is empty

		if err := h.ProjectRepo.CreateAssign(&newAssign); err != nil {
			log.Printf("Failed to assign to user %s: %v", uid, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create assignment for user " + uid.String()})
			return
		}
		created = append(created, newAssign)

		// NOTIFICATION
		user, err := h.UserRepo.FindByID(uid)
		if err == nil && user != nil {
			// Determine Project Name
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

	// Sync with latest Project Characteristics (using new JSONB structure)
	for i, assign := range assigns {
		char, err := h.ProjectRepo.GetProjectCharacteristic(assign.ProjectID)
		if err == nil && char != nil {
			dataWorkMap := assign.DataWork
			if dataWorkMap == nil {
				continue
			}

			// Parse ChildCategoryData from ProjectCharacteristic
			charData := make(map[string]interface{})
			if char.ChildCategoryData != nil {
				jsonBytes := []byte(char.ChildCategoryData)
				_ = json.Unmarshal(jsonBytes, &charData)
			}

			if mainCats, ok := dataWorkMap["main_categories"].([]interface{}); ok {
				updatedMainCats := make([]map[string]interface{}, 0)
				hasUpdates := false

				for _, mc := range mainCats {
					mcMap, ok := mc.(map[string]interface{})
					if !ok {
						continue
					}

					name, _ := mcMap["name"].(string)
					normalized := strings.ReplaceAll(strings.ToLower(name), " & ", "_and_")
					normalized = strings.ReplaceAll(normalized, " ", "_")

					// Get quantity from ChildCategoryData (if exists)
					var newQty int = 0
					
					// Also track specs per child if available
					// usage: check if 'normalized' key exists in charData
					if val, ok := charData[normalized]; ok {
						// Case 1: Legacy Number
						if v, ok := val.(float64); ok {
							newQty = int(v)
						} else if vMap, ok := val.(map[string]interface{}); ok {
							// Case 2: Nested Object
							if q, ok := vMap["quantity"].(float64); ok {
								newQty = int(q)
							}
						}
					}

					if newQty > 0 {
						oldNumStr, _ := mcMap["num"].(string)
						newNumStr := fmt.Sprint(newQty)
						if oldNumStr != newNumStr {
							hasUpdates = true
							mcMap["num"] = newNumStr
							if children, ok := mcMap["child_categories"].([]interface{}); ok {
								updatedChildren := make([]map[string]interface{}, 0)
								for _, child := range children {
									childMap, ok := child.(map[string]interface{})
									if !ok { continue }
									childName, _ := childMap["name"].(string)
									isFixed := childName == "Utility Meter Reading" || childName == "Inspect for shattered solar panels"
									if isFixed {
										childMap["quantity"] = "1"
									} else {
										childMap["quantity"] = newNumStr
									}
									updatedChildren = append(updatedChildren, childMap)
								}
								mcMap["child_categories"] = updatedChildren
							}
						}
					}
					updatedMainCats = append(updatedMainCats, mcMap)
				}

				if hasUpdates {
					dataWorkMap["main_categories"] = updatedMainCats
				}

				// Specs aggregation from all child categories in charData
				// We iterate through all keys in charData to find inverter/station counts
				// This assumes charData contains ALL project configuration
				invQty := 0
				stationQty := 0

				// If we have global legacy values, start with them (optional, but maybe safer to rely on aggregation if new structure used)
				// stationQty = char.InverterSubAreaCount 
				
				for _, val := range charData {
					if vMap, ok := val.(map[string]interface{}); ok {
						if i, ok := vMap["inverter"].(float64); ok {
							invQty += int(i)
						}
						if s, ok := vMap["inverter_sub_area_count"].(float64); ok {
							stationQty += int(s)
						}
					}
				}
				
				// Fallback to global legacy if aggregation yielded 0 (and global exists)
				// [REMOVED LEGACY FALLBACK] - Fields removed from DB
				
				// Always inject 'specs' into DataWork
				dataWorkMap["specs"] = map[string]interface{}{
					"inverter_qty": invQty,
					"station_qty":  stationQty,
				}

				assign.DataWork = dataWorkMap
				if hasUpdates {
					h.ProjectRepo.UpdateAssign(&assign)
				}
				assigns[i] = assign
			}
		}
	}

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

	// Sync with latest Project Characteristics (using new JSONB structure)
	for i, assign := range assigns {
		char, err := h.ProjectRepo.GetProjectCharacteristic(assign.ProjectID)
		if err == nil && char != nil {
			dataWorkMap := assign.DataWork
			if dataWorkMap == nil {
				continue
			}

			// Parse ChildCategoryData from ProjectCharacteristic
			charData := make(map[string]interface{})
			if char.ChildCategoryData != nil {
				jsonBytes := []byte(char.ChildCategoryData)
				_ = json.Unmarshal(jsonBytes, &charData)
			}

			if mainCats, ok := dataWorkMap["main_categories"].([]interface{}); ok {
				updatedMainCats := make([]map[string]interface{}, 0)
				hasUpdates := false

				for _, mc := range mainCats {
					mcMap, ok := mc.(map[string]interface{})
					if !ok {
						continue
					}

					name, _ := mcMap["name"].(string)
					normalized := strings.ReplaceAll(strings.ToLower(name), " & ", "_and_")
					normalized = strings.ReplaceAll(normalized, " ", "_")

					// Get quantity from ChildCategoryData (if exists)
					var newQty int = 0
					if val, ok := charData[normalized]; ok {
						// Case 1: Legacy Number
						if v, ok := val.(float64); ok {
							newQty = int(v)
						} else if vMap, ok := val.(map[string]interface{}); ok {
							// Case 2: Nested Object
							if q, ok := vMap["quantity"].(float64); ok {
								newQty = int(q)
							}
						}
					}

					if newQty > 0 {
						oldNumStr, _ := mcMap["num"].(string)
						newNumStr := fmt.Sprint(newQty)
						if oldNumStr != newNumStr {
							hasUpdates = true
							mcMap["num"] = newNumStr

							// Update Children
							if children, ok := mcMap["child_categories"].([]interface{}); ok {
								updatedChildren := make([]map[string]interface{}, 0)
								for _, child := range children {
									childMap, ok := child.(map[string]interface{})
									if !ok {
										continue
									}
									childName, _ := childMap["name"].(string)
									isFixed := childName == "Utility Meter Reading" || childName == "Inspect for shattered solar panels"
									if isFixed {
										childMap["quantity"] = "1"
									} else {
										childMap["quantity"] = newNumStr
									}
									updatedChildren = append(updatedChildren, childMap)
								}
								mcMap["child_categories"] = updatedChildren
							}
						}
					}
					updatedMainCats = append(updatedMainCats, mcMap)
				}

				if hasUpdates {
					dataWorkMap["main_categories"] = updatedMainCats
				}

				// Specs aggregation from all child categories
				// Specs are now Global again (Physical structure)
				invQty := char.Inverter
				stationQty := char.InverterSubAreaCount

				// Fallback to global legacy if aggregation yielded 0 (and global exists)
				// [REMOVED LEGACY FALLBACK] - Fields removed from DB

				// Always inject 'specs' into DataWork
				dataWorkMap["specs"] = map[string]interface{}{
					"inverter_qty": invQty,
					"station_qty":  stationQty,
				}

				assign.DataWork = dataWorkMap

				// Save back to DB to persist specs and updates
				if hasUpdates {
					h.ProjectRepo.UpdateAssign(&assign)
				}

				// Update result
				assigns[i] = assign
			}
		}
	}

	c.JSON(http.StatusOK, assigns)
}

// UpdateProgress handles PUT /allocations/:id/progress
func (h *AllocationHandler) UpdateProgress(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Allocation ID"})
		return
	}
	var req domain.AssetMetadata
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Data Result"})
		return
	}

	updatedData, err := h.AssignmentService.UpdateProgress(id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updatedData)
}

// SyncProgress handles POST /allocations/:id/sync
func (h *AllocationHandler) SyncProgress(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Allocation ID"})
		return
	}

	updatedData, err := h.AssignmentService.SyncProgress(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updatedData)
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
	StationName   *string      `json:"station_name"`
	InverterName  *string      `json:"inverter_name"`
	Status        string       `json:"status"`
	Note          string       `json:"note"`
	ImagePath     string       `json:"image_path"` // Deprecated but kept for compatibility
	Evidence      TaskEvidence `json:"evidence"`   // New field for structured images
	CompletedAt   time.Time    `json:"completed_at"`
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
		Where("task_details.accept = ?", 1) // Disambiguate column

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
		evidence := TaskEvidence{Before: []string{}, After: []string{}}

		// Logic to extract images from DataResult if available
		if task.Assign != nil && task.Assign.DataResult != nil {


			if childData, ok := task.Assign.DataResult[task.ChildCategoryID.String()]; ok {
				if itemsList, ok := childData.([]interface{}); ok {
					sNum := 1
					if task.StationName != nil {
						sNum = extractNumber(*task.StationName)
					}
					if sNum < 1 {
						sNum = 1
					}
					idx := sNum - 1
					// log.Printf("DEBUG IMG: StName=%s, idx=%d, listLen=%d", stName, idx, len(itemsList))

					if idx >= 0 && idx < len(itemsList) {
						if dataItem, ok := itemsList[idx].(map[string]interface{}); ok {
							// log.Printf("DEBUG IMG: Found item map keys: %v", getKeys(dataItem))
							if after, ok := dataItem["after"].(map[string]interface{}); ok {
								if afterImgs, ok := after["images"].([]interface{}); ok {
									for _, img := range afterImgs {
										if str, ok := img.(string); ok {
											evidence.After = append(evidence.After, str)
										}
									}
								}
							}
							if before, ok := dataItem["before"].(map[string]interface{}); ok {
								if beforeImgs, ok := before["images"].([]interface{}); ok {
									for _, img := range beforeImgs {
										if str, ok := img.(string); ok {
											evidence.Before = append(evidence.Before, str)
										}
									}
								}
							}
						}
					}
				}
			}
		}

		item := CompletedTaskResponse{
			ID:           task.ID,
			Status:       task.Status,
			Note:         task.Note,
			ImagePath:    task.ImagePath,
			Evidence:     evidence,
			StationName:  task.StationName,
			InverterName: task.InverterName,
			CompletedAt:  task.UpdatedAt,
		}

		// 1. Populate Names
		if task.ChildCategory != nil {
			item.ChildCategory = task.ChildCategory.Name
			if task.ChildCategory.MainCategory != nil {
				item.MainCategory = task.ChildCategory.MainCategory.Name
			}
		}

		if task.Assign != nil {
			// Try to get project name from DataWork JSON first
			if task.Assign.DataWork != nil {
				if projectName, ok := task.Assign.DataWork["project"].(string); ok && projectName != "" {
					item.ProjectName = projectName
				}
			}

			// Fallback to Preload if not found in DataWork
			if item.ProjectName == "" && task.Assign.Project != nil {
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

	type StatusRequest struct {
		Accept int    `json:"accept"`
		Note   string `json:"note"`
	}
	var req StatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.ProjectRepo.UpdateTaskDetailAccept(id, req.Accept, req.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}

// SyncAllProgress handles POST /allocations/sync-all
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
