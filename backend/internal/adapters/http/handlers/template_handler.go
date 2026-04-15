package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
)

type TemplateHandler struct {
	Repo domain.TemplateRepository
}

func NewTemplateHandler(repo domain.TemplateRepository) *TemplateHandler {
	return &TemplateHandler{Repo: repo}
}

func (h *TemplateHandler) CreateTemplate(c *gin.Context) {
	var req struct {
		Name      string    `json:"name"`
		ProjectID uuid.UUID `json:"id_project"`
		// id_config is an array of config UUIDs, stored as JSONB
		ConfigIDs []string `json:"id_config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// Encode config_ids as JSONB array
	configBytes, err := json.Marshal(req.ConfigIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config_ids"})
		return
	}

	template := domain.Template{
		Name:      req.Name,
		ProjectID: req.ProjectID,
		ConfigIDs: configBytes,
	}

	// Track who created this template
	if userIDStr, ok := c.Get("user_id"); ok {
		if uid, err := uuid.Parse(userIDStr.(string)); err == nil {
			template.PersonCreatedID = &uid
		}
	}

	if err := h.Repo.Create(&template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, template)
}

func (h *TemplateHandler) GetAllTemplates(c *gin.Context) {
	templates, err := h.Repo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get templates: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, templates)
}

func (h *TemplateHandler) GetTemplateByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}
	template, err := h.Repo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}
	c.JSON(http.StatusOK, template)
}

func (h *TemplateHandler) UpdateTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}

	template, err := h.Repo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	var updateData struct {
		Name      *string      `json:"name"`
		ProjectID *uuid.UUID   `json:"id_project"`
		ConfigIDs *interface{} `json:"id_config"`
	}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if updateData.Name != nil {
		template.Name = *updateData.Name
	}

	if updateData.ProjectID != nil {
		template.ProjectID = *updateData.ProjectID
	}

	if updateData.ConfigIDs != nil {
		configBytes, err := json.Marshal(*updateData.ConfigIDs)
		if err == nil {
			template.ConfigIDs = configBytes
		}
	}

	if err := h.Repo.Update(template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update template"})
		return
	}
	c.JSON(http.StatusOK, template)
}

func (h *TemplateHandler) DeleteTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid template ID"})
		return
	}
	if err := h.Repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete template"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Template deleted gracefully"})
}
