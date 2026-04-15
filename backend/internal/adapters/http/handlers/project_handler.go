package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ProjectHandlerV2 struct {
	db          *gorm.DB
	projectRepo domain.ProjectRepository
	ownerRepo   domain.OwnerRepository
}

func NewProjectHandlerV2(db *gorm.DB, projectRepo domain.ProjectRepository, ownerRepo domain.OwnerRepository) *ProjectHandlerV2 {
	return &ProjectHandlerV2{db: db, projectRepo: projectRepo, ownerRepo: ownerRepo}
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

// POST /projects/:id/clone
// Deep-copies a project including all Assets (recursive tree), Configs, and Templates
// inside a single database transaction.
func (h *ProjectHandlerV2) CloneProject(c *gin.Context) {
	oldID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// --- Load original project ---
	var original domain.Project
	if err := h.db.First(&original, "id = ?", oldID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// --- Begin transaction ---
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 1. Clone Project row
	newProject := domain.Project{
		ID:       uuid.New(),
		Name:     original.Name + " - Copy",
		Location: original.Location,
		OwnerID:  original.OwnerID,
	}
	if err := tx.Create(&newProject).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone project: " + err.Error()})
		return
	}

	// 2. Load all Assets of the original project
	var allOldAssets []domain.Asset
	if err := tx.Where("id_project = ? AND deleted_at IS NULL", oldID).Find(&allOldAssets).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load assets: " + err.Error()})
		return
	}

	// Map OldAssetID -> NewAssetID (populated during recursive clone)
	assetIDMap := make(map[uuid.UUID]uuid.UUID)
	// Map OldConfigID -> NewConfigID (populated during config copy)
	configIDMap := make(map[uuid.UUID]uuid.UUID)

	// Recursive function to clone an asset and its children
	var cloneAsset func(oldAsset domain.Asset, newParentID *uuid.UUID) error
	cloneAsset = func(oldAsset domain.Asset, newParentID *uuid.UUID) error {
		newAsset := domain.Asset{
			ID:        uuid.New(),
			Name:      oldAsset.Name,
			ProjectID: newProject.ID,
			ParentID:  newParentID,
		}
		if err := tx.Create(&newAsset).Error; err != nil {
			return err
		}
		assetIDMap[oldAsset.ID] = newAsset.ID

		// Clone Configs belonging to this asset
		var oldConfigs []domain.Config
		if err := tx.Where("id_asset = ? AND deleted_at IS NULL", oldAsset.ID).Find(&oldConfigs).Error; err != nil {
			return err
		}
		for _, oldCfg := range oldConfigs {
			newCfg := domain.Config{
				ID:                  uuid.New(),
				AssetID:             newAsset.ID,
				SubWorkID:           oldCfg.SubWorkID,
				StatusSetImageCount: oldCfg.StatusSetImageCount,
				ImageCount:          oldCfg.ImageCount,
				GuideText:           oldCfg.GuideText,
				GuideImages:         oldCfg.GuideImages,
			}
			if err := tx.Create(&newCfg).Error; err != nil {
				return err
			}
			configIDMap[oldCfg.ID] = newCfg.ID
		}

		// Recurse: find children of oldAsset
		for _, child := range allOldAssets {
			if child.ParentID != nil && *child.ParentID == oldAsset.ID {
				if err := cloneAsset(child, &newAsset.ID); err != nil {
					return err
				}
			}
		}
		return nil
	}

	// Start with root assets (no parent)
	for _, a := range allOldAssets {
		if a.ParentID == nil {
			if err := cloneAsset(a, nil); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone assets: " + err.Error()})
				return
			}
		}
	}

	// 3. Clone Templates with remapped ConfigID arrays
	var oldTemplates []domain.Template
	if err := tx.Where("id_project = ? AND deleted_at IS NULL", oldID).Find(&oldTemplates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load templates: " + err.Error()})
		return
	}

	for _, oldTpl := range oldTemplates {
		// Parse the old config ID array
		var oldConfigIDs []string
		if err := json.Unmarshal([]byte(oldTpl.ConfigIDs), &oldConfigIDs); err != nil {
			oldConfigIDs = []string{}
		}

		// Remap each old config ID to the new one
		newConfigIDs := make([]string, 0, len(oldConfigIDs))
		for _, cidStr := range oldConfigIDs {
			oldCID, parseErr := uuid.Parse(cidStr)
			if parseErr != nil {
				continue
			}
			if newCID, ok := configIDMap[oldCID]; ok {
				newConfigIDs = append(newConfigIDs, newCID.String())
			}
		}

		remappedJSON, _ := json.Marshal(newConfigIDs)

		newTpl := domain.Template{
			ID:             uuid.New(),
			Name:           oldTpl.Name,
			ProjectID:      newProject.ID,
			ModelProjectID: oldTpl.ModelProjectID,
			ConfigIDs:      datatypes.JSON(remappedJSON),
			// PersonCreatedID intentionally left blank for the cloned template
		}
		if err := tx.Create(&newTpl).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone templates: " + err.Error()})
			return
		}
	}

	// --- Commit ---
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction commit failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"project_id":   newProject.ID,
		"project_name": newProject.Name,
		"message":      "Nhân bản dự án thành công",
	})
}
