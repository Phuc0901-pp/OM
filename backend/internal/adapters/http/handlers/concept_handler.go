package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain/models"
)

type ConceptHandler struct {
	DB            *gorm.DB
	SchemaService *services.SchemaService
}

func NewConceptHandler(db *gorm.DB) *ConceptHandler {
	return &ConceptHandler{
		DB:            db,
		SchemaService: services.NewSchemaService(db),
	}
}

// GetAllConcepts returns all concepts
func (h *ConceptHandler) GetAllConcepts(c *gin.Context) {
	var concepts []models.Concept
	if err := h.DB.Order("created_at DESC").Find(&concepts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch concepts"})
		return
	}
	c.JSON(http.StatusOK, concepts)
}

// GetConcept returns a single concept by ID
func (h *ConceptHandler) GetConcept(c *gin.Context) {
	id := c.Param("id")
	conceptID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid concept ID"})
		return
	}

	var concept models.Concept
	if err := h.DB.First(&concept, conceptID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Concept not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch concept"})
		return
	}
	c.JSON(http.StatusOK, concept)
}

// CreateConcept creates a new concept and corresponding database table
func (h *ConceptHandler) CreateConcept(c *gin.Context) {
	var concept models.Concept
	if err := c.ShouldBindJSON(&concept); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate table name
	if err := h.SchemaService.ValidateTableName(concept.Name); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid table name: %v", err)})
		return
	}

	// Parse columns from JSONB
	var columns []services.Column
	if err := json.Unmarshal(concept.Columns, &columns); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid columns format"})
		return
	}

	// Create the actual PostgreSQL table
	if err := h.SchemaService.CreateDynamicTable(concept.Name, columns); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create table: %v", err)})
		return
	}

	// Save concept metadata
	if err := h.DB.Create(&concept).Error; err != nil {
		// Rollback: drop the table if metadata save fails
		h.SchemaService.DropDynamicTable(concept.Name)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save concept metadata"})
		return
	}

	c.JSON(http.StatusCreated, concept)
}

// UpdateConcept updates an existing concept
func (h *ConceptHandler) UpdateConcept(c *gin.Context) {
	id := c.Param("id")
	conceptID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid concept ID"})
		return
	}

	var concept models.Concept
	if err := h.DB.First(&concept, conceptID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Concept not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch concept"})
		return
	}

	var updateData models.Concept
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	concept.Name = updateData.Name
	concept.Description = updateData.Description
	concept.Columns = updateData.Columns

	if err := h.DB.Save(&concept).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update concept"})
		return
	}

	c.JSON(http.StatusOK, concept)
}

// DeleteConcept deletes a concept and drops the corresponding database table
func (h *ConceptHandler) DeleteConcept(c *gin.Context) {
	id := c.Param("id")
	conceptID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid concept ID"})
		return
	}

	// Fetch concept to get table name
	var concept models.Concept
	if err := h.DB.First(&concept, conceptID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Concept not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch concept"})
		return
	}

	// Drop the actual PostgreSQL table
	if err := h.SchemaService.DropDynamicTable(concept.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to drop table: %v", err)})
		return
	}

	// Delete concept metadata
	if err := h.DB.Delete(&concept).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete concept metadata"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Concept and table deleted successfully"})
}
