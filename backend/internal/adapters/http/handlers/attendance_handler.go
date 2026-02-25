package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
)

type AttendanceHandler struct {
	service *services.AttendanceService
}

func NewAttendanceHandler(service *services.AttendanceService) *AttendanceHandler {
	return &AttendanceHandler{service: service}
}

// CheckInWithPhotos handles POST /api/attendance/checkin-with-photos
func (h *AttendanceHandler) CheckInWithPhotos(c *gin.Context) {
	var req struct {
		UserID           string      `json:"user_id" binding:"required"`
		ProjectID        *string     `json:"project_id"` // Optional
		PersonnelPhoto   interface{} `json:"personnel_photo"` // Can be string or []string
		IDCardFront      string   `json:"id_card_front"`
		IDCardBack       string   `json:"id_card_back"`
		SafetyCardFront  string   `json:"safety_card_front"`
		SafetyCardBack   string   `json:"safety_card_back"`
		ToolsPhotos      []string `json:"tools_photos"`
		DocumentsPhotos  []string `json:"documents_photos"`
		Address          string   `json:"address"` // Check-in address
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Prepare photos map
	photos := map[string]interface{}{
		"personnel_photo":   req.PersonnelPhoto,
		"id_card_front":     req.IDCardFront,
		"id_card_back":      req.IDCardBack,
		"safety_card_front": req.SafetyCardFront,
		"safety_card_back":  req.SafetyCardBack,
	}

	// Convert []string to []interface{} for array fields
	if len(req.ToolsPhotos) > 0 {
		toolsPhotos := make([]interface{}, len(req.ToolsPhotos))
		for i, p := range req.ToolsPhotos {
			toolsPhotos[i] = p
		}
		photos["tools_photos"] = toolsPhotos
	}

	if len(req.DocumentsPhotos) > 0 {
		documentsPhotos := make([]interface{}, len(req.DocumentsPhotos))
		for i, p := range req.DocumentsPhotos {
			documentsPhotos[i] = p
		}
		photos["documents_photos"] = documentsPhotos
	}

	var projectID *uuid.UUID
	if req.ProjectID != nil && *req.ProjectID != "" {
		id, err := uuid.Parse(*req.ProjectID)
		if err == nil {
			projectID = &id
		}
	}

	attendance, err := h.service.CheckInWithPhotos(userID, projectID, photos, req.Address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// CheckIn handles POST /api/attendance/checkin (simple check-in without photos)
func (h *AttendanceHandler) CheckIn(c *gin.Context) {
	var req struct {
		UserID    string  `json:"user_id" binding:"required"`
		ProjectID *string `json:"project_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var projectID *uuid.UUID
	if req.ProjectID != nil && *req.ProjectID != "" {
		id, err := uuid.Parse(*req.ProjectID)
		if err == nil {
			projectID = &id
		}
	}

	attendance, err := h.service.CheckIn(userID, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// CheckOut handles POST /api/attendance/checkout
func (h *AttendanceHandler) CheckOut(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	attendance, err := h.service.CheckOut(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// GetTodayAttendance handles GET /api/attendance/today/:user_id
func (h *AttendanceHandler) GetTodayAttendance(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	attendance, err := h.service.GetTodayAttendance(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No attendance record found for today"})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// GetUserHistory handles GET /api/attendance/history/:user_id
func (h *AttendanceHandler) GetUserHistory(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	limitStr := c.DefaultQuery("limit", "30")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 30
	}

	attendances, err := h.service.GetUserHistory(userID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendances)
}

// GetAllTodayAttendances handles GET /api/attendance/today/all
func (h *AttendanceHandler) GetAllTodayAttendances(c *gin.Context) {
	attendances, err := h.service.GetAllTodayAttendances()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendances)
}

// GetUsersOnSite handles GET /api/attendance/onsite
func (h *AttendanceHandler) GetUsersOnSite(c *gin.Context) {
	attendances, err := h.service.GetUsersOnSite()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendances)
}

// RequestCheckout handles POST /api/attendance/request-checkout
func (h *AttendanceHandler) RequestCheckout(c *gin.Context) {
	var req struct {
		UserID           string      `json:"user_id" binding:"required"`
		PersonnelPhoto   interface{} `json:"personnel_photo"` // Can be string or []string
		IDCardFront      string   `json:"id_card_front"`
		IDCardBack       string   `json:"id_card_back"`
		SafetyCardFront  string   `json:"safety_card_front"`
		SafetyCardBack   string   `json:"safety_card_back"`
		ToolsPhotos      []string `json:"tools_photos"`
		DocumentsPhotos  []string `json:"documents_photos"`
		Address          string   `json:"address"` // Check-out address
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Prepare photos map
	photos := map[string]interface{}{
		"personnel_photo":   req.PersonnelPhoto,
		"id_card_front":     req.IDCardFront,
		"id_card_back":      req.IDCardBack,
		"safety_card_front": req.SafetyCardFront,
		"safety_card_back":  req.SafetyCardBack,
	}

	// Convert []string to []interface{} for array fields
	if len(req.ToolsPhotos) > 0 {
		toolsPhotos := make([]interface{}, len(req.ToolsPhotos))
		for i, p := range req.ToolsPhotos {
			toolsPhotos[i] = p
		}
		photos["tools_photos"] = toolsPhotos
	}

	if len(req.DocumentsPhotos) > 0 {
		documentsPhotos := make([]interface{}, len(req.DocumentsPhotos))
		for i, p := range req.DocumentsPhotos {
			documentsPhotos[i] = p
		}
		photos["documents_photos"] = documentsPhotos
	}

	attendance, err := h.service.RequestCheckout(userID, photos, req.Address)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// ApproveCheckout handles POST /api/attendance/approve-checkout/:id
func (h *AttendanceHandler) ApproveCheckout(c *gin.Context) {
	attendanceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attendance ID"})
		return
	}

	var req struct {
		ManagerID string `json:"manager_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	managerID, err := uuid.Parse(req.ManagerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid manager ID"})
		return
	}

	attendance, err := h.service.ApproveCheckout(attendanceID, managerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// RejectCheckout handles POST /api/attendance/reject-checkout/:id
func (h *AttendanceHandler) RejectCheckout(c *gin.Context) {
	attendanceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attendance ID"})
		return
	}

	var req struct {
		ManagerID string `json:"manager_id" binding:"required"`
		Reason    string `json:"reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	managerID, err := uuid.Parse(req.ManagerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid manager ID"})
		return
	}

	attendance, err := h.service.RejectCheckout(attendanceID, managerID, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// GetPendingCheckouts handles GET /api/attendance/pending-checkouts
func (h *AttendanceHandler) GetPendingCheckouts(c *gin.Context) {
	attendances, err := h.service.GetPendingCheckoutRequests()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendances)
}

// GetAllHistory handles GET /api/attendance/history/all
func (h *AttendanceHandler) GetAllHistory(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 100
	}

	attendances, err := h.service.GetAllAttendanceHistory(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attendances)
}

// GetDetail handles GET /api/attendance/detail/:id
func (h *AttendanceHandler) GetDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attendance ID"})
		return
	}

	attendance, err := h.service.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attendance record not found"})
		return
	}

	c.JSON(http.StatusOK, attendance)
}

// Lookup handles GET /api/attendance/lookup?user_id=...&date=...
func (h *AttendanceHandler) Lookup(c *gin.Context) {
	userIDStr := c.Query("user_id")
	dateStr := c.Query("date")

	if userIDStr == "" || dateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing user_id or date"})
		return
	}

	// Fix: Handle cases where '+' in timezone offset is decoded as a space ' '
	if strings.Contains(dateStr, " ") && !strings.Contains(dateStr, "T") {
		// This might be a date with space between date and time (SQL format)
	} else if strings.Contains(dateStr, " ") {
		// Likely "2024-01-01T12:00:00 07:00" -> replace space with +
		dateStr = strings.Replace(dateStr, " ", "+", 1)
	}

	logger.Info("Attendance Lookup request", zap.String("user_id", userIDStr), zap.String("date", dateStr))

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
		return
	}

	date, err := time.Parse(time.RFC3339, dateStr)
	if err != nil {
		// Try parsing just date YYYY-MM-DD
		d, err2 := time.Parse("2006-01-02", dateStr)
		if err2 != nil {
			logger.Error("Date parsing error", zap.String("date", dateStr), zap.Error(err))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format", "details": err.Error()})
			return
		}
		date = d
	}

	attendance, err := h.service.GetByDate(userID, date)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attendance record not found"})
		return
	}

	c.JSON(http.StatusOK, attendance)
}
