package services

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type EvidenceService struct {
	DB           *gorm.DB
	MinioClient  *storage.MinioClient
	Notification *NotificationService
}

func NewEvidenceService(db *gorm.DB, minioClient *storage.MinioClient, notification *NotificationService) *EvidenceService {
	return &EvidenceService{
		DB:           db,
		MinioClient:  minioClient,
		Notification: notification,
	}
}

// GetTaskEvidence retrieves the list of image URLs for a submitted task.
// It uses a lazy sync strategy: checks DB first, then falls back to MinIO if needed.
func (s *EvidenceService) GetTaskEvidence(taskID uuid.UUID) ([]string, error) {
	var task domain.TaskDetail
	if err := s.DB.Select("id", "status_submit", "submitted_at", "image_url").Where("id = ?", taskID).First(&task).Error; err != nil {
		return nil, fmt.Errorf("task not found")
	}

	// Strategy A: FAST PATH - If DB has URLs, use them
	if task.ImageURL != "" && task.ImageURL != "[]" {
		var storedURLs []string
		if err := json.Unmarshal([]byte(task.ImageURL), &storedURLs); err == nil && len(storedURLs) > 0 {
			var freshURLs []string
			for _, u := range storedURLs {
				if strings.Contains(u, "/media/proxy?key=") {
					freshURLs = append(freshURLs, u)
					continue
				}
				// Normalize legacy URLs if any
				freshURLs = append(freshURLs, u)
			}
			return freshURLs, nil
		}
	}

	// Strategy B: SLOW PATH - Reconstruction from MinIO
	return s.SyncAndGetImagesFromMinIO(taskID)
}

// SyncAndGetImagesFromMinIO reconstructs the folder path, lists objects from MinIO, updates the DB, and returns the URLs.
func (s *EvidenceService) SyncAndGetImagesFromMinIO(taskID uuid.UUID) ([]string, error) {
	var task domain.TaskDetail
	// Fetch full details for path reconstruction
	if err := s.DB.
		Preload("Assign").
		Preload("Assign.Project").
		Preload("Assign.Classification").
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Preload("ChildCategory.Station").
		Where("id = ?", taskID).First(&task).Error; err != nil {
		return nil, err
	}

	if task.SubmittedAt == nil {
		logger.Info("SyncEvidence: Task has no SubmittedAt, skipping", zap.String("task_id", taskID.String()))
		return []string{}, nil
	}

	prefix := s.buildEvidencePathPrefix(&task)
	if s.MinioClient == nil {
		return nil, fmt.Errorf("minio client not initialized")
	}

	logger.Info("SyncEvidence: Scanning prefix", zap.String("prefix", prefix))
	keys, err := s.MinioClient.ListObjectKeys(prefix)
	if err != nil {
		logger.Error("SyncEvidence: Error listing keys", zap.Error(err))
		return nil, err
	}

	// Fallback: If no keys found and path includes process, try parent folder (Station level)
	// This helps if images were uploaded to station root or if process name changed/missing
	if len(keys) == 0 && task.ProcessID != nil {
		// Strip the last segment (Process Name)
		// Prefix format: .../StationName/ProcessName/
		// We want: .../StationName/
		parts := strings.Split(strings.TrimSuffix(prefix, "/"), "/")
		if len(parts) > 1 {
			parentPrefix := strings.Join(parts[:len(parts)-1], "/") + "/"
			logger.Info("SyncEvidence: No keys in process folder, trying parent", zap.String("parent_prefix", parentPrefix))
			parentKeys, errParent := s.MinioClient.ListObjectKeys(parentPrefix)
			if errParent == nil && len(parentKeys) > 0 {
				logger.Info("SyncEvidence: Found keys in parent folder", zap.Int("count", len(parentKeys)))
				keys = parentKeys
			} else {
				// Grandparent Fallback (ChildCategory level)
				// Prefix: .../ChildName/StationName/
				// We want: .../ChildName/
				if len(parts) > 2 {
					grandParentPrefix := strings.Join(parts[:len(parts)-2], "/") + "/"
					logger.Info("SyncEvidence: Trying grandparent prefix", zap.String("grandparent_prefix", grandParentPrefix))
					gpKeys, errGP := s.MinioClient.ListObjectKeys(grandParentPrefix)
					if errGP == nil && len(gpKeys) > 0 {
						logger.Info("SyncEvidence: Found keys in grandparent folder", zap.Int("count", len(gpKeys)))
						keys = gpKeys
					}
				}
			}
		}
	} else {
		logger.Info("SyncEvidence: Found keys in primary prefix", zap.Int("count", len(keys)))
    }

	imageUrls := make([]string, 0)
	for _, key := range keys {
		lowerKey := strings.ToLower(key)
		if isImageFile(lowerKey) {
			encodedKey := url.QueryEscape(key)
			imageUrls = append(imageUrls, fmt.Sprintf("/api/media/proxy?key=%s", encodedKey))
		}
	}
	sort.Strings(imageUrls)

	// ALWAYS update the DB, even if empty. This clears broken links if files are truly gone.
	// If imageUrls is empty, we set it to empty list string "[]" or empty string depending on preference.
	// Frontend expects JSON array or empty.
	
	jsonBytes, _ := json.Marshal(imageUrls)
	// Only update if changed? Or just force update. 
	// To be safe and fix the "broken link" issue, we MUST overwrite what's in DB.
	if err := s.DB.Model(&task).Update("image_url", string(jsonBytes)).Error; err != nil {
		logger.Error("SyncEvidence: Failed to update DB", zap.Error(err))
    } else {
		logger.Info("SyncEvidence: Updated DB with images", zap.Int("count", len(imageUrls)))
    }

	return imageUrls, nil
}

// UploadEvidence handles the file upload logic and status updates
func (s *EvidenceService) UploadEvidence(taskID uuid.UUID, fileContent []byte, originalFilename string, contentType string) (string, error) {
	var task domain.TaskDetail
	if err := s.DB.
		Preload("Assign").
		Preload("Assign.Project").
		Preload("Assign.Classification").
		Preload("ChildCategory").
		Preload("ChildCategory.MainCategory").
		Preload("ChildCategory.Station").
		Where("id = ?", taskID).First(&task).Error; err != nil {
		return "", fmt.Errorf("task not found")
	}

	// Generate Path
	prefix := s.buildEvidencePathPrefix(&task)
	fileUUID := uuid.New().String()
	ext := getExtension(originalFilename)
	objectPath := fmt.Sprintf("%s%s%s", prefix, fileUUID, ext)

	// Upload
	if s.MinioClient == nil {
		return "", fmt.Errorf("minio unavailable")
	}
	urlStr, err := s.MinioClient.UploadBytes(fileContent, objectPath, contentType)
	if err != nil {
		return "", err
	}

	// Post-Upload Sync: Get updated list (including this new file and any others)
	// This ensures consistency if multiple uploads happen or parallel uploads
	// We re-list the folder just like SyncAndGetImagesFromMinIO
	_, _ = s.SyncAndGetImagesFromMinIO(taskID) // Ignore error, best effort sync
	
	// If sync returned empty (maybe due to eventual consistency?), ensure we at least have this one? 
	// Actually, usually immediate consistency. If strictly needed, we can append manually.
	// But let's trust re-list or append this one manually if missing.
	
	// Update Status
	updates := map[string]interface{}{
		"status_work":    1,
		"status_submit":  1,
		"submitted_at":   time.Now(),
		"status_approve": 0, // Reset approval
	}
	
	// If currently rejected, reset
	if task.StatusReject == 1 {
		updates["status_reject"] = -1
	}

    // Since SyncAndGetImagesFromMinIO already updates 'image_url', we don't need to put it in 'updates' map 
    // UNLESS the list was empty (which shouldn't happen if upload succeeded).
    // But to be safe, if we have a fullURL returned from UploadBytes, we might want to ensure it's in the list.
    
    // Let's just update status.
	if err := s.DB.Model(&task).Updates(updates).Error; err != nil {
		return "", err
	}
	
    // Notification logic has been moved exclusively to FinalizeTaskSubmission
    // to prevent duplicate notifications during file uploads.

    // Return the full list if available, or just the single URL? 
    // Usually frontend wants the list or just success.
    
    // We can return the freshly generated URL for the uploaded file just in case.
    return urlStr, nil
}


// FinalizeTaskSubmission updates the task status to submitted without uploading any new file.
func (s *EvidenceService) FinalizeTaskSubmission(taskID uuid.UUID) error {
	var task domain.TaskDetail
	if err := s.DB.
        Preload("Assign").
        Preload("Assign.Project").
        Where("id = ?", taskID).First(&task).Error; err != nil {
		return err
	}

	updates := map[string]interface{}{
		"status_work":    1,
		"status_submit":  1,
		"submitted_at":   time.Now(),
		"status_approve": 0,
	}

	if task.StatusReject == 1 {
		updates["status_reject"] = -1
	}

	if err := s.DB.Model(&task).Updates(updates).Error; err != nil {
        return err
    }

    // Notify Manager
    if s.Notification != nil {
        go func() {
            // 1. Get Task Detail with ChildCategory.MainCategory preloaded
            var fullTask domain.TaskDetail
            if err := s.DB.Preload("ChildCategory.MainCategory").Preload("Station").Preload("Process").Where("id = ?", taskID).First(&fullTask).Error; err != nil {
                return
            }
            
            // 2. Get Assign (using assign_id from task_details)
            var assign domain.Assign
            if err := s.DB.Where("id = ?", fullTask.AssignID).First(&assign).Error; err != nil {
                return
            }
            
            // 3. Get User (using id_user from assign)
            var user domain.User
            if err := s.DB.Where("id = ?", assign.UserID).First(&user).Error; err != nil {
                return
            }
            senderName := user.FullName
            
            // 4. Get Project (using project_id column, not id)
            projectName := "Unknown Project"
            var project domain.Project
            if err := s.DB.Where("project_id = ?", assign.ProjectID).First(&project).Error; err == nil {
                projectName = project.ProjectName
            }
            
            // 5. Get Main Category, Child Category, Station, Process names
            mainCat := ""
            if fullTask.ChildCategory != nil && fullTask.ChildCategory.MainCategory != nil {
                mainCat = fullTask.ChildCategory.MainCategory.Name
            }
            cName := ""
            if fullTask.ChildCategory != nil { cName = fullTask.ChildCategory.Name }
            sName := ""
            if fullTask.Station != nil { sName = fullTask.Station.Name }
            pName := ""
            if fullTask.Process != nil { pName = fullTask.Process.Name }
            
            // 6. Find Leader
            var leaderID *uuid.UUID
            var leaderUser domain.User
            if err := s.DB.Select("id_leader").Where("id = ?", user.ID).First(&leaderUser).Error; err == nil {
                leaderID = leaderUser.LeaderID
            }

            // 7. Send Notification
            if leaderID != nil {
                s.Notification.NotifySubmission(*leaderID, senderName, projectName, mainCat, cName, sName, pName, time.Now(), fullTask.ID, assign.ID, fullTask.StationID)
            } else {
                // Format: Project - Main - Child - Station - Process
                taskContent := projectName
                if mainCat != "" { taskContent += " - " + mainCat }
                if cName != "" { taskContent += " - " + cName }
                if sName != "" { taskContent += " - " + sName }
                if pName != "" { taskContent += " - " + pName }
                msg := fmt.Sprintf("Người gửi: %s\nNội dung: %s\n(Không tìm thấy Leader trực tiếp)", senderName, taskContent)
                
				metadata := map[string]interface{}{
					"type": "submission",
					"task_id": fullTask.ID.String(),
					"assign_id": assign.ID.String(),
				}

                if fullTask.StationID != nil {
                    metadata["station_id"] = fullTask.StationID.String()
                }

                s.Notification.NotifyManagers("Nộp bài (Chốt) 📝", msg, metadata)
            }
        }()
    }
    
    return nil
}

// DeleteEvidence removes a specific object and updates the DB list
func (s *EvidenceService) DeleteEvidence(taskID uuid.UUID, objectKey string) error {
	if s.MinioClient == nil {
		return fmt.Errorf("minio unavailable")
	}
	
	if err := s.MinioClient.RemoveObject(objectKey); err != nil {
		return err
	}

	// Sync DB
	var task domain.TaskDetail
	if err := s.DB.Select("id", "image_url").Where("id = ?", taskID).First(&task).Error; err != nil {
		return nil // Task gone? Ignore.
	}

	if task.ImageURL != "" {
		var urls []string
		if err := json.Unmarshal([]byte(task.ImageURL), &urls); err == nil {
			var newURLs []string
			for _, u := range urls {
				// Parse URL to check if it matches the objectKey
				uParsed, err := url.Parse(u)
				if err == nil {
					keyParam := uParsed.Query().Get("key")
					if keyParam == objectKey {
						continue // Found the match, skip adding (delete)
					}
				}
				
				// Fallback: Check if the raw URL ends with the key (for static files without params)
				if strings.Contains(u, objectKey) {
					continue
				}

				newURLs = append(newURLs, u)
			}
			
			jsonBytes, _ := json.Marshal(newURLs)
			if len(newURLs) == 0 {
				s.DB.Model(&task).Update("image_url", "")
			} else {
				s.DB.Model(&task).Update("image_url", string(jsonBytes))
			}
		}
	}
	return nil
}


// Helper to build path prefix consistently
func (s *EvidenceService) buildEvidencePathPrefix(task *domain.TaskDetail) string {
	now := time.Now()
	// Use SubmittedAt if available, else Now (for new uploads)
	if task.SubmittedAt != nil {
		now = *task.SubmittedAt
	}
	
	year := fmt.Sprintf("%d", now.Year())
	quarter := fmt.Sprintf("Q%d", (int(now.Month())-1)/3+1)
	
	projectName := "UnknownProject"
	if task.Assign != nil {
		if task.Assign.Project != nil {
			projectName = task.Assign.Project.ProjectName
		} else {
			// Try manual fetch if missing
             var p domain.Project
             if err := s.DB.Select("project_name").Where("project_id = ?", task.Assign.ProjectID).First(&p).Error; err == nil {
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
	if task.StationID != nil { // Prioritize direct StationID
		var st domain.Station
		if err := s.DB.Select("name").First(&st, *task.StationID).Error; err == nil {
			stationName = st.Name
		}
	} else if task.ChildCategory != nil && task.ChildCategory.Station != nil {
		stationName = task.ChildCategory.Station.Name
	}

	processName := "UnknownProcess"
	if task.ProcessID != nil {
		var p struct { Name string }
		if err := s.DB.Table("process").Select("name").Where("id = ?", *task.ProcessID).First(&p).Error; err == nil {
			processName = p.Name
		}
	}

	return fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/", 
		year, quarter, projectName, className, mainName, childName, stationName, processName)
}

func isImageFile(filename string) bool {
	return strings.HasSuffix(filename, ".jpg") || 
	       strings.HasSuffix(filename, ".jpeg") || 
	       strings.HasSuffix(filename, ".png") || 
	       strings.HasSuffix(filename, ".gif") || 
	       strings.HasSuffix(filename, ".webp") ||
	       strings.HasSuffix(filename, ".webm")
}

func getExtension(filename string) string {
	if len(filename) > 4 {
		for i := len(filename) - 1; i >= 0; i-- {
			if filename[i] == '.' {
				return filename[i:]
			}
		}
	}
	return ""
}
