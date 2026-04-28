package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/phuc/cmms-backend/internal/config"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/messaging"
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
	larkSvc          *services.LarkService
	// Extracted services (Phase 1 refactor)
	mediaSvc    *services.AllocationMediaService
	workflowSvc *services.AllocationWorkflowService
	// Optional async image-sync queue (nil when RABBITMQ_URL not set)
	mqPublisher *messaging.Publisher
	cfg         config.Config
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
	larkSvc *services.LarkService,
	cfg config.Config,
) *AssignHandler {
	mediaSvc := services.NewAllocationMediaService(detailAssignRepo)
	var bFn services.BroadcastFunc
	if hub != nil {
		bFn = hub.BroadcastAll
	}
	workflowSvc := services.NewAllocationWorkflowService(db, detailAssignRepo, larkSvc, bFn, cfg)

	// Best-effort: connect publisher (nil-safe if RABBITMQ_URL not set)
	mqPub, mqErr := messaging.NewPublisher()
	if mqErr != nil {
		log.Printf("[AssignHandler] RabbitMQ publisher init failed (non-fatal): %v", mqErr)
	}

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
		larkSvc:          larkSvc,
		mediaSvc:         mediaSvc,
		workflowSvc:      workflowSvc,
		mqPublisher:      mqPub,
		cfg:              cfg,
	}
}

// GetPublisher exposes the internal RabbitMQ publisher so main.go can
// share it with the MinioWorker (Consumer 1) without opening a duplicate connection.
func (h *AssignHandler) GetPublisher() *messaging.Publisher {
	return h.mqPublisher
}

func (h *AssignHandler) provisionDeepFoldersForAssign(assignID uuid.UUID) {
	details, err := h.detailAssignRepo.FindByAssignID(assignID)
	if err != nil {
		return
	}

	mc, err := storage.NewMinioClient()
	if err != nil {
		return
	}

	for _, d := range details {
		ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(d.ID)
		if err != nil || ctxNames == nil {
			continue
		}

		now := time.Now()
		var assign domain.Assign
		if h.db.First(&assign, "id = ?", assignID).Error == nil && assign.StartTime != nil {
			now = *assign.StartTime
		}

		yearStr := now.Format("2006")
		monthYearStr := now.Format("01-2006")

		path := fmt.Sprintf("%s/%s/%s/Attendance", ctxNames.ProjectName, yearStr, monthYearStr)
		if ctxNames.ModelProjectName != "" {
			path += "/" + ctxNames.ModelProjectName
		}
		if ctxNames.TemplateName != "" {
			path += "/" + ctxNames.TemplateName
		}
		if ctxNames.WorkName != "" {
			path += "/" + ctxNames.WorkName
		}
		if ctxNames.ParentAssetName != "" {
			path += "/" + ctxNames.ParentAssetName
		}
		if ctxNames.AssetName != "" {
			path += "/" + ctxNames.AssetName
		}
		if ctxNames.SubWorkName != "" {
			path += "/" + ctxNames.SubWorkName
		}

		// Ensure MinIO accepts this empty file as a trick to provision folders
		objectName := path + "/.system_keep"
		emptyReader := bytes.NewReader([]byte{})
		_, _ = mc.Client.PutObject(context.Background(), mc.Bucket, objectName, emptyReader, 0, minio.PutObjectOptions{})
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

// GET /allocations/:id/tasks
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
	
	// Pre-fetch guide lines for all sub-works in this assign
	var subWorkIDs []string
	for _, detail := range assign.DetailAssigns {
		if detail.Config != nil && detail.Config.SubWorkID != uuid.Nil {
			subWorkIDs = append(subWorkIDs, detail.Config.SubWorkID.String())
		}
	}
	
	guideMap := make(map[string]bool)
	if len(subWorkIDs) > 0 {
		var guidelines []domain.GuideLine
		h.db.Where("id_sub_work IN ?", subWorkIDs).Find(&guidelines)
		for _, g := range guidelines {
			if g.GuideText != "" || string(g.GuideImages) != "[]" || g.GuideURL != "" {
				guideMap[g.SubWorkID.String()] = true
			}
		}
	}
	
	// Inject assigned_user_names and has_guide into each DetailAssign JSON
	var response []map[string]interface{}
	for _, detail := range assign.DetailAssigns {
		var detailMap map[string]interface{}
		b, _ := json.Marshal(detail)
		_ = json.Unmarshal(b, &detailMap)
		detailMap["assigned_user_names"] = userNameStr
		
		if detail.Config != nil && detail.Config.SubWorkID != uuid.Nil {
			detailMap["has_guide"] = guideMap[detail.Config.SubWorkID.String()]
		} else {
			detailMap["has_guide"] = false
		}
		
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

	// Trigger background folder provisioning to NAS immediately
	go h.provisionDeepFoldersForAssign(newAssign.ID)

	c.JSON(http.StatusCreated, newAssign)

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

	// RACE-CONDITION SAFE MERGE:
	// Read existing URLs from DB, then take the UNION of (existing ∪ incoming).
	// This prevents User B's outdated client from overwriting images already uploaded by User A.
	existingURLs := []string{}
	if len(detail.Data) > 0 && string(detail.Data) != "null" {
		_ = json.Unmarshal(detail.Data, &existingURLs)
	}
	// Deduplicate via map, keeping insertion order (existing first, then new)
	seen := make(map[string]struct{})
	mergedURLs := make([]string, 0, len(existingURLs)+len(body.Data))
	for _, u := range existingURLs {
		if _, ok := seen[u]; !ok {
			seen[u] = struct{}{}
			mergedURLs = append(mergedURLs, u)
		}
	}
	for _, u := range body.Data {
		if _, ok := seen[u]; !ok {
			seen[u] = struct{}{}
			mergedURLs = append(mergedURLs, u)
		}
	}

	isDraft := c.Query("draft") == "true"

	dataJSON, _ := json.Marshal(mergedURLs)
	detail.Data = datatypes.JSON(dataJSON)
	if body.NoteData != "" {
		detail.NoteData = body.NoteData
	}

	if !isDraft {
		detail.StatusSubmit = 1
		detail.StatusWork = 1
		var timestamps []time.Time
		if len(detail.SubmittedAt) > 0 && string(detail.SubmittedAt) != "null" {
			_ = json.Unmarshal(detail.SubmittedAt, &timestamps)
		}
		timestamps = append(timestamps, time.Now())
		tsJSON, _ := json.Marshal(timestamps)
		detail.SubmittedAt = datatypes.JSON(tsJSON)
	}

	if err := h.detailAssignRepo.Update(detail); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit detail"})
		return
	}

	// Async: upload note.txt to MinIO via media service
	h.mediaSvc.UploadNoteAsync(id, body.NoteData)

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	// Sync to Lark Base asynchronously on final submission
	if !isDraft {
		var submitterName string
		if uidVal, ok := c.Get("user_id"); ok {
			var u domain.User
			if err := h.db.First(&u, "id = ?", uidVal).Error; err == nil {
				submitterName = u.Name
			}
		}
		if submitterName == "" {
			submitterName = "Nhân sự"
		}
		frontendURL := os.Getenv("FRONTEND_URL")
		h.workflowSvc.PostSubmitAsync(id, submitterName, frontendURL)
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

	// Async: upload note.txt to MinIO via media service
	h.mediaSvc.UploadNoteAsync(id, body.Note)

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

	if newData == nil {
		newData = []string{} // Đảm bảo GORM không map thành 'null' bytes
	}

	dataJSON, _ := json.Marshal(newData)
	
	// Ép GORM cập nhật đích danh cột data
	if err := h.db.Model(detail).UpdateColumn("data", datatypes.JSON(dataJSON)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update db after deleting picture"})
		return
	}

	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted", "data": newData})
}

// POST /details/:id/upload-image — receives an image from the mobile client.
//
// ASYNC PATH (when RabbitMQ is configured):
//   1. Stage the file to disk at /tmp/om_uploads/<uuid><ext>  (≈0ms)
//   2. Publish UploadRequestEvent → Topic 1 (chiều đi: → MinIO Worker)
//   3. Return 200 immediately — MinIO Worker handles the rest asynchronously.
//
// SYNC FALLBACK (no RabbitMQ or publish failed):
//   - Stream directly to MinIO then return 200 (old behaviour).
func (h *AssignHandler) UploadDetailImage(c *gin.Context) {
	detailAssignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid detail ID"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	// Determine MIME type from extension
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
		contentType = mime.TypeByExtension(ext)
		if contentType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file format: " + ext})
			return
		}
	}

	// Build the deterministic MinIO object path (same regardless of sync/async path)
	objectPath, err := h.mediaSvc.BuildMinioObjectPath(detailAssignID, fileHeader.Filename, ext, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build object path"})
		return
	}

	// ── ASYNC PATH: RabbitMQ available ────────────────────────────────────────
	if h.mqPublisher != nil {
		// Stage file to disk (/tmp/om_uploads/)
		stageDir := os.Getenv("UPLOAD_STAGE_DIR")
		if stageDir == "" {
			stageDir = "/tmp/om_uploads"
		}
		if mkErr := os.MkdirAll(stageDir, 0750); mkErr != nil {
			log.Printf("[UploadDetailImage] mkdir stage dir failed: %v — falling back to sync", mkErr)
			goto syncPath
		}

		{
			// Deterministically encode objectPath so Smart Proxy can find it later
			b64Key := base64.URLEncoding.EncodeToString([]byte(objectPath))
			tempName := b64Key + ext
			tempPath := filepath.Join(stageDir, tempName)

			src, openErr := fileHeader.Open()
			if openErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open upload"})
				return
			}
			defer src.Close()

			dst, createErr := os.Create(tempPath)
			if createErr != nil {
				log.Printf("[UploadDetailImage] create temp file failed: %v — falling back to sync", createErr)
				goto syncPath
			}
			if _, copyErr := io.Copy(dst, src); copyErr != nil {
				dst.Close()
				os.Remove(tempPath)
				log.Printf("[UploadDetailImage] copy to temp file failed: %v — falling back to sync", copyErr)
				goto syncPath
			}
			dst.Close()

			// Publish to Topic 1 (chiều đi)
			event := messaging.UploadRequestEvent{
				DetailAssignID: detailAssignID.String(),
				TempPath:       tempPath,
				ObjectPath:     objectPath,
				Filename:       fileHeader.Filename,
				MimeType:       contentType,
				FileSizeBytes:  fileHeader.Size,
				QueuedAt:       time.Now(),
			}
			if pubErr := h.mqPublisher.PublishUploadRequest(event); pubErr != nil {
				// Publish failed — clean up temp file and fall through to sync
				os.Remove(tempPath)
				log.Printf("[UploadDetailImage] RabbitMQ publish failed: %v — falling back to sync", pubErr)
				goto syncPath
			}

			// Derive the eventual MinIO URL (same formula MinioWorker will produce)
			previewURL, urlErr := h.mediaSvc.GetMinioURL(objectPath)
			if urlErr != nil {
				// Fallback to objectPath if deterministic URL mapping fails
				previewURL = objectPath
			}
			log.Printf("[UploadDetailImage] Queued async upload: detail=%s path=%s", detailAssignID, objectPath)
			c.JSON(http.StatusOK, gin.H{
				"url":         previewURL,
				"object_name": objectPath,
				"queued":      true,
				"async":       true,
			})
			return
		}
	}

syncPath:
	// ── SYNC FALLBACK: stream directly to MinIO ───────────────────────────────
	{
		file, openErr := fileHeader.Open()
		if openErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
			return
		}
		defer file.Close()

		url, syncObjPath, uploadErr := h.mediaSvc.UploadDetailFile(detailAssignID, fileHeader.Filename, file, fileHeader.Size)
		if uploadErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": uploadErr.Error()})
			return
		}

		log.Printf("[UploadDetailImage] Sync upload to MinIO: detail=%s url=%s", detailAssignID, url)

		// Dual-Write: Copy sang NAS (nếu NAS_STORAGE_DIR được cấu hình)
		if nasRoot := os.Getenv("NAS_STORAGE_DIR"); nasRoot != "" && syncObjPath != "" {
			nasDestPath := filepath.Join(nasRoot, filepath.FromSlash(syncObjPath))
			if mkErr := os.MkdirAll(filepath.Dir(nasDestPath), 0o755); mkErr != nil {
				log.Printf("[NAS Dual-Write] WARN: cannot create dir for %s: %v", nasDestPath, mkErr)
			} else if nasFile, openErr2 := fileHeader.Open(); openErr2 != nil {
				log.Printf("[NAS Dual-Write] WARN: cannot re-open upload for NAS copy: %v", openErr2)
			} else {
				func() {
					defer nasFile.Close()
					dst, createErr := os.Create(nasDestPath)
					if createErr != nil {
						log.Printf("[NAS Dual-Write] WARN: cannot create NAS file %s: %v", nasDestPath, createErr)
						return
					}
					defer dst.Close()
					if _, copyErr := io.Copy(dst, nasFile); copyErr != nil {
						log.Printf("[NAS Dual-Write] WARN: copy to NAS failed for %s: %v", nasDestPath, copyErr)
						return
					}
					_ = dst.Sync()
					log.Printf("[NAS Dual-Write] OK (sync): %s → %s", fileHeader.Filename, nasDestPath)
				}()
			}
		}

		// Write URL to Postgres directly via existing RabbitMQ consumer (if live)
		if h.mqPublisher != nil {
			dbEvent := messaging.ImageUploadedEvent{
				DetailAssignID: detailAssignID.String(),
				MinioURL:       url,
				ObjectPath:     syncObjPath,
				Filename:       fileHeader.Filename,
				MimeType:       fileHeader.Header.Get("Content-Type"),
				FileSizeBytes:  fileHeader.Size,
				UploadedAt:     time.Now(),
			}
			_ = h.mqPublisher.Publish(dbEvent) // best-effort
		}

		c.JSON(http.StatusOK, gin.H{
			"url":         url,
			"object_name": syncObjPath,
		})
	}
}



// DELETE /details/:id/images - Xóa toàn bộ hình ảnh của 1 quy trình (folder MinIO + DB)
func (h *AssignHandler) DeleteDetailImages(c *gin.Context) {
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

	// Build folder prefix (same logic as UploadDetailImage path, minus filename)
	ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch path context"})
		return
	}

	now := time.Now()
	yearStr := now.Format("2006")
	monthYearStr := now.Format("01-2006")

	var assetPathSegment string
	if ctxNames.ParentAssetName != "" {
		assetPathSegment = utils.SlugifyName(ctxNames.ParentAssetName) + "/" + utils.SlugifyName(ctxNames.AssetName)
	} else {
		assetPathSegment = utils.SlugifyName(ctxNames.AssetName)
	}

	// Folder prefix without trailing slash – MinIO lists everything under it recursively
	folderPrefix := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/%s",
		utils.SlugifyName(ctxNames.ProjectName),
		yearStr,
		monthYearStr,
		utils.SlugifyName(ctxNames.ModelProjectName),
		utils.SlugifyName(ctxNames.TemplateName),
		utils.SlugifyName(ctxNames.WorkName),
		utils.SlugifyName(ctxNames.SubWorkName),
		assetPathSegment,
		utils.SlugifyName(ctxNames.ProcessName),
	)

	minioClient, err := storage.NewMinioClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to object storage"})
		return
	}

	deleted, err := minioClient.DeleteFolder(folderPrefix)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete folder from MinIO: %v", err)})
		return
	}

	// Clear DB data array directly via UpdateColumn to avoid silent GORM skips
	if err := h.db.Model(detail).UpdateColumn("data", datatypes.JSON([]byte("[]"))).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MinIO cleared but failed to update DB"})
		return
	}

	// Broadcast so all clients refresh
	if h.hub != nil {
		h.hub.BroadcastAll([]byte(`{"event":"task_updated"}`))
	}

	log.Printf("[DeleteDetailImages] Deleted %d objects under prefix: %s\n", deleted, folderPrefix)
	c.JSON(http.StatusOK, gin.H{
		"message":       "Đã xóa toàn bộ hình ảnh",
		"deleted_count": deleted,
		"prefix":        folderPrefix,
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
		FrontendURL  string `json:"frontend_url"`
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

	var actorID string
	if authID, exists := c.Get("user_id"); exists {
		actorID = fmt.Sprintf("%v", authID)
	}

	// Track who approved
	if actorID != "" {
		var personIDs []string
		_ = json.Unmarshal(detail.IdPersonApprove, &personIDs)
		personIDs = append(personIDs, actorID)
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

	// Async: Lark sync
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

		// LARK SYNC
		if body.FrontendURL != "" && h.larkSvc != nil {
			h.syncCompletedTaskToLark(detailCopy, assign, userIDs, actorID, body.FrontendURL, ctxNames)
		}
	}()

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
		NoteReject  string `json:"note_reject"`
		FrontendURL string `json:"frontend_url"`
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

	var actorID string
	if authID, exists := c.Get("user_id"); exists {
		actorID = fmt.Sprintf("%v", authID)
	}

	// Track who rejected
	if actorID != "" {
		var personIDs []string
		_ = json.Unmarshal(detail.IdPersonReject, &personIDs)
		personIDs = append(personIDs, actorID)
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

	// Async: Lark sync
	detailCopy := *detail
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

		// LARK SYNC — push to "TỪ CHỐI TASK" table
		if body.FrontendURL != "" && h.larkSvc != nil {
			h.syncRejectedTaskToLark(detailCopy, assign, userIDs, actorID, body.FrontendURL, ctxNames)
		}
	}()

	c.JSON(http.StatusOK, detail)
}

// PUT /task-details/bulk/status - Bulk Approve/Reject
func (h *AssignHandler) BulkUpdateDetailStatus(c *gin.Context) {
	var body struct {
		IDs         []string `json:"ids"`
		Accept      int      `json:"accept"`
		Note        string   `json:"note"`
		FrontendURL string   `json:"frontend_url"`
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

			// LARK SYNC
			if body.FrontendURL != "" && h.larkSvc != nil {
				detailCopy := *detail
				go func(d domain.DetailAssign) {
					var assign domain.Assign
					if err := h.db.First(&assign, "id = ?", d.AssignID).Error; err != nil {
						return
					}
					var userIDs []string
					_ = json.Unmarshal(assign.UserIDs, &userIDs)
					ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(d.ID)
					if err != nil {
						return
					}
					h.syncCompletedTaskToLark(d, assign, userIDs, fmt.Sprintf("%v", actorIDStr), body.FrontendURL, ctxNames)
				}(detailCopy)
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

			// LARK SYNC (REJECTION)
			log.Printf("[DEBUG] BULK REJECT TRIGGERED. FrontendURL='%s', h.larkSvc=%v", body.FrontendURL, h.larkSvc != nil)
			if body.FrontendURL != "" && h.larkSvc != nil {
				log.Printf("[DEBUG] BULK REJECT ENTERED GOROUTINE!")
				detailCopy := *detail
				go func(d domain.DetailAssign) {
					var assign domain.Assign
					if err := h.db.First(&assign, "id = ?", d.AssignID).Error; err != nil {
						return
					}
					var userIDs []string
					_ = json.Unmarshal(assign.UserIDs, &userIDs)
					ctxNames, err := h.detailAssignRepo.GetNamesForMinioPath(d.ID)
					if err != nil {
						return
					}
					h.syncRejectedTaskToLark(d, assign, userIDs, fmt.Sprintf("%v", actorIDStr), body.FrontendURL, ctxNames)
				}(detailCopy)
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

// GET /api/public/report/:id  — no auth required
// Returns fully-hydrated assign data (project, owner, users, details) for public report view.
func (h *AssignHandler) GetPublicReport(c *gin.Context) {
	idStr := c.Param("id")
	assignID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assign ID"})
		return
	}

	// 1. Load assign with all relations needed for the report
	var assign domain.Assign
	err = h.db.
		Preload("Project").
		Preload("Template").
		Preload("ModelProject").
		Preload("DetailAssigns").
		Preload("DetailAssigns.Config").
		Preload("DetailAssigns.Config.Asset").
		Preload("DetailAssigns.Config.Asset.Parent").
		Preload("DetailAssigns.Config.SubWork").
		Preload("DetailAssigns.Config.SubWork.Work").
		Preload("DetailAssigns.Process").
		Where("id = ?", assignID).
		First(&assign).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assign not found"})
		return
	}

	// 2. Resolve owner from project
	type OwnerDTO struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	var owner OwnerDTO
	if assign.Project != nil {
		h.db.Table("owners").
			Select("id, name").
			Where("id = ?", assign.Project.OwnerID).
			Scan(&owner)
	}

	// 3. Resolve user names from id_user JSONB array
	type UserDTO struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	var userIDs []string
	if err := json.Unmarshal(assign.UserIDs, &userIDs); err == nil && len(userIDs) > 0 {
		// userIDs is already parsed
	}

	var users []UserDTO
	if len(userIDs) > 0 {
		h.db.Table("users").
			Select("id, name").
			Where("id IN ?", userIDs).
			Scan(&users)
	}

	// 4. Also collect all approver/rejector IDs from each detail (for name resolution)
	approverIDSet := map[string]bool{}
	for _, d := range assign.DetailAssigns {
		var ids []string
		if err := json.Unmarshal(d.IdPersonApprove, &ids); err == nil {
			for _, id := range ids {
				approverIDSet[id] = true
			}
		}
		var rejIds []string
		if err := json.Unmarshal(d.IdPersonReject, &rejIds); err == nil {
			for _, id := range rejIds {
				approverIDSet[id] = true
			}
		}
	}
	approverIDs := make([]string, 0, len(approverIDSet))
	for id := range approverIDSet {
		approverIDs = append(approverIDs, id)
	}

	var approvers []UserDTO
	if len(approverIDs) > 0 {
		h.db.Table("users").
			Select("id, name").
			Where("id IN ?", approverIDs).
			Scan(&approvers)
	}

	// 5. Return combined DTO
	c.JSON(http.StatusOK, gin.H{
		"assign":    assign,
		"owner":     owner,
		"users":     users,
		"approvers": approvers,
	})
}

// syncCompletedTaskToLark automatically sends task data to the configured Lark Base table.
func (h *AssignHandler) syncCompletedTaskToLark(
	detail domain.DetailAssign,
	assign domain.Assign,
	assigneeIDs []string,
	approverID string,
	frontendURL string,
	ctxNames *domain.MinioPathContext,
) {
	appToken := os.Getenv("LARK_APP_TOKEN")
	tableID := os.Getenv("LARK_COMPLETED_TASK_TABLE_ID")
	if appToken == "" || tableID == "" {
		log.Println("[Lark Sync] Skipped: LARK_APP_TOKEN or LARK_COMPLETED_TASK_TABLE_ID not set")
		return
	}

	// Resolve assignee names
	var assignees []domain.User
	if len(assigneeIDs) > 0 {
		h.db.Where("id IN ?", assigneeIDs).Find(&assignees)
	}
	if len(assignees) == 0 {
		assignees = append(assignees, domain.User{Name: "Kỹ thuật viên"})
	}

	// Resolve approver name
	approverName := "Quản lý"
	if approverID != "" {
		var approver domain.User
		if h.db.First(&approver, "id = ?", approverID).Error == nil {
			approverName = approver.Name
		}
	}

	// Build link
	queryParams := []string{}
	if detail.Config != nil {
		queryParams = append(queryParams, "asset="+detail.Config.AssetID.String(), "sub="+detail.Config.SubWorkID.String())
	}
	reportLink := fmt.Sprintf("%s/share/report/%s", frontendURL, assign.ID.String())
	if len(queryParams) > 0 {
		reportLink += "?" + strings.Join(queryParams, "&")
	}

	// Prepare Time
	var submittedAt string
	var approvalAt string
	
	var subTimes []time.Time
	if err := json.Unmarshal(detail.SubmittedAt, &subTimes); err == nil && len(subTimes) > 0 {
		submittedAt = subTimes[len(subTimes)-1].Format("02/01/2006 15:04:05")
	}

	var appTimes []time.Time
	if err := json.Unmarshal(detail.ApprovalAt, &appTimes); err == nil && len(appTimes) > 0 {
		approvalAt = appTimes[len(appTimes)-1].Format("02/01/2006 15:04:05")
	}

	for _, assignee := range assignees {
		fields := map[string]interface{}{
			"Họ và tên nhân sự phụ trách": assignee.Name,
			"Họ và tên Quản lý":           approverName,
			"Work":                        ctxNames.WorkName,
			"Sub - work":                  ctxNames.SubWorkName,
			"Asset":                       ctxNames.AssetName,
		}

		if reportLink != "" {
			fields["Đường dẫn"] = map[string]string{
				"link": reportLink,
				"text": "Xem Báo Cáo",
			}
		}

		if submittedAt != "" {
			fields["Thời gian Nhân sự nộp"] = submittedAt
		}
		if approvalAt != "" {
			fields["Thời gian Quản lý duyệt"] = approvalAt
		}

		err := h.larkSvc.PushReportToBitable(appToken, tableID, fields)
		if err != nil {
			log.Printf("[Lark Sync] Failed to push complete task for %s: %v\n", assignee.Name, err)
		} else {
			log.Printf("[Lark Sync] Successfully pushed complete task to Lark for %s\n", assignee.Name)
		}
	}

	// Also update the NỘP DỮ LIỆU Submit record for this assign
	submitAppToken := os.Getenv("LARK_SUBMIT_APP_TOKEN")
	submitTableID := os.Getenv("LARK_SUBMIT_TABLE_ID")
	if submitAppToken != "" && submitTableID != "" && h.larkSvc != nil {
		if err := h.larkSvc.UpdateSubmitRecord(submitAppToken, submitTableID, assign.ID.String(), ctxNames.SubWorkName, ctxNames.AssetName, ctxNames.ProcessName, approverName, approvalAt, true); err != nil {
			log.Printf("[Lark Sync] UpdateSubmitRecord (approve) failed for assign %s: %v\n", assign.ID, err)
		} else {
			log.Printf("[Lark Sync] UpdateSubmitRecord (approve) succeeded for assign %s\n", assign.ID)
		}
	}
}

// syncRejectedTaskToLark pushes rejected task data to the dedicated "TỪ CHỐI TASK" Lark Bitable table.
func (h *AssignHandler) syncRejectedTaskToLark(
	detail domain.DetailAssign,
	assign domain.Assign,
	assigneeIDs []string,
	rejectorID string,
	frontendURL string,
	ctxNames *domain.MinioPathContext,
) {
	const (
		rejectAppToken = "JbTBbo3QQaz7r5smJZilen5EgXg"
		rejectTableID  = "tblkCQwQANfv8E7g"
	)

	// Resolve assignees
	var assignees []domain.User
	if len(assigneeIDs) > 0 {
		h.db.Where("id IN ?", assigneeIDs).Find(&assignees)
	}
	if len(assignees) == 0 {
		assignees = append(assignees, domain.User{Name: "Kỹ thuật viên"})
	}

	// Resolve rejector (manager) name
	rejectorName := "Quản lý"
	if rejectorID != "" {
		var rejector domain.User
		if h.db.First(&rejector, "id = ?", rejectorID).Error == nil {
			rejectorName = rejector.Name
		}
	}

	// Build report link pointing to this detail's individual report
	queryParams := []string{}
	if detail.Config != nil {
		queryParams = append(queryParams, "asset="+detail.Config.AssetID.String(), "sub="+detail.Config.SubWorkID.String())
	}
	queryParams = append(queryParams, "type=reject") // Signal frontend to use reject template

	reportLink := fmt.Sprintf("%s/share/report/%s", frontendURL, assign.ID.String())
	if len(queryParams) > 0 {
		reportLink += "?" + strings.Join(queryParams, "&")
	}

	// Parse timestamps
	var submittedAt, rejectedAt string
	var subTimes []time.Time
	if err := json.Unmarshal(detail.SubmittedAt, &subTimes); err == nil && len(subTimes) > 0 {
		submittedAt = subTimes[len(subTimes)-1].Format("02/01/2006 15:04:05")
	}
	var rejTimes []time.Time
	if err := json.Unmarshal(detail.RejectedAt, &rejTimes); err == nil && len(rejTimes) > 0 {
		rejectedAt = rejTimes[len(rejTimes)-1].Format("02/01/2006 15:04:05")
	}

	for _, assignee := range assignees {
		fields := map[string]interface{}{
			"Họ và tên nhân sự phụ trách": assignee.Name,
			"Họ và tên Quản lý":           rejectorName,
			"Work":                        ctxNames.WorkName,
			"Sub - work":                  ctxNames.SubWorkName,
			"Asset":                       ctxNames.AssetName,
		}

		if reportLink != "" {
			fields["Đường dẫn"] = map[string]string{
				"link": reportLink,
				"text": "Xem Báo Cáo",
			}
		}
		if submittedAt != "" {
			fields["Thời gian Nhân sự nộp"] = submittedAt
		}
		if rejectedAt != "" {
			fields["Thời gian Quản lý từ chối"] = rejectedAt
		}
		if err := h.larkSvc.PushReportToBitable(rejectAppToken, rejectTableID, fields); err != nil {
			log.Printf("[Lark Sync/Reject] Failed to push rejected task for %s: %v\n", assignee.Name, err)
		} else {
			log.Printf("[Lark Sync/Reject] Successfully pushed rejected task to Lark for %s\n", assignee.Name)
		}
	}

	// Also update the NỘP DỮ LIỆU Submit record for this assign
	submitAppToken := os.Getenv("LARK_SUBMIT_APP_TOKEN")
	submitTableID := os.Getenv("LARK_SUBMIT_TABLE_ID")
	if submitAppToken != "" && submitTableID != "" && h.larkSvc != nil {
		if err := h.larkSvc.UpdateSubmitRecord(submitAppToken, submitTableID, assign.ID.String(), ctxNames.SubWorkName, ctxNames.AssetName, ctxNames.ProcessName, rejectorName, rejectedAt, false); err != nil {
			log.Printf("[Lark Sync/Reject] UpdateSubmitRecord failed for assign %s: %v\n", assign.ID, err)
		} else {
			log.Printf("[Lark Sync/Reject] UpdateSubmitRecord succeeded for assign %s\n", assign.ID)
		}
	}
}
