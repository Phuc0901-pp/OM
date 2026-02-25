package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/domain"
	infraJobs "github.com/phuc/cmms-backend/internal/infrastructure/jobs"
	infraRedis "github.com/phuc/cmms-backend/internal/infrastructure/redis"
	infraWS "github.com/phuc/cmms-backend/internal/infrastructure/websocket"
	"gorm.io/gorm"
)

// MonitoringHandler provides real-time metrics for the admin monitoring dashboard.
type MonitoringHandler struct {
	DB     *gorm.DB
	Hub    *infraWS.Hub
	Redis  *infraRedis.Client
	Queue  *infraJobs.Queue
}

// NewMonitoringHandler creates a handler. Redis and Queue may be nil (graceful degradation).
func NewMonitoringHandler(db *gorm.DB, hub *infraWS.Hub, redis *infraRedis.Client, queue *infraJobs.Queue) *MonitoringHandler {
	return &MonitoringHandler{DB: db, Hub: hub, Redis: redis, Queue: queue}
}

// NotificationMetrics is the aggregated response for GET /admin/notification-metrics
type NotificationMetrics struct {
	// Real-time WS layer
	CCU              int `json:"ccu"`               // Concurrent connected users
	TotalConnections int `json:"total_connections"` // Sum of all WS connections (multi-tab)

	// Last-30-days stats
	Total7d          int64   `json:"total_7d"`         // Notifications sent last 7 days
	Total30d         int64   `json:"total_30d"`        // Notifications sent last 30 days
	ReadRate30d      float64 `json:"read_rate_30d"`    // % Read in last 30 days
	TotalUnread      int64   `json:"total_unread"`     // Global unread count
	PushSubCount     int64   `json:"push_sub_count"`   // Active push subscriptions

	// Job queue depth
	QueueDepth       int64   `json:"queue_depth"` // Pending async jobs in Redis

	// Per-type breakdown (last 30d)
	TypeBreakdown    []TypeCount `json:"type_breakdown"`

	// Hourly delivery (last 24h, for sparkline chart)
	HourlyDelivery   []HourlyBucket `json:"hourly_delivery"`

	Timestamp        time.Time `json:"timestamp"`
}

// TypeCount is used for the per-type notification breakdown.
type TypeCount struct {
	Type  string `json:"type"`
	Count int64  `json:"count"`
}

// HourlyBucket represents one-hour delivery count.
type HourlyBucket struct {
	Hour  string `json:"hour"`  // "2025-01-15 14:00"
	Count int64  `json:"count"`
}

// GetNotificationMetrics returns aggregated metrics for the monitoring dashboard.
// GET /api/admin/notification-metrics
func (h *MonitoringHandler) GetNotificationMetrics(c *gin.Context) {
	now := time.Now()
	ago7d  := now.AddDate(0, 0, -7)
	ago30d := now.AddDate(0, 0, -30)
	ago24h := now.Add(-24 * time.Hour)

	var m NotificationMetrics
	m.Timestamp = now

	// ── WS Hub stats ─────────────────────────────────────────────────────────
	if h.Hub != nil {
		stats := h.Hub.Stats()
		m.CCU = stats.UniqueUsers
		m.TotalConnections = stats.TotalConns
	}

	// ── DB Aggregations ──────────────────────────────────────────────────────
	h.DB.Model(&domain.Notification{}).Where("created_at >= ?", ago7d).Count(&m.Total7d)
	h.DB.Model(&domain.Notification{}).Where("created_at >= ?", ago30d).Count(&m.Total30d)
	h.DB.Model(&domain.Notification{}).Where("is_read = ?", false).Count(&m.TotalUnread)
	h.DB.Model(&domain.PushSubscription{}).Count(&m.PushSubCount)

	// Read rate
	if m.Total30d > 0 {
		var readCount int64
		h.DB.Model(&domain.Notification{}).
			Where("created_at >= ? AND is_read = ?", ago30d, true).
			Count(&readCount)
		m.ReadRate30d = float64(readCount) / float64(m.Total30d) * 100
	}

	// Per-type breakdown
	type result struct {
		Type  string
		Count int64
	}
	var breakdown []result
	h.DB.Model(&domain.Notification{}).
		Select("type, count(*) as count").
		Where("created_at >= ?", ago30d).
		Group("type").
		Scan(&breakdown)
	for _, r := range breakdown {
		m.TypeBreakdown = append(m.TypeBreakdown, TypeCount(r))
	}

	// Hourly delivery last 24h (hour-truncated)
	type hourResult struct {
		Hour  string
		Count int64
	}
	var hourly []hourResult
	h.DB.Raw(`
		SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') as hour,
		       count(*) as count
		FROM notifications
		WHERE created_at >= ?
		GROUP BY 1
		ORDER BY 1 ASC
	`, ago24h).Scan(&hourly)
	for _, r := range hourly {
		m.HourlyDelivery = append(m.HourlyDelivery, HourlyBucket(r))
	}

	// ── Redis queue depth ─────────────────────────────────────────────────────
	if h.Redis != nil {
		m.QueueDepth, _ = h.Redis.LLen(c.Request.Context(), "jobs:notifications").Result()
	}

	c.JSON(http.StatusOK, m)
}
