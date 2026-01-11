package services

import (
	"fmt"
	"log"
	"os"

	"github.com/phuc/cmms-backend/internal/domain"
)

type NotificationService struct {
	EmailService    *EmailService
	TelegramService *TelegramService
}

func NewNotificationService() *NotificationService {
	return &NotificationService{
		EmailService:    NewEmailService(),
		TelegramService: NewTelegramService(),
	}
}

func (s *NotificationService) NotifyAssignment(user *domain.User, projectName string) {
	// 1. Send Email
	go func() {
		err := s.EmailService.SendAssignmentNotification(user.Email, user.FullName, projectName)
		if err != nil {
			log.Printf("[Notification] Email failed to %s: %v", user.Email, err)
		} else {
            log.Printf("[Notification] Email sent to %s", user.Email)
        }
	}()

	// 2. Send Telegram
	go func() {
		targetChatID := user.TelegramChatID
		// Fallback to Test Chat ID if user has none
		if targetChatID == "" {
			targetChatID = os.Getenv("TELEGRAM_TEST_CHAT_ID")
		}

		if targetChatID != "" {
			msg := fmt.Sprintf("🔔 *NEW ASSIGNMENT*\n👷 Hello %s,\n📋 Project: %s\n🚀 Check app for details.", user.FullName, projectName)
			err := s.TelegramService.SendMessage(targetChatID, msg)
			if err != nil {
				log.Printf("[Notification] Telegram failed to %s: %v", targetChatID, err)
			} else {
                log.Printf("[Notification] Telegram sent to %s", targetChatID)
            }
		} else {
			log.Println("[Notification] Telegram skipped: No Chat ID found")
		}
	}()
}
