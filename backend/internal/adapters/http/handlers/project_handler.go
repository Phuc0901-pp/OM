package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
)

type ProjectHandler struct {
	Service *services.ProjectService
}

func NewProjectHandler(service *services.ProjectService) *ProjectHandler {
	return &ProjectHandler{Service: service}
}

func (h *ProjectHandler) GetAllProjects(c *gin.Context) {
	data, err := h.Service.GetAllProjects()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) GetUserProjects(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}
	
	projects, err := h.Service.GetProjectsByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, projects)
}

func (h *ProjectHandler) GetProjectClassifications(c *gin.Context) {
	data, err := h.Service.GetProjectClassifications()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) GetAllMainCategories(c *gin.Context) {
	data, err := h.Service.GetAllMainCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) GetChildCategories(c *gin.Context) {
	paramID := c.Param("id")
	data, err := h.Service.GetChildCategoriesByMainID(paramID)
	if err != nil {
		// Distinguish errors? For now generic 500 or 400 based on error string
		if err.Error() == "invalid ID" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) GetProjectByID(c *gin.Context) {
	idStr := c.Param("id")
	data, err := h.Service.GetProjectByID(idStr)
	if err != nil {
		if err.Error() == "project not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) CreateProject(c *gin.Context) {
	var req domain.Project
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Service.CreateProject(&req); err != nil {
		if err.Error() == "project Name is required" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusCreated, req)
}

func (h *ProjectHandler) UpdateProject(c *gin.Context) {
	idStr := c.Param("id")
	var req domain.Project
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Service.UpdateProject(idStr, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, req)
}

func (h *ProjectHandler) CreateMainCategory(c *gin.Context) {
	var req domain.MainCategory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Service.CreateMainCategory(&req); err != nil {
		if err.Error() == "name is required" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusCreated, req)
}

func (h *ProjectHandler) CreateChildCategory(c *gin.Context) {
	var req domain.ChildCategory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.Service.CreateChildCategory(&req); err != nil {
		if err.Error() == "name is required" || err.Error() == "either MainCategoryID or StationID is required" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	
	c.JSON(http.StatusCreated, req)
}

// UpdateChildCategory handles PUT /child-categories/:id
func (h *ProjectHandler) UpdateChildCategory(c *gin.Context) {
	idStr := c.Param("id")
	
	var req struct {
		Name             string  `json:"name"`
		RequiresInverter *bool   `json:"requires_inverter"`
		StationID        *string `json:"station_id"` // Can be null to unlink
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if err := h.Service.UpdateChildCategory(idStr, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Child category updated successfully", "id": idStr})
}

func (h *ProjectHandler) GetChildCategoriesByStationID(c *gin.Context) {
	paramID := c.Param("id")
	data, err := h.Service.GetChildCategoriesByStationID(paramID)
	if err != nil {
		if err.Error() == "invalid Station ID" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) GetProjectCharacteristics(c *gin.Context) {
	idStr := c.Param("id")
	data, err := h.Service.GetProjectCharacteristics(idStr)
	if err != nil {
		if err.Error() == "project not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Characteristics not found", "details": err.Error()})
		} else {
			// Could be generic error from Repo (RecordNotFound -> nil, error)
			// Our service assumes repo returns error if something breaks, or nil if not found.
			// Ideally service should handle "Not Found" error wrapping.
			// For now, if data is nil and no error, handle that in service?
			// Repo returns nil, error if issue. If not found, repo might return nil, nil or error.
			// Assuming Service returns error if repo errors.
			c.JSON(http.StatusNotFound, gin.H{"error": "Characteristics not found", "details": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) UpdateProjectCharacteristics(c *gin.Context) {
	idStr := c.Param("id")

	// Accept flexible map from frontend
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := h.Service.UpdateProjectCharacteristics(idStr, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *ProjectHandler) DeleteProject(c *gin.Context) {
	idStr := c.Param("id")
	if err := h.Service.DeleteProject(idStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

func (h *ProjectHandler) DeleteMainCategory(c *gin.Context) {
	idStr := c.Param("id")
	if err := h.Service.DeleteMainCategory(idStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Main category deleted successfully"})
}

func (h *ProjectHandler) DeleteChildCategory(c *gin.Context) {
	idStr := c.Param("id")
	if err := h.Service.DeleteChildCategory(idStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Child category deleted successfully"})
}

// CloneProject handles POST /projects/:id/clone
// Creates a deep copy of a project including its Characteristic, Stations, and StationChildConfigs.
func (h *ProjectHandler) CloneProject(c *gin.Context) {
	idStr := c.Param("id")
	cloned, err := h.Service.CloneProject(idStr)
	if err != nil {
		if err.Error() == "invalid Project ID" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusCreated, cloned)
}

