package handlers

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/response"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
)

type ReportHandler struct {
	ReportService *services.ReportService
}

func NewReportHandler(reportService *services.ReportService) *ReportHandler {
	return &ReportHandler{ReportService: reportService}
}

// POST /api/reports
func (h *ReportHandler) CreateReport(c *gin.Context) {
	var req struct {
		AssignID   string   `json:"assign_id" binding:"required"`
		Title      string   `json:"title" binding:"required"`
		Type       string   `json:"type"` // 'approve' or 'reject'
		ItemKeys   []string `json:"item_keys"`
		Conclusion string   `json:"conclusion"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body")
		return
	}

	assignUUID, err := uuid.Parse(req.AssignID)
	if err != nil {
		response.BadRequest(c, "Invalid Assign ID mapping")
		return
	}

	// Default to approve
	if req.Type == "" {
		req.Type = "approve"
	}

	// Encode item_keys into JSON. If empty or missing, might mean "all" or just empty.
	var keysData datatypes.JSON
	if req.ItemKeys == nil {
		req.ItemKeys = []string{}
	}
	encoded, _ := json.Marshal(req.ItemKeys)
	keysData = datatypes.JSON(encoded)

	report := &domain.Report{
		AssignID:    assignUUID,
		Title:       req.Title,
		Type:        req.Type,
		ItemKeys:    keysData,
		Conclusion:  req.Conclusion,
	}

	if err := h.ReportService.CreateReport(report); err != nil {
		response.InternalError(c, err, "Lỗi tạo Báo cáo")
		return
	}

	response.Created(c, report)
}

// GET /api/public/generic-report/:id
func (h *ReportHandler) GetGenericReport(c *gin.Context) {
	idStr := c.Param("id")
	uid, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(c, "Invalid Report ID")
		return
	}

	report, err := h.ReportService.GetReport(uid)
	if err != nil {
		response.NotFound(c, "Report not found")
		return
	}

	response.Success(c, report)
}
