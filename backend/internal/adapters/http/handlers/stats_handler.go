package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
)

type StatsHandler struct {
	statsService *services.StatsService
}

func NewStatsHandler(statsService *services.StatsService) *StatsHandler {
	return &StatsHandler{
		statsService: statsService,
	}
}

func (h *StatsHandler) GetAdminStats(c *gin.Context) {
	stats, err := h.statsService.GetAdminStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *StatsHandler) GetManagerStats(c *gin.Context) {
    managerID := c.Query("manager_id")
	// If empty, it's ok? Service handles it? Original code had check.
	// Original:
	if managerID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Manager ID is required"})
        return
    }

	stats, err := h.statsService.GetManagerStats(managerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *StatsHandler) GetUserStats(c *gin.Context) {
    userID := c.Query("user_id")
    if userID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
        return
    }
    
    projectID := c.Query("project_id") // Optional filter
    
    logger.Info("GetUserStats request", zap.String("user_id", userID), zap.String("project_id", projectID))
    
    stats, err := h.statsService.GetUserStats(userID, projectID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, stats)
}

func (h *StatsHandler) GetDetailedStats(c *gin.Context) {
    projectID := c.Query("project_id")
    unit := c.Query("unit")
    userID := c.Query("user_id") // Extract user_id
    
    stats, err := h.statsService.GetDetailedStats(projectID, unit, userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, stats)
}

func (h *StatsHandler) GetTimeline(c *gin.Context) {
    projectID := c.Query("project_id")
    userID := c.Query("user_id") // Extract user_id
    
    timeline, err := h.statsService.GetTimeline(projectID, 50, userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, timeline)
}
