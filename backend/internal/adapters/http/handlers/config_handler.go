package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
)

type ConfigHandler struct {
	configRepo domain.ConfigRepository
}

func NewConfigHandler(configRepo domain.ConfigRepository) *ConfigHandler {
	return &ConfigHandler{configRepo: configRepo}
}

// GET /configs?project_id=...&asset_id=...
func (h *ConfigHandler) ListConfigs(c *gin.Context) {
	// Filter by project_id (via JOIN on assets table)
	projectIDStr := c.Query("project_id")
	if projectIDStr != "" {
		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project_id"})
			return
		}
		configs, err := h.configRepo.FindByProjectID(projectID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch configs"})
			return
		}
		c.JSON(http.StatusOK, configs)
		return
	}
	assetIDStr := c.Query("asset_id")
	if assetIDStr != "" {
		assetID, err := uuid.Parse(assetIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset_id"})
			return
		}
		configs, err := h.configRepo.FindByAssetID(assetID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch configs"})
			return
		}
		c.JSON(http.StatusOK, configs)
		return
	}
	configs, err := h.configRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch configs"})
		return
	}
	c.JSON(http.StatusOK, configs)
}

// GET /configs/:id
func (h *ConfigHandler) GetConfig(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}
	config, err := h.configRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
		return
	}
	c.JSON(http.StatusOK, config)
}

// POST /configs
func (h *ConfigHandler) CreateConfig(c *gin.Context) {
	var body struct {
		AssetID             string   `json:"id_asset" binding:"required"`
		SubWorkID           string   `json:"id_sub_work" binding:"required"`
		StatusSetImageCount bool     `json:"status_set_image_count"`
		ImageCount          int      `json:"image_count"`
		GuideText           string   `json:"guide_text"`
		GuideImages         []string `json:"guide_images"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	assetID, err := uuid.Parse(body.AssetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id_asset"})
		return
	}
	subWorkID, err := uuid.Parse(body.SubWorkID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id_sub_work"})
		return
	}


	guideImagesJSON, _ := json.Marshal(body.GuideImages)
	if len(body.GuideImages) == 0 {
		guideImagesJSON = []byte("[]")
	}

	config := &domain.Config{
		ID:                  uuid.New(),
		AssetID:             assetID,
		SubWorkID:           subWorkID,
		StatusSetImageCount: body.StatusSetImageCount,
		ImageCount:          body.ImageCount,
		GuideText:           body.GuideText,
		GuideImages:         datatypes.JSON(guideImagesJSON),
	}
	if err := h.configRepo.Create(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create config"})
		return
	}
	// Return with preloaded data
	result, _ := h.configRepo.FindByID(config.ID)
	c.JSON(http.StatusCreated, result)
}

// PUT /configs/:id
func (h *ConfigHandler) UpdateConfig(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}

	config, err := h.configRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Config not found"})
		return
	}

	var body struct {
		StatusSetImageCount *bool    `json:"status_set_image_count"`
		ImageCount          *int     `json:"image_count"`
		GuideText           *string  `json:"guide_text"`
		GuideImages         []string `json:"guide_images"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.GuideImages != nil {
		b, _ := json.Marshal(body.GuideImages)
		config.GuideImages = datatypes.JSON(b)
	}
	if body.StatusSetImageCount != nil {
		config.StatusSetImageCount = *body.StatusSetImageCount
	}
	if body.ImageCount != nil {
		config.ImageCount = *body.ImageCount
	}
	if body.GuideText != nil {
		config.GuideText = *body.GuideText
	}

	if err := h.configRepo.Update(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update config"})
		return
	}

	result, _ := h.configRepo.FindByID(config.ID)
	c.JSON(http.StatusOK, result)
}

// DELETE /configs/:id
func (h *ConfigHandler) DeleteConfig(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config ID"})
		return
	}
	if err := h.configRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete config"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Config deleted"})
}
