package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
)

type ChecklistHandler struct {
	service *services.ChecklistService
}

func NewChecklistHandler(service *services.ChecklistService) *ChecklistHandler {
	return &ChecklistHandler{service: service}
}

// New request structure matching the updated schema
type SaveChecklistRequest struct {
	AssignID                string                 `json:"assign_id" binding:"required"`
	StructureSiteOfInverter map[string]interface{} `json:"structure_site_of_inverter"` // e.g., {"Building 1": 3, "Building 2": 5}
}

func (h *ChecklistHandler) SaveConfig(c *gin.Context) {
	var req SaveChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assignUUID, err := uuid.Parse(req.AssignID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Assign ID"})
		return
	}

	// Convert map to JSON
	jsonStructure := datatypes.JSON(services.MapToJSON(req.StructureSiteOfInverter))

	config := &domain.ChecklistTemplate{
		AssignID:                assignUUID,
		StructureSiteOfInverter: jsonStructure,
	}

	if err := h.service.SaveConfig(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save checklist config: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Configuration saved successfully", "data": config})
}

func (h *ChecklistHandler) GetConfig(c *gin.Context) {
	assignID := c.Param("assign_id")

	config, err := h.service.GetConfigByAssign(assignID)
	if err != nil {
		// Return empty object if not found, to simplify frontend logic
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": config})
}

func (h *ChecklistHandler) GetProjectChecklists(c *gin.Context) {
	projectID := c.Param("id")

	configs, err := h.service.GetProjectChecklists(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, configs)
}

func (h *ChecklistHandler) DeleteConfig(c *gin.Context) {
	assignID := c.Param("assign_id")

	if err := h.service.DeleteConfigByAssign(assignID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete checklist: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Checklist deleted successfully"})
}

// DeleteByProjectAndChild deletes a checklist by project ID and child category ID
func (h *ChecklistHandler) DeleteByProjectAndChild(c *gin.Context) {
	projectID := c.Param("id")
	childID := c.Param("childId")

	projectUUID, err := uuid.Parse(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Project ID"})
		return
	}

	childUUID, err := uuid.Parse(childID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Child Category ID"})
		return
	}

	if err := h.service.DeleteByProjectAndChild(projectUUID, childUUID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete checklist: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Checklist deleted successfully"})
}
