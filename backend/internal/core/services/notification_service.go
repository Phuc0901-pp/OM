package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

// NotificationBroadcaster is satisfied by *ws.Hub.
// Using an interface here prevents an import cycle between services ↔ infrastructure/websocket.
type NotificationBroadcaster interface {
	SendToUser(userID uuid.UUID, message []byte)
	BroadcastAll(message []byte)
}

type NotificationService struct {
	DB           *gorm.DB
	Hub          NotificationBroadcaster // WebSocket hub (nil-safe)
	EmailService *EmailService
}

// NewNotificationService creates a new notification service.
// hub may be nil — graceful degradation is built in.
func NewNotificationService(
	db *gorm.DB,
	hub NotificationBroadcaster,
) *NotificationService {
	s := &NotificationService{
		DB:           db,
		Hub:          hub,
		EmailService: NewEmailService(),
	}
	// Start background cleanup routine (7 days retention)
	go s.StartCleanupRoutine()
	return s
}

// StartCleanupRoutine runs every 24 hours to delete notifications older than 7 days
func (s *NotificationService) StartCleanupRoutine() {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		threshold := time.Now().AddDate(0, 0, -7)
		if err := s.DB.Unscoped().Where("created_at < ?", threshold).Delete(&domain.Notification{}).Error; err != nil {
			log.Printf("[Notification] Cleanup failed: %v", err)
		} else {
			log.Println("[Notification] Cleanup old notifications completed")
		}
	}
}

// SaveNotification persists the notification to the database
func (s *NotificationService) SaveNotification(userID uuid.UUID, title, message, notifType string, metadata map[string]interface{}) {
	var metaJSON []byte
	if metadata != nil {
		metaJSON, _ = json.Marshal(metadata)
	}

	notif := domain.Notification{
		ID:        uuid.New(),
		UserID:    userID,
		Title:     title,
		Message:   message,
		Type:      notifType,
		IsRead:    false,
		Metadata:  json.RawMessage(metaJSON),
		CreatedAt: time.Now(),
	}
	if err := s.DB.Create(&notif).Error; err != nil {
		log.Printf("[Notification] Failed to save history for user %s: %v", userID, err)
		return
	}

	payload, _ := json.Marshal(notif)

	// Local WS delivery
	if s.Hub != nil {
		s.Hub.SendToUser(userID, payload)
	}
}

// SendPushNotification sends a web push notification to a specific user
func (s *NotificationService) SendPushNotification(userID uuid.UUID, title, message string, metadata map[string]interface{}) {
	// Determine type based on title (legacy logic kept for compatibility)
	notifType := "info"
	if title == "Duyệt công việc" || title == "Đã duyệt Checkout" {
		notifType = "success"
	} else if title == "Từ chối việc" || title == "Từ chối Checkout" {
		notifType = "error"
	} else if title == "Phân công dự án" || title == "Nộp dữ liệu mới" {
		notifType = "warning"
	}

	// Always save to DB + broadcast first
	s.SaveNotification(userID, title, message, notifType, metadata)

	// Dispatch push asynchronously (goroutine, no queue needed)
	go s.dispatchPush(userID, title, message, metadata)
}

// dispatchPush is the actual synchronous Web Push sender.
func (s *NotificationService) dispatchPush(userID uuid.UUID, title, message string, metadata map[string]interface{}) {
	vapidPublicKey := os.Getenv("VAPID_PUBLIC_KEY")
	vapidPrivateKey := os.Getenv("VAPID_PRIVATE_KEY")

	if vapidPublicKey == "" || vapidPrivateKey == "" {
		log.Println("[Notification] Web Push skipped: VAPID keys not configured")
		return
	}

	// Fetch all subscriptions for this user
	var subscriptions []domain.PushSubscription
	if err := s.DB.Where("user_id = ?", userID).Find(&subscriptions).Error; err != nil {
		log.Printf("[Notification] Failed to fetch subscriptions for user %s: %v", userID, err)
		return
	}

	if len(subscriptions) == 0 {
		return // No active subscriptions
	}

	// Prepare web push payload
	payloadMap := map[string]interface{}{
		"title": title,
		"body":  message,
	}
	if metadata != nil {
		payloadMap["data"] = metadata
	}
	notificationPayload, _ := json.Marshal(payloadMap)

	// Send to all endpoints
	for _, sub := range subscriptions {
		vpSub := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}

		resp, err := webpush.SendNotification(notificationPayload, vpSub, &webpush.Options{
			Subscriber:      "mailto:admin@example.com",
			VAPIDPublicKey:  vapidPublicKey,
			VAPIDPrivateKey: vapidPrivateKey,
			TTL:             30,
		})

		if err != nil {
			log.Printf("[Notification] Push failed to %s: %v", sub.ID, err)
			continue
		}

		log.Printf("[Notification] Push sent to %s (Status: %d)", sub.Endpoint, resp.StatusCode)

		if resp.StatusCode == 410 || resp.StatusCode == 404 {
			log.Printf("[Notification] Subscription %s expired/gone, removing...", sub.ID)
			s.RemoveSubscription(sub.ID)
		}
		resp.Body.Close()
	}
}

func (s *NotificationService) RemoveSubscription(id uuid.UUID) {
	s.DB.Delete(&domain.PushSubscription{}, "id = ?", id)
}

func (s *NotificationService) NotifyAssignment(user *domain.User, projectName string) {
	// Legacy support wrapper
	s.NotifyAssignmentDetailed(user, projectName, "General", time.Now(), time.Now(), nil, uuid.Nil)
}

// NotifyAssignmentDetailed sends a fully detailed notification including Project info and Time.
func (s *NotificationService) NotifyAssignmentDetailed(user *domain.User, projectName, projectType string, startTime, endTime time.Time, taskSummaries []string, assignID uuid.UUID) {
	msg := fmt.Sprintf("Dự án: %s\nLoại: %s\n", projectName, projectType)
	msg += fmt.Sprintf("Thời gian: %s - %s\n", startTime.Format("02/01/2006"), endTime.Format("02/01/2006"))
	msg += "Danh sách công việc:\n"
	if len(taskSummaries) > 0 {
		for i, summary := range taskSummaries {
			if i >= 3 {
				msg += fmt.Sprintf("... và %d công việc khác.", len(taskSummaries)-3)
				break
			}
			msg += "- " + summary + "\n"
		}
	} else {
		msg += "(Chưa có chi tiết công việc)"
	}

	metadata := map[string]interface{}{
		"type":      "assignment",
		"assign_id": assignID.String(),
	}

	// Web Push
	go func() {
		s.SendPushNotification(user.ID, "Phân công dự án", msg, metadata)
	}()

	// Email
	go func() {
		err := s.EmailService.SendAssignmentNotification(user.Email, user.Name, projectName)
		if err != nil {
			log.Printf("[Notification] Email failed to %s: %v", user.Email, err)
		}
	}()
}

// NotifyTaskStatusUpdate sends notification for Approval or Rejection
func (s *NotificationService) NotifyTaskStatusUpdate(user *domain.User, taskName, stationName string, isApproved bool, reason string, updatedAt time.Time, taskID uuid.UUID, assignID uuid.UUID, stationID *uuid.UUID) {
	title := ""
	body := ""
	timeStr := updatedAt.Format("15:04 02/01/2006")

	if isApproved {
		title = "Duyệt công việc"
		body = fmt.Sprintf("Công việc: %s\nKhu vực: %s\nThời gian: %s\nĐã được DUYỆT.", taskName, stationName, timeStr)
	} else {
		title = "Từ chối việc"
		body = fmt.Sprintf("Công việc: %s\nKhu vực: %s\nThời gian: %s\nBị TỪ CHỐI.\nLý do: %s", taskName, stationName, timeStr, reason)
	}

	metadata := map[string]interface{}{
		"type":      "task_status",
		"task_id":   taskID.String(),
		"assign_id": assignID.String(),
	}

	if stationID != nil {
		metadata["station_id"] = stationID.String()
	}

	go func() {
		s.SendPushNotification(user.ID, title, body, metadata)
	}()
}

// NotifyManagers broadcasts a notification to all users with Manager role
func (s *NotificationService) NotifyManagers(title, message string, metadata map[string]interface{}) {
	var managers []domain.User
	err := s.DB.Joins("JOIN roles ON roles.id = users.id_role").Where("LOWER(roles.name) = ?", "manager").Find(&managers).Error
	if err != nil {
		log.Printf("[Notification] Failed to find managers: %v", err)
		return
	}
	log.Printf("[Notification] Found %d managers to notify", len(managers))

	if len(managers) == 0 {
		return
	}

	uniqueManagers := make(map[uuid.UUID]bool)

	for _, manager := range managers {
		if uniqueManagers[manager.ID] {
			continue
		}
		uniqueManagers[manager.ID] = true
		
		go func(uid uuid.UUID) {
			s.SendPushNotification(uid, title, message, metadata)
		}(manager.ID)
	}
}

// NotifySubmission sends a detailed submission notification to a specific leader/manager
func (s *NotificationService) NotifySubmission(receiverID uuid.UUID, senderName string, projectName, mainCategory, childCategory, stationName, processName string, submittedAt time.Time, taskID uuid.UUID, assignID uuid.UUID, stationID *uuid.UUID) {
	taskContent := projectName
	if mainCategory != "" {
		taskContent += " - " + mainCategory
	}
	if childCategory != "" {
		taskContent += " - " + childCategory
	}
	if stationName != "" {
		taskContent += " - " + stationName
	}
	if processName != "" {
		taskContent += " - " + processName
	}

	title := "Nộp dữ liệu công việc mới"
	body := fmt.Sprintf("Người gửi: %s\nNội dung: %s\nThời gian: %s",
		senderName,
		taskContent,
		submittedAt.Format("15:04 02/01/2006"))

	metadata := map[string]interface{}{
		"type":      "submission",
		"task_id":   taskID.String(),
		"assign_id": assignID.String(),
	}

	if stationID != nil {
		metadata["station_id"] = stationID.String()
	}

	go func() {
		s.SendPushNotification(receiverID, title, body, metadata)
	}()
}

// NotifyCheckoutStatus sends notification to user about their checkout request status
// NotifyAllPersonnel sends a notification to every active user in the DB via WebSocket + DB.
func (s *NotificationService) NotifyAllPersonnel(title, message string, metadata map[string]interface{}) {
	var users []domain.User
	if err := s.DB.Find(&users).Error; err != nil {
		log.Printf("[Notification] Failed to find all users for broadcast: %v", err)
		return
	}
	for _, u := range users {
		userID := u.ID // shadow loop var
		go func(uid uuid.UUID) {
			s.SendPushNotification(uid, title, message, metadata)
		}(userID)
	}
}

func (s *NotificationService) NotifyCheckoutStatus(userID uuid.UUID, isApproved bool, reason string, attendanceID uuid.UUID, personnelPhoto string, checkoutImgURL string) {
	title := ""
	body := ""

	if isApproved {
		title = "Đã duyệt Checkout"
		body = "Yêu cầu checkout của bạn đã được quản lý phê duyệt."
	} else {
		title = "Từ chối Checkout"
		body = fmt.Sprintf("Yêu cầu checkout bị từ chối.\nLý do: %s", reason)
	}

	metadata := map[string]interface{}{
		"type":             "checkout_status",
		"attendance_id":    attendanceID.String(),
		"personnel_photo":  personnelPhoto,
		"checkout_img_url": checkoutImgURL,
	}

	go func() {
		s.SendPushNotification(userID, title, body, metadata)
	}()
}
