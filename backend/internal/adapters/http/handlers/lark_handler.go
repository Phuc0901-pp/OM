package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
)

type LarkHandler struct {
	larkService   *services.LarkService
	reportPDFSvc  *services.ReportPDFService
}

func NewLarkHandler(service *services.LarkService, reportPDFSvc *services.ReportPDFService) *LarkHandler {
	return &LarkHandler{
		larkService:  service,
		reportPDFSvc: reportPDFSvc,
	}
}

// PushReportLink handles POST /api/lark/push-report
func (h *LarkHandler) PushReportLink(c *gin.Context) {
	var req struct {
		AppToken   string `json:"app_token" binding:"required"`
		TableID    string `json:"table_id" binding:"required"`
		Project    string `json:"project" binding:"required"`
		Template   string `json:"template"`
		ReportLink string `json:"report_link" binding:"required"`
		Submitter  string `json:"submitter"`
		ReportID   string `json:"report_id"` // Optional: triggers auto PDF generation
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Prepare fields according to whatever schema the Lark Base has.
	// You can customize these field keys based on your actual Lark Base columns.
	fields := map[string]interface{}{
		"Tên Dự Án":    req.Project,
		"Tên Template": req.Template,
		"Link Báo Cáo": map[string]string{
			"link": req.ReportLink,
			"text": "Xem Báo Cáo",
		},
		"Người Xuất":   req.Submitter,
		"Ngày Tạo":     time.Now().Format("02/01/2006 15:04:05"),
	}

	err := h.larkService.PushReportToBitable(req.AppToken, req.TableID, fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ── Pipeline thứ 2: Tự động tạo PDF và lưu vào MinIO ──────────────────
	// Chạy ngầm (non-blocking). Người dùng nhận phản hồi "thành công" ngay lập tức.
	if req.ReportID != "" && h.reportPDFSvc != nil {
		reportUID, parseErr := uuid.Parse(req.ReportID)
		if parseErr == nil {
			h.reportPDFSvc.GenerateAndUploadAsync(reportUID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully pushed to Lark Base"})
}

// PushAllocation handles POST /api/lark/push-allocation
func (h *LarkHandler) PushAllocation(c *gin.Context) {
	var req struct {
		AppToken   string `json:"app_token" binding:"required"`
		TableID    string `json:"table_id" binding:"required"`
		Project    string `json:"project" binding:"required"`
		Investor   string `json:"investor"`
		Manager    string `json:"manager"`
		Model      string `json:"model"`
		Template   string `json:"template"`
		StartDate  string `json:"start_date"`
		EndDate    string `json:"end_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fields := map[string]interface{}{
		"Họ và tên":        req.Manager,
		"Mẫu Template":     req.Template,
		"Dự án":            req.Project,
		"Chủ đầu tư":       req.Investor,
		"Loại hình dự án":  req.Model,
		"Ngày bắt đầu":     req.StartDate,
		"Ngày kết thúc":    req.EndDate,
	}

	err := h.larkService.PushReportToBitable(req.AppToken, req.TableID, fields)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully pushed allocation to Lark Base"})
}
