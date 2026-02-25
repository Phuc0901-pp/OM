package handlers

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	DB *gorm.DB
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{DB: db}
}

// GetVapidPublicKey returns the public VAPID key for the frontend
func (h *NotificationHandler) GetVapidPublicKey(c *gin.Context) {
	key := os.Getenv("VAPID_PUBLIC_KEY")
	if key == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "VAPID key not configured"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"publicKey": key})
}

// Subscribe handles POST /monitoring/subscribe
func (h *NotificationHandler) Subscribe(c *gin.Context) {
	var req struct {
		UserID    string `json:"userId"`
		Endpoint  string `json:"endpoint"`
		P256dh    string `json:"p256dh"`
		Auth      string `json:"auth"`
		UserAgent string `json:"userAgent"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid User UUID"})
		return
	}

	// Upsert subscription
	// Check if endpoint already exists
	var sub domain.PushSubscription
	err = h.DB.Where("endpoint = ?", req.Endpoint).First(&sub).Error

	if err == nil {
		// Update existing
		sub.UserID = userID
		sub.P256dh = req.P256dh
		sub.Auth = req.Auth
		sub.UserAgent = req.UserAgent
		h.DB.Save(&sub)
	} else {
		// Create new
		newSub := domain.PushSubscription{
			UserID:    userID,
			Endpoint:  req.Endpoint,
			P256dh:    req.P256dh,
			Auth:      req.Auth,
			UserAgent: req.UserAgent,
		}
		if err := h.DB.Create(&newSub).Error; err != nil {
			log.Printf("Failed to save subscription: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subscription"})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Subscribed successfully"})
}

// GetNotifications returns the list of notifications for the current user
func (h *NotificationHandler) GetNotifications(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))

	var notifications []domain.Notification
	limit := 50
	
	if err := h.DB.Where("user_id = ?", userID).Order("created_at desc").Limit(limit).Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}
	
	var unreadCount int64
	h.DB.Model(&domain.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&unreadCount)

	c.JSON(http.StatusOK, gin.H{
		"data": notifications,
		"unread": unreadCount,
	})
}

// MarkRead marks a specific notification as read
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id := c.Param("id")
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))

	result := h.DB.Model(&domain.Notification{}).Where("id = ? AND user_id = ?", id, userID).Update("is_read", true)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}

// MarkAllRead marks all notifications for the user as read
func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))
	
	h.DB.Model(&domain.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Update("is_read", true)
	
	c.JSON(http.StatusOK, gin.H{"message": "All marked as read"})
}

// DeleteNotification removes a notification permanently
func (h *NotificationHandler) DeleteNotification(c *gin.Context) {
	id := c.Param("id")
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))

	// Verify ownership and delete
	result := h.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&domain.Notification{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete notification"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found or access denied"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted"})
}

func (h *NotificationHandler) DeleteAllNotifications(c *gin.Context) {
	log.Printf("DeleteAllNotifications Handler Reached")
	userIDStr, exists := c.Get("user_id")
	if !exists {
		log.Printf("DeleteAllNotifications: Unauthorized - No user_id")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))
	log.Printf("DeleteAllNotifications: Deleting for user %s", userID)

	// Delete all for user
	result := h.DB.Where("user_id = ?", userID).Delete(&domain.Notification{})
	if result.Error != nil {
		log.Printf("DeleteAllNotifications: DB Error %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete notifications"})
		return
	}
	log.Printf("DeleteAllNotifications: Success, deleted %d rows", result.RowsAffected)

	c.JSON(http.StatusOK, gin.H{"message": "All notifications deleted", "count": result.RowsAffected})
}
