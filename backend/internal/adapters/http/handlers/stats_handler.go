package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/core/services"
)

type StatsHandler struct {
	statsService *services.StatsService
}

func NewStatsHandler(statsService *services.StatsService) *StatsHandler {
	return &StatsHandler{statsService: statsService}
}

// InvalidateManagerCache is a no-op stub (Redis removed).
func (h *StatsHandler) InvalidateManagerCache(managerID string) {}

// InvalidateAdminCache is a no-op stub (Redis removed).
func (h *StatsHandler) InvalidateAdminCache() {}

// GET /stats/manager?manager_id=<uuid>
func (h *StatsHandler) GetManagerStats(c *gin.Context) {
	managerIDStr := c.Query("manager_id")
	if managerIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "manager_id is required"})
		return
	}
	managerID, err := uuid.Parse(managerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid manager_id"})
		return
	}
	stats, err := h.statsService.GetManagerStats(managerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GET /stats/admin - returns manager-level dashboard stats for admin view
func (h *StatsHandler) GetAdminStats(c *gin.Context) {
	// For admin, use a zero UUID to get aggregate stats
	stats, err := h.statsService.GetManagerStats(uuid.Nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stats"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GET /stats/user - no-op placeholder for now
func (h *StatsHandler) GetUserStats(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "User stats endpoint - coming soon"})
}

// GET /stats/detailed - no-op placeholder
func (h *StatsHandler) GetDetailedStats(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Detailed stats endpoint - coming soon"})
}

// GET /stats/timeline - no-op placeholder
func (h *StatsHandler) GetTimeline(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Timeline endpoint - coming soon"})
}
