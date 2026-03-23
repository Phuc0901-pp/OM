package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
)

type AssetHandler struct {
	assetRepo    domain.AssetRepository
	workRepo     domain.WorkRepository
	subWorkRepo  domain.SubWorkRepository
}

func NewAssetHandler(assetRepo domain.AssetRepository, workRepo domain.WorkRepository, subWorkRepo domain.SubWorkRepository) *AssetHandler {
	return &AssetHandler{assetRepo: assetRepo, workRepo: workRepo, subWorkRepo: subWorkRepo}
}

// ============================================================================
// ---- Asset CRUD ----
// ============================================================================

func (h *AssetHandler) ListAssets(c *gin.Context) {
	projectIDStr := c.Query("project_id")
	if projectIDStr != "" {
		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project_id"})
			return
		}
		assets, err := h.assetRepo.FindByProjectID(projectID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assets"})
			return
		}
		c.JSON(http.StatusOK, assets)
		return
	}
	assets, err := h.assetRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch assets"})
		return
	}
	c.JSON(http.StatusOK, assets)
}

func (h *AssetHandler) GetAsset(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	asset, err := h.assetRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}
	c.JSON(http.StatusOK, asset)
}

func (h *AssetHandler) CreateAsset(c *gin.Context) {
	var asset domain.Asset
	if err := c.ShouldBindJSON(&asset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	asset.ID = uuid.New()
	if err := h.assetRepo.Create(&asset); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create asset"})
		return
	}
	c.JSON(http.StatusCreated, asset)
}

func (h *AssetHandler) UpdateAsset(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	asset, err := h.assetRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}
	if err := c.ShouldBindJSON(asset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	asset.ID = id
	if err := h.assetRepo.Update(asset); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update asset"})
		return
	}
	c.JSON(http.StatusOK, asset)
}

func (h *AssetHandler) DeleteAsset(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	if err := h.assetRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete asset"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Asset deleted"})
}

// ---- Asset Trash Routes ----

func (h *AssetHandler) ListDeletedAssets(c *gin.Context) {
	items, err := h.assetRepo.FindDeleted()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch deleted assets"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *AssetHandler) RestoreAsset(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	if err := h.assetRepo.Restore(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore asset"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Asset restored"})
}

func (h *AssetHandler) PermanentDeleteAsset(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	if err := h.assetRepo.HardDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete asset"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Asset permanently deleted"})
}

func (h *AssetHandler) BulkRestoreAssets(c *gin.Context) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	for _, idStr := range req.IDs {
		if id, err := uuid.Parse(idStr); err == nil {
			h.assetRepo.Restore(id)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bulk restore completed"})
}

func (h *AssetHandler) BulkPermanentDeleteAssets(c *gin.Context) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	for _, idStr := range req.IDs {
		if id, err := uuid.Parse(idStr); err == nil {
			h.assetRepo.HardDelete(id)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bulk permanent delete completed"})
}

// ============================================================================
// ---- Work CRUD ----
// ============================================================================

func (h *AssetHandler) ListWorks(c *gin.Context) {
	works, err := h.workRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch works"})
		return
	}
	c.JSON(http.StatusOK, works)
}

func (h *AssetHandler) GetWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work ID"})
		return
	}
	work, err := h.workRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Work not found"})
		return
	}
	c.JSON(http.StatusOK, work)
}

func (h *AssetHandler) CreateWork(c *gin.Context) {
	var work domain.Work
	if err := c.ShouldBindJSON(&work); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	work.ID = uuid.New()
	if err := h.workRepo.Create(&work); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create work"})
		return
	}
	c.JSON(http.StatusCreated, work)
}

func (h *AssetHandler) UpdateWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work ID"})
		return
	}
	work, err := h.workRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Work not found"})
		return
	}
	if err := c.ShouldBindJSON(work); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	work.ID = id
	if err := h.workRepo.Update(work); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update work"})
		return
	}
	c.JSON(http.StatusOK, work)
}

func (h *AssetHandler) DeleteWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work ID"})
		return
	}
	if err := h.workRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete work"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Work deleted"})
}

// ---- Work Trash Routes ----

func (h *AssetHandler) ListDeletedWorks(c *gin.Context) {
	items, err := h.workRepo.FindDeleted()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch deleted works"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *AssetHandler) RestoreWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}
	if err := h.workRepo.Restore(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Restored"})
}

func (h *AssetHandler) PermanentDeleteWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}
	if err := h.workRepo.HardDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanent delete"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Permanently deleted"})
}

func (h *AssetHandler) BulkRestoreWorks(c *gin.Context) {
	var req struct{ IDs []string `json:"ids"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	for _, idStr := range req.IDs {
		if id, err := uuid.Parse(idStr); err == nil {
			h.workRepo.Restore(id)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bulk restore ok"})
}

func (h *AssetHandler) BulkPermanentDeleteWorks(c *gin.Context) {
	var req struct{ IDs []string `json:"ids"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	for _, idStr := range req.IDs {
		if id, err := uuid.Parse(idStr); err == nil {
			h.workRepo.HardDelete(id)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bulk delete ok"})
}

// ============================================================================
// ---- SubWork CRUD ----
// ============================================================================

func (h *AssetHandler) ListSubWorks(c *gin.Context) {
	workIDStr := c.Query("work_id")
	if workIDStr != "" {
		workID, err := uuid.Parse(workIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work_id"})
			return
		}
		subWorks, err := h.subWorkRepo.FindByWorkID(workID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sub-works"})
			return
		}
		c.JSON(http.StatusOK, subWorks)
		return
	}
	subWorks, err := h.subWorkRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sub-works"})
		return
	}
	c.JSON(http.StatusOK, subWorks)
}

func (h *AssetHandler) GetSubWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sub-work ID"})
		return
	}
	subWork, err := h.subWorkRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sub-work not found"})
		return
	}
	c.JSON(http.StatusOK, subWork)
}

func (h *AssetHandler) CreateSubWork(c *gin.Context) {
	var req struct {
		Name      string    `json:"name"`
		IDWork    uuid.UUID `json:"id_work"`
		IDProcess []string  `json:"id_process"` // expecting string UUIDs
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	idProcessBytes, err := json.Marshal(req.IDProcess)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse id_process"})
		return
	}
	subWork := domain.SubWork{
		ID:         uuid.New(),
		Name:       req.Name,
		WorkID:     req.IDWork,
		ProcessIDs: datatypes.JSON(idProcessBytes),
	}
	if err := h.subWorkRepo.Create(&subWork); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sub-work"})
		return
	}
	c.JSON(http.StatusCreated, subWork)
}

func (h *AssetHandler) UpdateSubWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	subWork, err := h.subWorkRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sub-work not found"})
		return
	}
	var req struct {
		Name      string    `json:"name"`
		IDWork    uuid.UUID `json:"id_work"`
		IDProcess []string  `json:"id_process"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	idProcessBytes, _ := json.Marshal(req.IDProcess)
	subWork.Name = req.Name
	subWork.WorkID = req.IDWork
	subWork.ProcessIDs = datatypes.JSON(idProcessBytes)

	if err := h.subWorkRepo.Update(subWork); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update sub-work"})
		return
	}
	c.JSON(http.StatusOK, subWork)
}

func (h *AssetHandler) DeleteSubWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	if err := h.subWorkRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete sub-work"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Sub-work deleted"})
}

// ---- SubWork Trash Routes ----

func (h *AssetHandler) ListDeletedSubWorks(c *gin.Context) {
	items, err := h.subWorkRepo.FindDeleted()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch deleted"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *AssetHandler) RestoreSubWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}
	if err := h.subWorkRepo.Restore(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Restored"})
}

func (h *AssetHandler) PermanentDeleteSubWork(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return
	}
	if err := h.subWorkRepo.HardDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanent delete"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Permanently deleted"})
}

func (h *AssetHandler) BulkRestoreSubWorks(c *gin.Context) {
	var req struct{ IDs []string `json:"ids"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	for _, idStr := range req.IDs {
		if id, err := uuid.Parse(idStr); err == nil {
			h.subWorkRepo.Restore(id)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bulk restore ok"})
}

func (h *AssetHandler) BulkPermanentDeleteSubWorks(c *gin.Context) {
	var req struct{ IDs []string `json:"ids"` }
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	for _, idStr := range req.IDs {
		if id, err := uuid.Parse(idStr); err == nil {
			h.subWorkRepo.HardDelete(id)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bulk delete ok"})
}
