package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
)

// HistoryHandler handles allocation history operations
type HistoryHandler struct {
	ProjectRepo    domain.ProjectRepository
	AllocationRepo domain.AllocationRepository // NEW
}

// NewHistoryHandler creates a new history handler
func NewHistoryHandler(projectRepo domain.ProjectRepository, allocationRepo domain.AllocationRepository) *HistoryHandler {
	return &HistoryHandler{
		ProjectRepo:    projectRepo,
		AllocationRepo: allocationRepo,
	}
}

// GetHistory handles GET /allocations/history
func (h *HistoryHandler) GetHistory(c *gin.Context) {
	assigns, err := h.AllocationRepo.GetDeletedAssigns()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type DeletedAssignDTO struct {
		ID      uuid.UUID `json:"id"`
		Project struct {
			ProjectName string `json:"project_name"`
			Location    string `json:"location"`
		} `json:"project"`
		User           domain.User `json:"user"`
		Classification struct {
			Name string `json:"name"`
		} `json:"classification"`
		DeletedAt time.Time `json:"deleted_at"`
	}

	var result []DeletedAssignDTO

	for _, a := range assigns {
		dto := DeletedAssignDTO{
			ID:        a.ID,
			DeletedAt: a.DeletedAt.Time,
		}

		if a.User != nil {
			dto.User = *a.User
		}

		// Resolve Project Name from Preloaded Data
		pName := "Unknown Project"
		pLoc := "N/A"

		if a.Project != nil {
			pName = a.Project.ProjectName
			pLoc = a.Project.Location
		}

		dto.Project.ProjectName = pName
		dto.Project.Location = pLoc

		if a.Classification != nil {
			dto.Classification.Name = a.Classification.Name
		} else {
			dto.Classification.Name = "Unknown"
		}

		result = append(result, dto)
	}

	c.JSON(http.StatusOK, result)
}

// RestoreAllocation handles POST /allocations/:id/restore
func (h *HistoryHandler) RestoreAllocation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Allocation ID"})
		return
	}

	if err := h.AllocationRepo.RestoreAssign(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Allocation restored successfully"})
}
