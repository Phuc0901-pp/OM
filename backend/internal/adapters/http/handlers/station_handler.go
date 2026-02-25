package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
)

type StationHandler struct {
	Repo        domain.StationRepository
	MinioClient *storage.MinioClient
}

func NewStationHandler(repo domain.StationRepository, minioClient *storage.MinioClient) *StationHandler {
	return &StationHandler{
		Repo:        repo,
		MinioClient: minioClient,
	}
}

// GetStations handles generic search for stations (e.g. by project and main category)
func (h *StationHandler) GetStations(c *gin.Context) {
	mainCategoryIDStr := c.Query("main_category_id")
	projectIDStr := c.Query("project_id")

	// If no filters provided, return ALL stations
	if mainCategoryIDStr == "" && projectIDStr == "" {
		stations, err := h.Repo.GetAllStations()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, stations)
		return
	}

	if mainCategoryIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "main_category_id is required"})
		return
	}
	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	mainID, err := uuid.Parse(mainCategoryIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Main Category ID"})
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Project ID"})
		return
	}

	stations, err := h.Repo.GetStationsByMainCategoryID(mainID, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stations)
}

// GetStationsByUserID handles GET /stations/user/:userId
// Fetches all stations assigned to a specific user via assign_id relationship
func (h *StationHandler) GetStationsByUserID(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid User ID"})
		return
	}

	stations, err := h.Repo.GetStationsByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, stations)
}

func (h *StationHandler) CreateStation(c *gin.Context) {
	var req struct {
		Name           string `json:"name" binding:"required"`
		ProjectID      string `json:"project_id" binding:"required"`      // Frontend key
		MainCategoryID string `json:"main_category_id"` // Frontend key
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil || projectID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}
	
	mainCategoryID, _ := uuid.Parse(req.MainCategoryID)

	station := domain.Station{
		ID:             uuid.New(),
		Name:           req.Name,
		ProjectID:      projectID,
		MainCategoryID: mainCategoryID,
	}

	if err := h.Repo.CreateStation(&station); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, station)
}

func (h *StationHandler) GetStationByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Station ID"})
		return
	}

	station, err := h.Repo.GetStationByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Station not found"})
		return
	}
	c.JSON(http.StatusOK, station)
}

func (h *StationHandler) UpdateStation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Station ID"})
		return
	}

	var req domain.Station
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.ID = id

	if err := h.Repo.UpdateStation(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, req)
}

func (h *StationHandler) DeleteStation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Station ID"})
		return
	}

	if err := h.Repo.DeleteStation(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Station deleted successfully"})
}

// SaveStationConfig handles PUT /stations/:id/config
func (h *StationHandler) SaveStationConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Station ID"})
		return
	}

	var req struct {
		ChildCategoryIDs []string `json:"child_category_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Repo.UpdateStationConfig(id, req.ChildCategoryIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Station config saved successfully",
		"child_category_ids": req.ChildCategoryIDs,
	})
}

// ChildConfigRequest represents per-child configuration
type ChildConfigRequest struct {
	ProcessIDs              []string `json:"process_ids"`
	GuideText               string   `json:"guide_text"`
	GuideImages             []string `json:"guide_images"`
	ImageCount              int      `json:"image_count"`
	ProjectClassificationID string   `json:"project_classification_id"`
}

// SaveChildConfig handles PUT /stations/:id/child-config
// Saves configuration for a specific child category within a station
func (h *StationHandler) SaveChildConfig(c *gin.Context) {
	stationID := c.Param("id")
	id, err := uuid.Parse(stationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Station ID"})
		return
	}

	var req struct {
		ChildCategoryID string             `json:"child_category_id" binding:"required"`
		Config          ChildConfigRequest `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing station to verify existence
	_, err = h.Repo.GetStationByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Station not found"})
		return
	}

	// Create map for the new config
	// Since Repo.SaveChildConfig performs an UPSERT on the child_configs table,
	// we don't need to fetch and merge with existing configs anymore.
	childConfigs := map[string]interface{}{
		req.ChildCategoryID: map[string]interface{}{
			"process_ids":               req.Config.ProcessIDs,
			"guide_text":                req.Config.GuideText,
			"guide_images":              req.Config.GuideImages,
			"image_count":               req.Config.ImageCount,
			"project_classification_id": req.Config.ProjectClassificationID,
		},
	}

	// Save merged configs
	if err := h.Repo.SaveChildConfig(id, childConfigs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":           "Child config saved successfully",
		"child_category_id": req.ChildCategoryID,
		"config":            req.Config,
	})
}

// UploadGuideFile handles POST /stations/:id/upload-guide
// Uploads guide images to MinIO: <bucket>/Tài liệu hướng dẫn/<Project>/<MainCategory>/<ChildCategory>/<uuid>.ext
func (h *StationHandler) UploadGuideFile(c *gin.Context) {
	stationID := c.Param("id")
	id, err := uuid.Parse(stationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Station ID"})
		return
	}

	// Get station to verify it exists
	station, err := h.Repo.GetStationByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Station not found"})
		return
	}
	logger.Info("UploadGuideFile: Station loaded",
		zap.String("station_id", station.ID.String()),
		zap.String("project_id", station.ProjectID.String()),
		zap.String("main_category_id", station.MainCategoryID.String()),
	)

	// Get multipart form
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form: " + err.Error()})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files provided"})
		return
	}

	// Get path info
	if station.Project == nil {
		logger.Error("Project info missing for station", zap.String("station_id", station.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Project info missing for this station"})
		return
	}
	if station.MainCategory == nil {
		logger.Error("Main Category info missing for station", zap.String("station_id", station.ID.String()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Main Category info missing for this station"})
		return
	}

	projectName := station.Project.ProjectName
	mainCategoryName := station.MainCategory.Name
	
	childCategoryName := c.PostForm("child_category_name")
	childCategoryID := c.PostForm("child_category_id")

	if childCategoryName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing child_category_name"})
		return
	}

	// Upload each file to MinIO
	var uploadedURLs []string
	for _, file := range files {
		// ... (UUID gen code unchanged) ...
		// Generate UUID for unique filename
		fileUUID := uuid.New().String()
		ext := ""
		if idx := len(file.Filename) - 1; idx > 0 {
			for i := idx; i >= 0; i-- {
				if file.Filename[i] == '.' {
					ext = file.Filename[i:]
					break
				}
			}
		}
		
		// Build object path
		objectName := fmt.Sprintf("Tài liệu hướng dẫn/%s/%s/%s/%s%s", 
			projectName, mainCategoryName, childCategoryName, fileUUID, ext)
        
		logger.Info("Uploading file to MinIO", zap.String("object", objectName))

		// Open file
		src, err := file.Open()
		if err != nil {
			logger.Error("Error opening file", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file: " + err.Error()})
			return
		}
		defer src.Close()

		// Read file content
		content := make([]byte, file.Size)
		_, err = src.Read(content)
		if err != nil {
			logger.Error("Error reading file", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file: " + err.Error()})
			return
		}

		// Determine content type
		contentType := file.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		// Check if MinIO client is available
		if h.MinioClient == nil {
			logger.Error("MinIO Client is not initialized")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "MinIO storage is not configured/available"})
			return
		}

		// Upload to MinIO using injected client
		publicURL, err := h.MinioClient.UploadBytes(content, objectName, contentType)
		if err != nil {
			logger.Error("Error uploading to MinIO", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload to MinIO: " + err.Error()})
			return
		}
		
		uploadedURLs = append(uploadedURLs, publicURL)
	}

	// Return info about the station for reference
	c.JSON(http.StatusOK, gin.H{
		"message":           "Files prepared for upload",
		"station_id":        station.ID,
		"child_category_id": childCategoryID,
		"uploaded_paths":    uploadedURLs,
	})
}
