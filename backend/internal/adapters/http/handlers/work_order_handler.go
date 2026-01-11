package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/errors"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain/dtos"
)

type WorkOrderHandler struct {
	service *services.WorkOrderService
}

func NewWorkOrderHandler(service *services.WorkOrderService) *WorkOrderHandler {
	return &WorkOrderHandler{service: service}
}

// CreateWorkOrder handles POST /work-orders
func (h *WorkOrderHandler) CreateWorkOrder(c *gin.Context) {
	var req dtos.CreateWorkOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get UserID from context (Middleware)
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000001") // Mock UUID

	wo, err := h.service.CreateWorkOrder(req, userID) // Fixed: removed pointer
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": wo})
}

// UpdateWorkOrder handles PUT /work-orders/:id
func (h *WorkOrderHandler) UpdateWorkOrder(c *gin.Context) {
	// Not implemented in current service
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

// UpdateStatus handles PATCH /work-orders/:id/status
func (h *WorkOrderHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req dtos.UpdateWorkOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get UserID
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000001") // Mock UUID

	if err := h.service.UpdateStatus(uint(id), req, userID); err != nil { // Fixed: removed pointer
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "status updated successfully"})
}

// ListWorkOrders handles GET /work-orders
func (h *WorkOrderHandler) ListWorkOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	
	opts := dtos.FilterOptions{
		Page:     page,
		Limit:    pageSize,
		Status:   c.Query("status"),
		Priority: c.Query("priority"),
		Search:   c.Query("search"),
	}

	result, err := h.service.ListWorkOrders(opts) // Fixed: use FilterOptions struct
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

// Helper to map domain errors to HTTP status codes
func handleError(c *gin.Context, err error) {
	switch err {
	case errors.ErrNotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.ErrConflict:
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.ErrInvalidState:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.ErrInvalidInput:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.ErrUnauthorized:
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	}
}
