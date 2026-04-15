package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	pgstore "github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// StationHandler now manages Process and ModelProject lookup tables
type StationHandler struct {
	processRepo      *pgstore.ProcessRepository
	modelProjectRepo *pgstore.ModelProjectRepository
}

func NewStationHandler(db *gorm.DB) *StationHandler {
	return &StationHandler{
		processRepo:      pgstore.NewProcessRepository(db),
		modelProjectRepo: pgstore.NewModelProjectRepository(db),
	}
}

// ---- Process ----

func (h *StationHandler) ListProcess(c *gin.Context) {
	items, err := h.processRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch processes"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *StationHandler) CreateProcess(c *gin.Context) {
	var p domain.Process
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.ID = uuid.New()
	if err := h.processRepo.Create(&p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create process"})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *StationHandler) UpdateProcess(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	p, err := h.processRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Process not found"})
		return
	}
	if err := c.ShouldBindJSON(p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.ID = id
	h.processRepo.Update(p)
	c.JSON(http.StatusOK, p)
}

func (h *StationHandler) DeleteProcess(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	h.processRepo.Delete(id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ---- ModelProject ----

func (h *StationHandler) ListModelProjects(c *gin.Context) {
	items, err := h.modelProjectRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch model projects"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *StationHandler) CreateModelProject(c *gin.Context) {
	var m domain.ModelProject
	if err := c.ShouldBindJSON(&m); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m.ID = uuid.New()
	if err := h.modelProjectRepo.Create(&m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create model project"})
		return
	}
	c.JSON(http.StatusCreated, m)
}

func (h *StationHandler) UpdateModelProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	m, err := h.modelProjectRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ModelProject not found"})
		return
	}
	if err := c.ShouldBindJSON(m); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m.ID = id
	h.modelProjectRepo.Update(m)
	c.JSON(http.StatusOK, m)
}

func (h *StationHandler) DeleteModelProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	h.modelProjectRepo.Delete(id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

