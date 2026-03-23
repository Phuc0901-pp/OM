package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type ProjectHandlerV2 struct {
	projectRepo domain.ProjectRepository
	ownerRepo   domain.OwnerRepository
}

func NewProjectHandlerV2(db *gorm.DB, projectRepo domain.ProjectRepository, ownerRepo domain.OwnerRepository) *ProjectHandlerV2 {
	return &ProjectHandlerV2{projectRepo: projectRepo, ownerRepo: ownerRepo}
}

// GET /projects
func (h *ProjectHandlerV2) ListProjects(c *gin.Context) {
	projects, err := h.projectRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}
	c.JSON(http.StatusOK, projects)
}

// GET /projects/:id
func (h *ProjectHandlerV2) GetProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	project, err := h.projectRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	c.JSON(http.StatusOK, project)
}

// POST /projects
func (h *ProjectHandlerV2) CreateProject(c *gin.Context) {
	var project domain.Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	project.ID = uuid.New()
	if err := h.projectRepo.Create(&project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}
	c.JSON(http.StatusCreated, project)
}

// PUT /projects/:id
func (h *ProjectHandlerV2) UpdateProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	project, err := h.projectRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err := c.ShouldBindJSON(project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	project.ID = id
	if err := h.projectRepo.Update(project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}
	c.JSON(http.StatusOK, project)
}

// DELETE /projects/:id
func (h *ProjectHandlerV2) DeleteProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if err := h.projectRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project deleted"})
}

// ---- Project Trash APIs ----

// GET /projects/history
func (h *ProjectHandlerV2) ListDeletedProjects(c *gin.Context) {
	projects, err := h.projectRepo.FindAllDeleted()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch deleted projects"})
		return
	}
	c.JSON(http.StatusOK, projects)
}

// POST /projects/:id/restore
func (h *ProjectHandlerV2) RestoreProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if err := h.projectRepo.Restore(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project restored"})
}

// DELETE /projects/:id/permanent
func (h *ProjectHandlerV2) PermanentDeleteProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if err := h.projectRepo.PermanentDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project permanently deleted"})
}

// POST /projects/bulk-restore
func (h *ProjectHandlerV2) BulkRestoreProjects(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var uuids []uuid.UUID
	for _, s := range body.IDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID: " + s})
			return
		}
		uuids = append(uuids, id)
	}
	if err := h.projectRepo.BulkRestore(uuids); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk restore projects"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Projects restored", "count": len(uuids)})
}

// DELETE /projects/bulk-permanent
func (h *ProjectHandlerV2) BulkPermanentDeleteProjects(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var uuids []uuid.UUID
	for _, s := range body.IDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID: " + s})
			return
		}
		uuids = append(uuids, id)
	}
	if err := h.projectRepo.BulkPermanentDelete(uuids); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk delete projects"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Projects permanently deleted", "count": len(uuids)})
}

// ---- Owner CRUD ----

// GET /owners
func (h *ProjectHandlerV2) ListOwners(c *gin.Context) {
	owners, err := h.ownerRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch owners"})
		return
	}
	c.JSON(http.StatusOK, owners)
}

// POST /owners
func (h *ProjectHandlerV2) CreateOwner(c *gin.Context) {
	var owner domain.Owner
	if err := c.ShouldBindJSON(&owner); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	owner.ID = uuid.New()
	if err := h.ownerRepo.Create(&owner); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create owner"})
		return
	}
	c.JSON(http.StatusCreated, owner)
}

// DELETE /owners/:id
func (h *ProjectHandlerV2) DeleteOwner(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid owner ID"})
		return
	}
	if err := h.ownerRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete owner"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Owner deleted"})
}
