package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"gorm.io/gorm"
)

type EvidenceHandler struct {
	Service     *services.EvidenceService
	DB          *gorm.DB // Kept for legacy interactions if any, or remove if fully serviced
	MinioClient *storage.MinioClient // Kept for legacy or direct interactions
}

func NewEvidenceHandler(db *gorm.DB, minioClient *storage.MinioClient, notificationService *services.NotificationService) *EvidenceHandler {
	service := services.NewEvidenceService(db, minioClient, notificationService)
	return &EvidenceHandler{
		Service:     service,
		DB:          db,
		MinioClient: minioClient,
	}
}

// SubmitTaskEvidence handles POST /monitoring/submit
func (h *EvidenceHandler) SubmitTaskEvidence(c *gin.Context) {
	// 1. Parse Form
	taskDetailsIDStr := c.PostForm("task_details_id")
	if taskDetailsIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing task_details_id"})
		return
	}

	taskID, err := uuid.Parse(taskDetailsIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Task UUID"})
		return
	}

	// 2. Get File
	fileHeader, err := c.FormFile("file")
	if err != nil {
		if err == http.ErrMissingFile {
			// No file provided -> Treat as "Finalize Submission" (Update status only)
			if err := h.Service.FinalizeTaskSubmission(taskID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Task submitted successfully (Status Updated)"})
			return
		}
		// Other errors
		c.JSON(http.StatusBadRequest, gin.H{"error": "File error: " + err.Error()})
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	content := make([]byte, fileHeader.Size)
	src.Read(content)

	// 3. Call Service
	url, err := h.Service.UploadEvidence(taskID, content, fileHeader.Filename, fileHeader.Header.Get("Content-Type"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Submitted successfully", "path": url})
}

// GetTaskEvidence handles GET /monitoring/evidence/:id
func (h *EvidenceHandler) GetTaskEvidence(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Task ID"})
		return
	}

	urls, err := h.Service.GetTaskEvidence(taskID)
	if err != nil {
		if err.Error() == "task not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	
	if urls == nil {
		urls = []string{}
	}

	c.JSON(http.StatusOK, urls)
}

// DeleteTaskEvidence handles DELETE /monitoring/evidence
func (h *EvidenceHandler) DeleteTaskEvidence(c *gin.Context) {
	type DeleteRequest struct {
		TaskDetailsID string `json:"task_details_id"`
		ObjectName    string `json:"object_name"`
	}
	var req DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	taskID, err := uuid.Parse(req.TaskDetailsID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Task ID"})
		return
	}
	
	objectKey := req.ObjectName
	if idx := strings.Index(objectKey, "?"); idx != -1 {
		objectKey = objectKey[:idx]
	}
	if h.MinioClient != nil && strings.Contains(objectKey, h.MinioClient.Bucket) {
		parts := strings.Split(objectKey, h.MinioClient.Bucket+"/")
		if len(parts) > 1 {
			objectKey = parts[1]
		}
	}

	if err := h.Service.DeleteEvidence(taskID, objectKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully", "key": objectKey})
}

// ResetTaskSubmission handles POST /monitoring/reset
func (h *EvidenceHandler) ResetTaskSubmission(c *gin.Context) {
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
        "status_work": 0, 
        "submitted_at": nil,
        "image_url": "", 
    }).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset task"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Task reset successfully"})
}


// UpdateTaskNote handles PUT /monitoring/note
func (h *EvidenceHandler) UpdateTaskNote(c *gin.Context) {
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

	// Fetch task with preloads to build MinIO path for Note
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

	// Build MinIO path (Reusing logic locally, or could expose Service helper)
	// For now, implementing locally to avoid changing Service interface too much in one go
	now := time.Now()
	year := fmt.Sprintf("%d", now.Year())
	quarter := fmt.Sprintf("Q%d", (int(now.Month())-1)/3+1)

	projectName := "UnknownProject"
	if task.Assign != nil {
		if task.Assign.Project != nil {
			projectName = task.Assign.Project.ProjectName
		} else {
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
		var p struct{ Name string }
		if err := h.DB.Table("process").Select("name").Where("id = ?", *task.ProcessID).First(&p).Error; err == nil {
			processName = p.Name
		}
	}

	noteFileName := fmt.Sprintf("note_%s.txt", uuid.New().String())
	objectPath := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/%s",
		year, quarter, projectName, className, mainName, childName, stationName, processName, noteFileName)

	if h.MinioClient != nil {
		_, err = h.MinioClient.UploadBytes([]byte(req.Note), objectPath, "text/plain")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload note: " + err.Error()})
			return
		}
	}

	if err := h.DB.Model(&task).Update("work_note", objectPath).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update work_note: " + err.Error()})
		return
	}
    h.DB.Model(&task).Update("data_note", req.Note)

	c.JSON(http.StatusOK, gin.H{"message": "Note saved successfully", "path": objectPath})
}

// GetTaskNote handles GET /monitoring/note/:id
func (h *EvidenceHandler) GetTaskNote(c *gin.Context) {
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

// SyncAllTaskImages handles POST /monitoring/sync-images
func (h *EvidenceHandler) SyncAllTaskImages(c *gin.Context) {
    // Note: This logic is duplicated from AllocationHandler but kept for now.
    // Ideally should be a Background Job or Service Method.
	var tasks []domain.TaskDetail
	if err := h.DB.
		Preload("Assign").
		Preload("Assign.Project").
		Preload("Assign.Classification").
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Where("status_submit = ?", 1).
		Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
		return
	}

	updatedCount := 0
	for _, task := range tasks {
		if task.SubmittedAt == nil {
			continue
		}
        
        // Re-construct Path (Simplified for brevity, assuming standard structure)
        // ... (Strictly speaking I should copy the full path builder logic or import it)
        // Since I'm inside the handler package, I can't easily call private methods unless I restructure.
        // I will rely on the service to do the Sync for a single task, and loop here?
        // Service.SyncAndGetImagesFromMinIO(task.ID) updates the DB.
        
        _, err := h.Service.SyncAndGetImagesFromMinIO(task.ID)
        if err == nil {
            updatedCount++
        }
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sync completed", "updated": updatedCount, "total_candidates": len(tasks)})
}

// SyncAllTaskNotes handles POST /monitoring/sync-notes
func (h *EvidenceHandler) SyncAllTaskNotes(c *gin.Context) {
    var tasks []domain.TaskDetail
    if err := h.DB.Select("id", "work_note", "data_note").
        Where("work_note != '' AND work_note IS NOT NULL").
        Find(&tasks).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
        return
    }

    updatedCount := 0
    for _, task := range tasks {
        if h.MinioClient != nil {
             objectKey := task.WorkNote
             // Skip if looks like a URL
             if strings.Contains(objectKey, "http") {
                  continue
             }
             
             content, err := h.MinioClient.GetObject(objectKey)
             if err == nil {
                 h.DB.Model(&task).Update("data_note", string(content))
                 updatedCount++
             }
        }
    }
    
    c.JSON(http.StatusOK, gin.H{"message": "Sync notes completed", "updated": updatedCount})
}

// FixLegacyImageURLs handles POST /monitoring/fix-image-urls
func (h *EvidenceHandler) FixLegacyImageURLs(c *gin.Context) {
     c.JSON(http.StatusOK, gin.H{"message": "No legacy fix required currently"})
}
