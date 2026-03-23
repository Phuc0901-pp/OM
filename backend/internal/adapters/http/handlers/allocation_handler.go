package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"github.com/phuc/cmms-backend/internal/infrastructure/websocket"
	"github.com/phuc/cmms-backend/internal/utils"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AssignHandler struct {
	db               *gorm.DB
	assignRepo       domain.AssignRepository
	detailAssignRepo domain.DetailAssignRepository
	configRepo       domain.ConfigRepository
	assetRepo        domain.AssetRepository
	workRepo         domain.WorkRepository
	subWorkRepo      domain.SubWorkRepository
	templateRepo     domain.TemplateRepository
	hub              *websocket.Hub
	notifSvc         *services.NotificationService // nil-safe
}

func NewAssignHandler(
	db *gorm.DB,
	assignRepo domain.AssignRepository,
	detailAssignRepo domain.DetailAssignRepository,
	configRepo domain.ConfigRepository,
	assetRepo domain.AssetRepository,
	workRepo domain.WorkRepository,
	subWorkRepo domain.SubWorkRepository,
	templateRepo domain.TemplateRepository,
	hub *websocket.Hub,
	notifSvc *services.NotificationService,
) *AssignHandler {
	return &AssignHandler{
		db:               db,
		assignRepo:       assignRepo,
		detailAssignRepo: detailAssignRepo,
		configRepo:       configRepo,
		assetRepo:        assetRepo,
		workRepo:         workRepo,
		subWorkRepo:      subWorkRepo,
		templateRepo:     templateRepo,
		hub:              hub,
		notifSvc:         notifSvc,
	}
}

// GET /assigns
func (h *AssignHandler) ListAssigns(c *gin.Context) {
	userID := c.Query("user_id")

	if userID != "" {
		// Secure per-user filter using JSONB contains
		assigns, err := h.assignRepo.FindByUserID(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assigns"})
			return
		}
		c.JSON(http.StatusOK, assigns)
		return
	}

	assigns, err := h.assignRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assigns"})
		return
	}
	c.JSON(http.StatusOK, assigns)
}


// GET /assigns/:id
func (h *AssignHandler) GetAssign(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	assign, err := h.assignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assign not found"})
		return
	}
	c.JSON(http.StatusOK, assign)
}

// GET /allocations/:id/tasks - used by NotificationDetailModal to load task data
func (h *AssignHandler) GetAssignWithTasks(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	assign, err := h.assignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assign not found"})
		return
	}
	
	// Resolve assigned users
	var userIDs []string
	if len(assign.UserIDs) > 0 && string(assign.UserIDs) != "null" {
		_ = json.Unmarshal(assign.UserIDs, &userIDs)
	}
	
	var userNames []string
	if len(userIDs) > 0 {
		var users []domain.User
		h.db.Where("id IN ?", userIDs).Find(&users)
		for _, u := range users {
			userNames = append(userNames, u.Name)
		}
	}
	
	userNameStr := strings.Join(userNames, ", ")
	if userNameStr == "" {
		userNameStr = "Chưa chỉ định"
	}
	
	// Inject assigned_user_names into each DetailAssign JSON
	var response []map[string]interface{}
	for _, detail := range assign.DetailAssigns {
		var detailMap map[string]interface{}
		b, _ := json.Marshal(detail)
		_ = json.Unmarshal(b, &detailMap)
		detailMap["assigned_user_names"] = userNameStr
		response = append(response, detailMap)
	}

	c.JSON(http.StatusOK, response)
}

// POST /assigns
type CustomConfigInput struct {
	AssetID     string   `json:"id_asset"`
	TaskName    string   `json:"task_name"` // e.g: "Kiểm tra inverter", "Khác"
	Process     []string `json:"id_process"` // array of process IDs 
	LimitImg    bool     `json:"status_set_image_count"`
	ImgCount    int      `json:"image_count"`
	NumGuide    string   `json:"guide_text"`
	GuideImages []string `json:"guide_images"`
}

// Nhận id_project -> lấy tất cả assets của project -> lấy configs của mỗi asset
// -> tự động tạo DetailAssign cho mỗi config
func (h *AssignHandler) CreateAssign(c *gin.Context) {
	var body struct {
		ProjectID      string   `json:"id_project" binding:"required"`
		ModelProjectID *string  `json:"id_model_project"`
		TemplateID     *string  `json:"id_template"`
		UserIDs        []string `json:"id_users"`
		NoteAssign     string   `json:"note_assign"`
		StartTime      *string  `json:"start_time"`
		EndTime        *string  `json:"end_time"`
		ConfigIDs      []string `json:"id_configs"`
		CustomConfigs  []CustomConfigInput `json:"custom_configs"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	projectID, err := uuid.Parse(body.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id_project"})
		return
	}

	// Prepare UserIDs JSON
	userIDsJSON, _ := json.Marshal(body.UserIDs)

	var modelProjectID *uuid.UUID
	if body.ModelProjectID != nil && *body.ModelProjectID != "" {
		parsed, err := uuid.Parse(*body.ModelProjectID)
		if err == nil {
			modelProjectID = &parsed
		}
	}

	var startTime, endTime *time.Time
	if body.StartTime != nil {
		t, err := time.Parse(time.RFC3339, *body.StartTime)
		if err == nil {
			startTime = &t
		}
	}
	if body.EndTime != nil {
		t, err := time.Parse(time.RFC3339, *body.EndTime)
		if err == nil {
			endTime = &t
		}
	}

	var templateID *uuid.UUID
	if body.TemplateID != nil && *body.TemplateID != "" {
		parsed, err := uuid.Parse(*body.TemplateID)
		if err == nil {
			templateID = &parsed
		}
	}

	newAssign := domain.Assign{
		ID:             uuid.New(),
		ProjectID:      projectID,
		ModelProjectID: modelProjectID,
		TemplateID:     templateID,
		UserIDs:        datatypes.JSON(userIDsJSON),
		NoteAssign:     body.NoteAssign,
		StartTime:      startTime,
		EndTime:        endTime,
	}

	// Create the main Assign record
	if err := h.assignRepo.Create(&newAssign); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create assign"})
		return
	}

	// Create DetailAssigns based on chosen ConfigIDs from frontend
	if len(body.CustomConfigs) > 0 {
		// Custom Flow: Find or Create a base Work named "Khác"
		var workKhac domain.Work
		if err := h.db.Where("name = ?", "Khác").First(&workKhac).Error; err != nil {
			// Not found, create it
			workKhac = domain.Work{
				ID:   uuid.New(),
				Name: "Khác",
			}
			h.workRepo.Create(&workKhac)
		}

		createdCustomConfigIDs := []uuid.UUID{}

		for _, customCfg := range body.CustomConfigs {
			assetID, err := uuid.Parse(customCfg.AssetID)
			if err != nil {
				continue
			}

			// Generate ProcessIDs array
			processIDsBytes, _ := json.Marshal(customCfg.Process)
			
			// Generate GuideImages array
			guideImagesBytes, _ := json.Marshal(customCfg.GuideImages)

			// 1. Create SubWork mapping to Work "Khác"
			newSubWork := domain.SubWork{
				ID:         uuid.New(),
				Name:       customCfg.TaskName, // "Khí thải" or "Vệ sinh bồn..."
				WorkID:     workKhac.ID,
				ProcessIDs: datatypes.JSON(processIDsBytes),
			}
			h.subWorkRepo.Create(&newSubWork)

			// 2. Create Config linking Asset & SubWork
			newConfig := domain.Config{
				ID:                  uuid.New(),
				AssetID:             assetID,
				SubWorkID:           newSubWork.ID,
				StatusSetImageCount: customCfg.LimitImg,
				ImageCount:          customCfg.ImgCount,
				GuideText:           customCfg.NumGuide,
				GuideImages:         datatypes.JSON(guideImagesBytes),
			}
			h.configRepo.Create(&newConfig)
			createdCustomConfigIDs = append(createdCustomConfigIDs, newConfig.ID)

			// 3. Create 1 DetailAssign per process ID
			if len(customCfg.Process) > 0 {
				for _, procStr := range customCfg.Process {
					procID, err := uuid.Parse(procStr)
					if err != nil {
						continue
					}
					procIDCopy := procID
					detail := domain.DetailAssign{
						ID:        uuid.New(),
						AssignID:  newAssign.ID,
						ConfigID:  &newConfig.ID,
						ProcessID: &procIDCopy,
					}
					h.detailAssignRepo.Create(&detail)
				}
			} else {
				// Fallback: no process selected, create one row without process
				detail := domain.DetailAssign{
					ID:       uuid.New(),
					AssignID: newAssign.ID,
					ConfigID: &newConfig.ID,
				}
				h.detailAssignRepo.Create(&detail)
			}
		}

		// Auto-generate a Template for reuse from these custom configs
		if len(body.CustomConfigs) > 0 && h.templateRepo != nil {
			// Build name: ModelProject.name + date
			templateName := time.Now().Format("02/01/2006")
			if modelProjectID != nil {
				var mp domain.ModelProject
				if err := h.db.First(&mp, "id = ?", *modelProjectID).Error; err == nil {
					templateName = mp.Name + " - " + templateName
				}
			}

			// Collect all created config IDs
			var createdConfigIDs []string
			for _, cid := range createdCustomConfigIDs {
				createdConfigIDs = append(createdConfigIDs, cid.String())
			}
			configIDsJSON, _ := json.Marshal(createdConfigIDs)

			newTemplate := domain.Template{
				ID:             uuid.New(),
				Name:           templateName,
				ProjectID:      projectID,
				ModelProjectID: modelProjectID,
				ConfigIDs:      datatypes.JSON(configIDsJSON),
			}
			_ = h.templateRepo.Create(&newTemplate)
		}
	} else if len(body.ConfigIDs) > 0 {
		for _, cfgStr := range body.ConfigIDs {
			cfgID, err := uuid.Parse(cfgStr)
			if err != nil {
				continue // Skip invalid uuid
			}
			// Load config with SubWork to get ProcessIDs
			var cfg domain.Config
			loadErr := h.db.Preload("SubWork").Where("id = ?", cfgID).First(&cfg).Error
			if loadErr != nil {
				// Config not found, create row without process
				detail := domain.DetailAssign{
					ID:       uuid.New(),
					AssignID: newAssign.ID,
					ConfigID: &cfgID,
				}
				_ = h.detailAssignRepo.Create(&detail)
				continue
			}
			// Extract ProcessIDs from SubWork
			var processIDs []string
			if cfg.SubWork != nil && len(cfg.SubWork.ProcessIDs) > 0 {
				_ = json.Unmarshal(cfg.SubWork.ProcessIDs, &processIDs)
			}
			if len(processIDs) > 0 {
				for _, procStr := range processIDs {
					procID, parseErr := uuid.Parse(procStr)
					if parseErr != nil {
						continue
					}
					procIDCopy := procID
					detail := domain.DetailAssign{
						ID:        uuid.New(),
						AssignID:  newAssign.ID,
						ConfigID:  &cfgID,
						ProcessID: &procIDCopy,
					}
					_ = h.detailAssignRepo.Create(&detail)
				}
			} else {
				// No process configured - create 1 row without ProcessID
				detail := domain.DetailAssign{
					ID:       uuid.New(),
					AssignID: newAssign.ID,
					ConfigID: &cfgID,
				}
				_ = h.detailAssignRepo.Create(&detail)
			}
		}
	} else {
		// Fallback: if no configs sent, fallback to auto-attaching ALL configs of project
		assets, err := h.assetRepo.FindByProjectID(projectID)
		if err == nil {
			for _, asset := range assets {
				configs, err := h.configRepo.FindByAssetID(asset.ID)
				if err != nil {
					continue
				}
				for _, cfgItem := range configs {
					cfgID := cfgItem.ID
					// Load SubWork ProcessIDs
					var processIDs []string
					if cfgItem.SubWork != nil && len(cfgItem.SubWork.ProcessIDs) > 0 {
						_ = json.Unmarshal(cfgItem.SubWork.ProcessIDs, &processIDs)
					}
					if len(processIDs) > 0 {
						for _, procStr := range processIDs {
							procID, parseErr := uuid.Parse(procStr)
							if parseErr != nil {
								continue
							}
							procIDCopy := procID
							detail := domain.DetailAssign{
								ID:        uuid.New(),
								AssignID:  newAssign.ID,
								ConfigID:  &cfgID,
								ProcessID: &procIDCopy,
							}
							_ = h.detailAssignRepo.Create(&detail)
						}
					} else {
						detail := domain.DetailAssign{
							ID:       uuid.New(),
							AssignID: newAssign.ID,
							ConfigID: &cfgID,
						}
						_ = h.detailAssignRepo.Create(&detail)
					}
				}
			}
		}
	}

	c.JSON(http.StatusCreated, newAssign)

	// Notify each assigned user about the new work assignment
	if h.notifSvc != nil && len(body.UserIDs) > 0 {
		assignID := newAssign.ID
		projectID2 := projectID
		startTimeCopy := startTime
		endTimeCopy := endTime
		userIDsCopy := make([]string, len(body.UserIDs))
		copy(userIDsCopy, body.UserIDs)
		go func() {
			var project domain.Project
			if err := h.db.First(&project, "id = ?", projectID2).Error; err != nil {
				log.Printf("[Notify] CreateAssign: failed to load project %s: %v", projectID2, err)
				return
			}
			start := time.Now()
			end := time.Now().Add(24 * time.Hour)
			if startTimeCopy != nil {
				start = *startTimeCopy
			}
			if endTimeCopy != nil {
				end = *endTimeCopy
			}
			for _, uidStr := range userIDsCopy {
				userID, err := uuid.Parse(uidStr)
				if err != nil {
					continue
				}
				var user domain.User
				if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
					continue
				}
				h.notifSvc.NotifyAssignmentDetailed(&user, project.Name, "Phân bổ công việc", start, end, nil, assignID)
			}
		}()
	}

	if h.hub != nil {
		go h.hub.BroadcastAll([]byte(`{"event":"assign_created"}`))
	}
}

// PUT /assigns/:id
func (h *AssignHandler) UpdateAssign(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	assign, err := h.assignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assign not found"})
		return
	}
	if err := c.ShouldBindJSON(assign); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	assign.ID = id
	if err := h.assignRepo.Update(assign); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assign"})
		return
	}
	c.JSON(http.StatusOK, assign)
}

// DELETE /assigns/:id
func (h *AssignHandler) DeleteAssign(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	if err := h.assignRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete assign"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Assign deleted"})
}

// ---- DetailAssign CRUD ----

// GET /assigns/:id/details
func (h *AssignHandler) ListDetailAssigns(c *gin.Context) {
	assignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	details, err := h.detailAssignRepo.FindByAssignID(assignID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch details"})
		return
	}
	c.JSON(http.StatusOK, details)
}

// POST /assigns/:id/details
func (h *AssignHandler) CreateDetailAssign(c *gin.Context) {
	assignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	var detail domain.DetailAssign
	if err := c.ShouldBindJSON(&detail); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	detail.ID = uuid.New()
	detail.AssignID = assignID
	if err := h.detailAssignRepo.Create(&detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create detail"})
		return
	}
	c.JSON(http.StatusCreated, detail)
}

// POST /details/:id/submit - Worker submits evidence
func (h *AssignHandler) SubmitDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid detail ID"})
		return
	}
	detail, err := h.detailAssignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Detail not found"})
		return
	}

	var body struct {
		Data     []string `json:"data"`
		NoteData string   `json:"note_data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dataJSON, _ := json.Marshal(body.Data)
	detail.Data = datatypes.JSON(dataJSON)
	detail.NoteData = body.NoteData
	detail.StatusSubmit = 1
	detail.StatusWork = 1

	var timestamps []time.Time
	_ = json.Unmarshal(detail.SubmittedAt, &timestamps)
	timestamps = append(timestamps, time.Now())
	tsJSON, _ := json.Marshal(timestamps)
	detail.SubmittedAt = datatypes.JSON(tsJSON)

	if err := h.detailAssignRepo.Update(detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit detail"})
		return
	}

	// Async upload note.txt to MinIO alongside images (best-effort, non-blocking)
	go func() {
		noteText := body.NoteData
		if noteText == "" {
			return
		}
		ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(id)
		if err != nil {
			fmt.Printf("[Submit Note Upload] Failed to get path context for detail %s: %v\n", id, err)
			return
		}
		minioClient, err := storage.NewMinioClient()
		if err != nil {
			fmt.Printf("[Submit Note Upload] Failed to connect to MinIO: %v\n", err)
			return
		}
		now := time.Now()
		yearStr := now.Format("2006")
		monthYearStr := now.Format("01-2006")
		notePath := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/note.txt",
			utils.SlugifyName(ctxNames.ProjectName),
			yearStr,
			monthYearStr,
			utils.SlugifyName(ctxNames.ModelProjectName),
			utils.SlugifyName(ctxNames.WorkName),
			utils.SlugifyName(ctxNames.SubWorkName),
			utils.SlugifyName(ctxNames.AssetName),
			utils.SlugifyName(ctxNames.ProcessName),
		)
		_, uploadErr := minioClient.UploadBytes([]byte(noteText), notePath, "text/plain")
		if uploadErr != nil {
			fmt.Printf("[Submit Note Upload] Failed to upload note.txt to %s: %v\n", notePath, uploadErr)
		} else {
			fmt.Printf("[Submit Note Upload] Saved note.txt: %s\n", notePath)
		}
	}()

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

   // Notify managers: nhân sự vừa nộp dữ liệu
   if h.notifSvc != nil {
           detailCopy := *detail
           go func() {
                   // Resolve submitter name from JWT context
                   var submitterName string
                   if uidStr, ok := c.Get("user_id"); ok {
                           var u domain.User
                           if err := h.db.First(&u, "id = ?", uidStr).Error; err == nil {
                                   submitterName = u.Name
                           }
                   }
                   if submitterName == "" {
                           submitterName = "Nhân sự"
                   }
                   // Get context names for rich message
                   projectInfo := ""
                   workInfo := ""
                   ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(detailCopy.ID)
                   if err == nil {
                           projectInfo = ctxNames.ProjectName
                           workInfo = ctxNames.SubWorkName
                   }
                   msg := submitterName + " vừa nộp dữ liệu công việc"
                   if projectInfo != "" {
                    msg += " [" + projectInfo + "]"
                   }
                   if workInfo != "" {
                    msg += " - " + workInfo
                   }
                   msg += ". Cần phê duyệt."
                   h.notifSvc.NotifyManagers(
                           "Nộp dữ liệu mới",
                           msg,
                           map[string]interface{}{
                                   "type":      "submission",
                                                                      "task_id":   detailCopy.ID.String(),
"detail_id": detailCopy.ID.String(),
                                   "assign_id": detailCopy.AssignID.String(),
                           },
                   )
           }()
   }

	c.JSON(http.StatusOK, detail)
}


// PUT /details/:id/note - LƯU TỨC THÌ GHI CHÚ
func (h *AssignHandler) SaveDetailNote(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid detail ID"})
		return
	}
	detail, err := h.detailAssignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Detail not found"})
		return
	}

	var body struct {
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid format"})
		return
	}

	detail.NoteData = body.Note
	if err := h.detailAssignRepo.Update(detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save note"})
		return
	}

	// Async upload note.txt to MinIO with same path context as images (best-effort, non-blocking)
	go func() {
		if body.Note == "" {
			return
		}
		ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(id)
		if err != nil {
			fmt.Printf("[Note Upload] Failed to get path context for detail %s: %v\n", id, err)
			return
		}
		minioClient, err := storage.NewMinioClient()
		if err != nil {
			fmt.Printf("[Note Upload] Failed to connect to MinIO: %v\n", err)
			return
		}
		now := time.Now()
		yearStr := now.Format("2006")
		monthYearStr := now.Format("01-2006")
		notePath := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/note.txt",
			utils.SlugifyName(ctxNames.ProjectName),
			yearStr,
			monthYearStr,
			utils.SlugifyName(ctxNames.ModelProjectName),
			utils.SlugifyName(ctxNames.WorkName),
			utils.SlugifyName(ctxNames.SubWorkName),
			utils.SlugifyName(ctxNames.AssetName),
			utils.SlugifyName(ctxNames.ProcessName),
		)
		noteContent := []byte(body.Note)
		_, uploadErr := minioClient.UploadBytes(noteContent, notePath, "text/plain")
		if uploadErr != nil {
			fmt.Printf("[Note Upload] Failed to upload note.txt to MinIO at %s: %v\n", notePath, uploadErr)
		} else {
			fmt.Printf("[Note Upload] Saved note.txt to MinIO: %s\n", notePath)
		}
	}()

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	c.JSON(http.StatusOK, detail)
}


// DELETE /details/:id/image - XÓA TỪNG ẢNH ĐỘC LẬP TRONG MẢNG DB + MINIO (TUỲ CHỌN)
func (h *AssignHandler) DeleteDetailImage(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid detail ID"})
		return
	}
	detail, err := h.detailAssignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Detail not found"})
		return
	}

	var body struct {
		Url string `json:"url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "URL to delete is required"})
		return
	}

	// Read Current JSON array
	var currentData []string
	if len(detail.Data) > 0 && string(detail.Data) != "null" {
		if err := json.Unmarshal(detail.Data, &currentData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot read current images data"})
			return
		}
	}

	// Filter out the deleted url
	var newData []string
	deletedObjName := "" // Optional: If we want to physically delete from MinIO
	for _, imgUrl := range currentData {
		if imgUrl == body.Url {
			// Extract ObjectName from URL ?key=... or minio path format
			deletedObjName = imgUrl
		} else {
			newData = append(newData, imgUrl)
		}
	}

	if deletedObjName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Image not found in array record"})
		return
	}

	// OPTIONAL: Physically delete from MinIO Storage
	// Note: We need minioClient. For now, we just delete logic in DB
	minioClient, err := storage.NewMinioClient()
	if err == nil && minioClient != nil {
		// Clean URL to plain object Name
		objNameForMinio := deletedObjName
		if strings.Contains(deletedObjName, "key=") {
			parts := strings.Split(deletedObjName, "key=")
			objNameForMinio = parts[1]
		} else if strings.HasPrefix(deletedObjName, "http") || strings.HasPrefix(deletedObjName, "/") {
			// fallback guessing object path if stored directly
			objNameForMinio = deletedObjName
		}
		
		// Un-encode URL if it's encoded
		unescaped := strings.ReplaceAll(objNameForMinio, "%2F", "/")
		objNameForMinio = unescaped
		
		_ = minioClient.RemoveObject(objNameForMinio)
	}

	// Override JSON array
	dataJSON, _ := json.Marshal(newData)
	detail.Data = datatypes.JSON(dataJSON)

	if err := h.detailAssignRepo.Update(detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update db after deleting picture"})
		return
	}

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted", "data": newData})
}

// POST /details/:id/upload-image - Upload a single evidence image for a DetailAssign
func (h *AssignHandler) UploadDetailImage(c *gin.Context) {
	detailAssignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid detail ID"})
		return
	}

	// 1. Get file from form
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	// Validate extension
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	allowedExts := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".mp4":  "video/mp4",
		".webm": "video/webm",
	}
	contentType, ok := allowedExts[ext]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported file output format"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// 2. Fetch Context Names via single SQL JOIN to build the folder path
	ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(detailAssignID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch context names for path generation"})
		return
	}

	// 3. Format time
	now := time.Now()
	yearStr := now.Format("2006")
	monthYearStr := now.Format("01-2006")

	// 4. Build MinIO Path using Slugify
	// Format: <Project>/<Year>/<Month>-<Year>/<Model_project>/<Template_Name>/<Work>/<Subwork>/<Asset>/<Process>/[uuid].<ext>
	fileID := uuid.New().String()
	minioPath := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/%s/%s%s",
		utils.SlugifyName(ctxNames.ProjectName),
		yearStr,
		monthYearStr,
		utils.SlugifyName(ctxNames.ModelProjectName),
		utils.SlugifyName(ctxNames.TemplateName),
		utils.SlugifyName(ctxNames.WorkName),
		utils.SlugifyName(ctxNames.SubWorkName),
		utils.SlugifyName(ctxNames.AssetName),
		utils.SlugifyName(ctxNames.ProcessName),
		fileID,
		ext,
	)

	// 5. Retrieve MinIO Client (It needs to be injected into AssignHandler or created locally; 
	// To avoid widespread refactor, we inject it or we can fetch it via storage.NewMinioClient if it's singleton.
	// Since AssignHandler does not have MinioClient in struct yet, we will initialize it here or you should pass it from main.go)
	
	// FIX: Initialize minio client locally for now to avoid breaking parameters in main.go
	minioClient, err := storage.NewMinioClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to object storage"})
		return
	}

	// 6. Upload Object
	url, err := minioClient.UploadBytes(data, minioPath, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to upload image: %v", err)})
		return
	}

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	c.JSON(http.StatusOK, gin.H{
		"url": url,
		"object_name": minioPath, // Optionally return the raw path for DB
	})
}

// POST /details/:id/approve - Manager approves
func (h *AssignHandler) ApproveDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid detail ID"})
		return
	}
	detail, err := h.detailAssignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Detail not found"})
		return
	}

	var body struct {
		NoteApproval string `json:"note_approval"`
	}
	_ = c.ShouldBindJSON(&body)

	detail.StatusApprove = 1
	detail.StatusReject = 0
	detail.NoteApproval = body.NoteApproval

	var timestamps []time.Time
	_ = json.Unmarshal(detail.ApprovalAt, &timestamps)
	timestamps = append(timestamps, time.Now())
	tsJSON, _ := json.Marshal(timestamps)
	detail.ApprovalAt = datatypes.JSON(tsJSON)

	// Track who approved
	if actorIDStr, exists := c.Get("user_id"); exists {
		var personIDs []string
		_ = json.Unmarshal(detail.IdPersonApprove, &personIDs)
		personIDs = append(personIDs, fmt.Sprintf("%v", actorIDStr))
		pJSON, _ := json.Marshal(personIDs)
		detail.IdPersonApprove = datatypes.JSON(pJSON)
	}

	if err := h.detailAssignRepo.Update(detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve detail"})
		return
	}

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	// Notify the engineer: công việc đã được duyệt
	if h.notifSvc != nil {
		detailCopy := *detail
		go func() {
			// Load the assign to find who submitted
			var assign domain.Assign
			if err := h.db.First(&assign, "id = ?", detailCopy.AssignID).Error; err != nil {
				return
			}
			var userIDs []string
			_ = json.Unmarshal(assign.UserIDs, &userIDs)
			ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(detailCopy.ID)
			if err != nil {
				return
			}
			taskName := ctxNames.SubWorkName + " - " + ctxNames.AssetName
			for _, uidStr := range userIDs {
				userID, err := uuid.Parse(uidStr)
				if err != nil {
					continue
				}
				var user domain.User
				if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
					continue
				}
				h.notifSvc.NotifyTaskStatusUpdate(&user, taskName, ctxNames.ProjectName, true, "", time.Now(), detailCopy.ID, detailCopy.AssignID, nil)
			}
		}()
	}

	c.JSON(http.StatusOK, detail)
}

// POST /details/:id/reject - Manager rejects
func (h *AssignHandler) RejectDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid detail ID"})
		return
	}
	detail, err := h.detailAssignRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Detail not found"})
		return
	}

	var body struct {
		NoteReject string `json:"note_reject"`
	}
	_ = c.ShouldBindJSON(&body)

	detail.StatusReject = 1
	detail.StatusApprove = 0
	detail.StatusSubmit = 0
	detail.NoteReject = body.NoteReject

	var timestamps []time.Time
	_ = json.Unmarshal(detail.RejectedAt, &timestamps)
	timestamps = append(timestamps, time.Now())
	tsJSON, _ := json.Marshal(timestamps)
	detail.RejectedAt = datatypes.JSON(tsJSON)

	// Track who rejected
	if actorIDStr, exists := c.Get("user_id"); exists {
		var personIDs []string
		_ = json.Unmarshal(detail.IdPersonReject, &personIDs)
		personIDs = append(personIDs, fmt.Sprintf("%v", actorIDStr))
		pJSON, _ := json.Marshal(personIDs)
		detail.IdPersonReject = datatypes.JSON(pJSON)
	}

	if err := h.detailAssignRepo.Update(detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject detail"})
		return
	}

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	// Notify the engineer: công việc bị từ chối
	if h.notifSvc != nil {
		detailCopy := *detail
		reasonCopy := body.NoteReject
		go func() {
			var assign domain.Assign
			if err := h.db.First(&assign, "id = ?", detailCopy.AssignID).Error; err != nil {
				return
			}
			var userIDs []string
			_ = json.Unmarshal(assign.UserIDs, &userIDs)
			ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(detailCopy.ID)
			if err != nil {
				return
			}
			taskName := ctxNames.SubWorkName + " - " + ctxNames.AssetName
			for _, uidStr := range userIDs {
				userID, err := uuid.Parse(uidStr)
				if err != nil {
					continue
				}
				var user domain.User
				if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
					continue
				}
				h.notifSvc.NotifyTaskStatusUpdate(&user, taskName, ctxNames.ProjectName, false, reasonCopy, time.Now(), detailCopy.ID, detailCopy.AssignID, nil)
			}
		}()
	}

	c.JSON(http.StatusOK, detail)
}

// PUT /task-details/bulk/status - Bulk Approve/Reject
func (h *AssignHandler) BulkUpdateDetailStatus(c *gin.Context) {
	var body struct {
		IDs    []string `json:"ids"`
		Accept int      `json:"accept"`
		Note   string   `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if len(body.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no ids provided"})
		return
	}

	var successCount int
	for _, idStr := range body.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue // Skip invalid UUIDs
		}

		detail, err := h.detailAssignRepo.FindByID(id)
		if err != nil {
			continue
		}

		actorIDStr, _ := c.Get("user_id")
		if body.Accept == 1 {
			// Approve logic
			detail.StatusApprove = 1
			detail.StatusReject = 0
			detail.NoteApproval = body.Note

			var timestamps []time.Time
			_ = json.Unmarshal(detail.ApprovalAt, &timestamps)
			timestamps = append(timestamps, time.Now())
			tsJSON, _ := json.Marshal(timestamps)
			detail.ApprovalAt = datatypes.JSON(tsJSON)

			// Track who approved
			if actorIDStr != nil {
				var personIDs []string
				_ = json.Unmarshal(detail.IdPersonApprove, &personIDs)
				personIDs = append(personIDs, fmt.Sprintf("%v", actorIDStr))
				pJSON, _ := json.Marshal(personIDs)
				detail.IdPersonApprove = datatypes.JSON(pJSON)
			}
		} else if body.Accept == -1 {
			// Reject logic
			detail.StatusReject = 1
			detail.StatusApprove = 0
			detail.StatusSubmit = 0
			detail.NoteReject = body.Note

			var timestamps []time.Time
			_ = json.Unmarshal(detail.RejectedAt, &timestamps)
			timestamps = append(timestamps, time.Now())
			tsJSON, _ := json.Marshal(timestamps)
			detail.RejectedAt = datatypes.JSON(tsJSON)

			// Track who rejected
			if actorIDStr != nil {
				var personIDs []string
				_ = json.Unmarshal(detail.IdPersonReject, &personIDs)
				personIDs = append(personIDs, fmt.Sprintf("%v", actorIDStr))
				pJSON, _ := json.Marshal(personIDs)
				detail.IdPersonReject = datatypes.JSON(pJSON)
			}
		} else if body.Accept == 0 {
			// Reset logic
			detail.StatusReject = 0
			detail.StatusApprove = 0
			detail.StatusSubmit = 0
		}

		if err := h.detailAssignRepo.Update(detail); err == nil {
			successCount++
		}
	}

	if h.hub != nil && successCount > 0 {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Bulk update completed",
		"success_count":   successCount,
		"total_requested": len(body.IDs),
	})
}


// GET /assigns/history - list soft-deleted assigns
func (h *AssignHandler) ListDeletedAssigns(c *gin.Context) {
	assigns, err := h.assignRepo.FindAllDeleted()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch deleted assigns"})
		return
	}
	c.JSON(http.StatusOK, assigns)
}

// POST /assigns/:id/restore - restore soft-deleted assign
func (h *AssignHandler) RestoreAssign(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	if err := h.assignRepo.Restore(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore assign"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Assign restored"})
}

// DELETE /assigns/:id/permanent - permanently delete assign
func (h *AssignHandler) PermanentDeleteAssign(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}
	if err := h.assignRepo.PermanentDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete assign"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Assign permanently deleted"})
}
