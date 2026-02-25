package handlers

import (
	"encoding/json"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TaskStatusHandler handles task status updates and queries
// TaskStatusHandler handles task status updates and queries
type TaskStatusHandler struct {
	ProjectRepo    domain.ProjectRepository
	AllocationRepo domain.AllocationRepository // NEW
	DB             *gorm.DB
	Notification   *services.NotificationService
}

// NewTaskStatusHandler creates a new task status handler
func NewTaskStatusHandler(
	projectRepo domain.ProjectRepository,
	allocationRepo domain.AllocationRepository, // NEW
	notification *services.NotificationService,
	db *gorm.DB,
) *TaskStatusHandler {
	return &TaskStatusHandler{
		ProjectRepo:    projectRepo,
		AllocationRepo: allocationRepo,
		DB:             db,
		Notification:   notification,
	}
}

// UpdateTaskStatus handles PUT /task-details/:id/status
func (h *TaskStatusHandler) UpdateTaskStatus(c *gin.Context) {
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

	updates := make(map[string]interface{})

	// Handle 'accept' flag (legacy & new manager UI)
	if val, ok := req["accept"]; ok {
		acceptVal := 0
		switch v := val.(type) {
		case float64:
			acceptVal = int(v)
		case int:
			acceptVal = v
		}

		if acceptVal == 1 {
			// APPROVE
			updates["status_approve"] = 1
			updates["status_reject"] = 0
			updates["approval_at"] = time.Now()
		} else if acceptVal == -1 {
			// REJECT
			updates["status_reject"] = 1
			updates["status_approve"] = 0
		}
	}

	// Handle notes
	if val, ok := req["note"]; ok {
		updates["note_approval"] = val
		updates["note_reject"] = val
	}

	// Explicit reject_at override
	if val, ok := req["reject_at"]; ok {
		updates["rejected_at"] = val
	}
	if val, ok := req["rejected_at"]; ok {
		updates["rejected_at"] = val
	}

	// Update using AllocationRepo
	if err := h.AllocationRepo.UpdateTaskDetailStatus(id, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Determine status change for notification
	go func() {
		isApproved := false
		reason := ""
		hasChange := false

		if val, ok := updates["status_approve"]; ok && val.(int) == 1 {
			isApproved = true
			hasChange = true
			if note, ok := updates["note_approval"]; ok {
				reason = note.(string)
			}
		}
		if val, ok := updates["status_reject"]; ok && val.(int) == 1 {
			isApproved = false
			hasChange = true
			if note, ok := updates["note_reject"]; ok {
				reason = note.(string)
			}
		}

		if hasChange {
			h.sendNotification(id, isApproved, reason)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully"})
}

// BulkUpdateTaskStatus handles PUT /task-details/bulk/status
func (h *TaskStatusHandler) BulkUpdateTaskStatus(c *gin.Context) {
	type BulkRequest struct {
		IDs    []string `json:"ids" binding:"required"`
		Accept int      `json:"accept" binding:"required"`
		Note   string   `json:"note"`
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
			continue
		}
		uuids = append(uuids, id)
	}

	if len(uuids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid UUIDs"})
		return
	}

	updates := make(map[string]interface{})

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
			updates["reject_at"] = time.Now()
			if req.Note != "" {
				updates["note_reject"] = req.Note
			}
		}
	}

	// Update using AllocationRepo
	if err := h.AllocationRepo.UpdateTaskDetailsStatusBulk(uuids, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Send notifications
	go func() {
		isApproved := false
		reason := ""
		if req.Accept == 1 {
			isApproved = true
			reason = req.Note
		} else if req.Accept == -1 {
			isApproved = false
			reason = req.Note
		} else {
			return // No status change
		}

		for _, paramID := range uuids {
			h.sendNotification(paramID, isApproved, reason)
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Bulk status updated successfully",
		"count":   len(uuids),
	})
}

// GetCompletedTasks returns all tasks where accept = 1
func (h *TaskStatusHandler) GetCompletedTasks(c *gin.Context) {
	projectID := c.Query("project_id")
	userID := c.Query("user_id")
	pageStr := c.Query("page")
	limitStr := c.Query("limit")

	page := 1
	limit := 100
	if p, err := parseIntDefault(pageStr, 1); err == nil && p > 0 {
		page = p
	}
	if l, err := parseIntDefault(limitStr, 100); err == nil && l > 0 {
		limit = l
	}
	offset := (page - 1) * limit

	var taskDetails []domain.TaskDetail

	query := h.DB.Model(&domain.TaskDetail{}).
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Preload("Assign").
		Preload("Assign.Project").
		Preload("Assign.User").
		Where("task_details.status_approve = ?", 1)

	if projectID != "" || userID != "" {
		query = query.Joins("JOIN assigns ON assigns.id = task_details.assign_id")

		if projectID != "" {
			query = query.Where("assigns.project_id = ?", projectID)
		}
		if userID != "" {
			query = query.Where("assigns.user_id = ?", userID)
		}
	}

	err := query.
		Order("task_details.updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&taskDetails).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch completed tasks"})
		return
	}

	type CompletedTaskResponse struct {
		ID            uuid.UUID  `json:"id"`
		ProjectName   string     `json:"project_name"`
		UserName      string     `json:"user_name"`
		MainCategory  string     `json:"main_category"`
		ChildCategory string     `json:"child_category"`
		StationID     *uuid.UUID `json:"station_id"`
		CompletedAt   *time.Time `json:"completed_at"`
	}

	var response []CompletedTaskResponse
	for _, task := range taskDetails {
		item := CompletedTaskResponse{
			ID:          task.ID,
			StationID:   task.StationID,
			CompletedAt: task.ApprovalAt,
		}

		if task.ChildCategory != nil {
			item.ChildCategory = task.ChildCategory.Name
			if task.ChildCategory.MainCategory != nil {
				item.MainCategory = task.ChildCategory.MainCategory.Name
			}
		}

		if task.Assign != nil {
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

// Helper function
func parseIntDefault(s string, defaultVal int) (int, error) {
	if s == "" {
		return defaultVal, nil
	}
	var result int
	_, err := parseIntHelper(s, &result)
	if err != nil {
		return defaultVal, err
	}
	return result, nil
}

// Helper to send notification
func (h *TaskStatusHandler) sendNotification(taskID uuid.UUID, isApproved bool, reason string) {
	if h.Notification == nil {
		return
	}

	go func() {
		var task domain.TaskDetail
		// Preload necessary fields
		if err := h.DB.
			Preload("ChildCategory").
			Preload("ChildCategory.MainCategory").
			Preload("Station").
			Preload("Assign.User").
			Preload("Assign.Project").
			Where("id = ?", taskID).First(&task).Error; err != nil {
			return
		}

		if task.Assign == nil || task.Assign.User == nil {
			return
		}

		user := task.Assign.User

		// Construct Task Name
		// Format: ProjectName - MainCategory - ChildCategory
		taskName := "Unknown Task"
		if task.ChildCategory != nil {
			taskName = task.ChildCategory.Name
			if task.ChildCategory.MainCategory != nil {
				taskName = task.ChildCategory.MainCategory.Name + " - " + taskName
			}
		}
		// If project loaded, prepend project name
		if task.Assign.Project != nil {
			taskName = task.Assign.Project.ProjectName + " - " + taskName
		} else {
			// Manual fallback for project name
			var p domain.Project
			if err := h.DB.Where("project_id = ?", task.Assign.ProjectID).First(&p).Error; err == nil {
				taskName = p.ProjectName + " - " + taskName
			}
		}

		stationName := "Unknown Station"
		if task.Station != nil {
			stationName = task.Station.Name
		}

		h.Notification.NotifyTaskStatusUpdate(user, taskName, stationName, isApproved, reason, time.Now(), task.ID, task.AssignID, task.StationID)
	}()
}

// GetAssignmentTasks handles GET /allocations/:id/tasks
func (h *TaskStatusHandler) GetAssignmentTasks(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Assignment ID"})
		return
	}

	var tasks []domain.TaskDetail
	if err := h.DB.
		Unscoped().
		Preload("Process").
		Preload("Station").
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Where("assign_id = ?", id).
		Where("task_details.deleted_at IS NULL").
		Order("created_at ASC").
		Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
		return
	}

	// Sync images from MinIO for each task to ensure consistency
	// This fixes the issue where DB has wrong/missing UUIDs but files exist in folder
	evService := services.NewEvidenceService(h.DB, nil, h.Notification) // MinioClient will be set below

	minioClient, errMx := storage.NewMinioClient()
	if errMx != nil {
		logger.Error("Failed to init MinIO client", zap.Error(errMx))
	} else {
		evService.MinioClient = minioClient
		for i := range tasks {
			// Auto-repair all submitted tasks
			if tasks[i].SubmittedAt != nil {
				logger.Info("Syncing task images", zap.String("task_id", tasks[i].ID.String()))
				newURLs, errSync := evService.SyncAndGetImagesFromMinIO(tasks[i].ID)
				if errSync == nil {
					// Update the object in memory to return correct data immediately
					jsonBytes, _ := json.Marshal(newURLs)
					tasks[i].ImageURL = string(jsonBytes)
				} else {
					logger.Error("Sync failed for task", zap.String("task_id", tasks[i].ID.String()), zap.Error(errSync))
				}
			} else {
				logger.Info("Skipping sync for task (no SubmittedAt)", zap.String("task_id", tasks[i].ID.String()))
			}
		}
	}

	c.JSON(http.StatusOK, tasks)
}

// LookupAssignment handles GET /allocations/lookup
func (h *TaskStatusHandler) LookupAssignment(c *gin.Context) {
	userIDStr := c.Query("user_id")
	dateStr := c.Query("date")
	taskIDStr := c.Query("task_id")

	// 1. Precise Lookup by Task ID (If available)
	if taskIDStr != "" {
		if taskID, err := uuid.Parse(taskIDStr); err == nil {
			var assign domain.Assign
			// Find assignment via task_details (Unscoped to find soft-deleted assigns)
			if err := h.DB.
				Unscoped().
				Table("assign").
				Joins("JOIN task_details ON task_details.assign_id = assign.id").
				Where("task_details.id = ?", taskID).
				First(&assign).Error; err == nil {
				c.JSON(http.StatusOK, assign)
				return
			}
		}
	}

	if userIDStr == "" || dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing user_id or date (and no valid task_id)"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
		return
	}

	date, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		d, err2 := time.Parse("2006-01-02", dateStr)
		if err2 != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format"})
			return
		}
		date = d
	}

	// ---------------------------------------------------------
	// LEGACY FALLBACK: "Smart Ranking"
	// If task_id is missing (old notifications), we must guess the assignment 
	// based on the notification timestamp.
	// ---------------------------------------------------------

	// 1. Fetch ALL assignments for this user on the same day
	dayStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	dayEnd := dayStart.Add(24 * time.Hour)

	var rawAssigns []domain.Assign

	// Fetch assigns with their tasks (Unscoped to include soft-deleted assigns)
	if err := h.DB.
		Unscoped().
		Preload("TaskDetails").
		Where("id_user = ?", userID).
		Where("created_at >= ? AND created_at < ?", dayStart, dayEnd).
		Find(&rawAssigns).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No assignments found for this day"})
		return
	}

	if len(rawAssigns) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No assignments found for this user on this day"})
		return
	}

	// 2. Score each assignment based on time proximity
	// We look for the MINIMUM difference between notification_time and ANY timestamp in the assignment (created_at, task.submitted, task.approved)
	bestDiff := 1000000.0 // Init with huge value
	var bestCandidate *domain.Assign

	for i := range rawAssigns {
		assign := &rawAssigns[i]
		minDiffForThisAssign := 1000000.0

		// Check Assign Creation Time
		diff := math.Abs(date.Sub(assign.CreatedAt).Seconds())
		if diff < minDiffForThisAssign {
			minDiffForThisAssign = diff
		}

		// Check Tasks timestamps
		for _, t := range assign.TaskDetails {
			// Check SubmittedAt
			if t.SubmittedAt != nil {
				d := math.Abs(date.Sub(*t.SubmittedAt).Seconds())
				if d < minDiffForThisAssign {
					minDiffForThisAssign = d
				}
			}
			// Check ApprovalAt
			if t.ApprovalAt != nil {
				d := math.Abs(date.Sub(*t.ApprovalAt).Seconds())
				if d < minDiffForThisAssign {
					minDiffForThisAssign = d
				}
			}
		}

		// Keep track of the best one
		if minDiffForThisAssign < bestDiff {
			bestDiff = minDiffForThisAssign
			bestCandidate = assign
		}
	}

	// 3. Return the winner
	if bestCandidate != nil {
		// Log for debugging
		logger.Info("Smart Match selected assignment",
			zap.String("assign_id", bestCandidate.ID.String()),
			zap.Float64("diff_seconds", bestDiff),
			zap.Int("candidates", len(rawAssigns)),
		)
		c.JSON(http.StatusOK, bestCandidate)
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Could not determine relevant assignment"})
}

func parseIntHelper(s string, result *int) (bool, error) {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		*result = *result*10 + int(c-'0')
	}
	return true, nil
}
