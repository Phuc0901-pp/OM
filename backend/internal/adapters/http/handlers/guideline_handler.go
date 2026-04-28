package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
)

type GuideLineHandler struct {
	repo domain.GuideLineRepository
}

func NewGuideLineHandler(repo domain.GuideLineRepository) *GuideLineHandler {
	return &GuideLineHandler{repo: repo}
}

// GET /guidelines/subwork/:id
// Returns the guideline for a sub-work, or empty object if not found
func (h *GuideLineHandler) GetBySubWorkID(c *gin.Context) {
	subWorkID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sub_work ID"})
		return
	}
	g, err := h.repo.FindBySubWorkID(subWorkID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch guideline"})
		return
	}
	if g == nil {
		// Return empty structure so frontend always gets a consistent shape
		c.JSON(http.StatusOK, gin.H{
			"id":           nil,
			"id_sub_work":  subWorkID,
			"guide_text":   "",
			"guide_images": []string{},
			"guide_url":    "",
		})
		return
	}
	c.JSON(http.StatusOK, g)
}

// POST /guidelines/subwork/:id
// Upsert guideline for a sub-work
func (h *GuideLineHandler) Upsert(c *gin.Context) {
	subWorkID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sub_work ID"})
		return
	}

	var body struct {
		GuideText   string   `json:"guide_text"`
		GuideImages []string `json:"guide_images"`
		GuideURL    string   `json:"guide_url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	imagesJSON, _ := json.Marshal(body.GuideImages)
	if len(body.GuideImages) == 0 {
		imagesJSON = []byte("[]")
	}

	g := &domain.GuideLine{
		SubWorkID:   subWorkID,
		GuideText:   body.GuideText,
		GuideImages: datatypes.JSON(imagesJSON),
		GuideURL:    body.GuideURL,
	}

	if err := h.repo.Save(g); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save guideline"})
		return
	}

	result, _ := h.repo.FindBySubWorkID(subWorkID)
	c.JSON(http.StatusOK, result)
}
