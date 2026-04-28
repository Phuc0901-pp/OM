package services

import (
	"fmt"

	"github.com/phuc/cmms-backend/internal/platform/logger"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type ReminderService struct {
	db         *gorm.DB
	cronRunner *cron.Cron
}

func NewReminderService(db *gorm.DB) *ReminderService {
	// Create cron with timezone support (Vietnam Time usually applied, but server local time by default)
	c := cron.New()
	return &ReminderService{
		db:         db,
		cronRunner: c,
	}
}

// Start begins the background cron scheduler
func (s *ReminderService) Start() {
	log := logger.Get()

	// Chạy lúc 17:00 mỗi ngày (5:00 PM) - Giờ nhắc nhở báo cáo cuối ngày
	_, err := s.cronRunner.AddFunc("0 17 * * *", s.processDailyReminders)
	if err != nil {
		log.Fatal("Failed to setup daily reminder cron job", zap.Error(err))
	}

	// For testing purposes, if you want to run it immediately once on startup, uncomment:
	// go s.processDailyReminders()

	s.cronRunner.Start()
	log.Info("Daily Reminder Service started. Scheduled to run at 17:00 daily.")
}

// Stop gracefully stops the cron scheduler
func (s *ReminderService) Stop() {
	if s.cronRunner != nil {
		s.cronRunner.Stop()
	}
}

type reminderRow struct {
	UserID       string
	ProjectName  string
	PendingCount int
}

func (s *ReminderService) processDailyReminders() {
	log := logger.Get()
	log.Info("Starting Daily Reminder Scan...")

	// Find users that have assignments in projects that are not yet ended (end_date >= today)
	// AND have TaskDetails which are NOT submitted (status_submit = 0)
	query := `
		SELECT jsonb_array_elements_text(a.id_user) as user_id, p.name as project_name, count(td.id) as pending_count
		FROM assigns a
		JOIN projects p ON a.id_project = p.id
		JOIN detail_assigns td ON td.id_assign = a.id
		WHERE a.end_time >= CURRENT_DATE 
		  AND a.deleted_at IS NULL AND p.deleted_at IS NULL AND td.deleted_at IS NULL
		  AND td.status_submit = 0
		GROUP BY jsonb_array_elements_text(a.id_user), p.name
	`

	rows, err := s.db.Raw(query).Rows()
	if err != nil {
		log.Error("Failed to run daily reminder query", zap.Error(err))
		return
	}
	defer rows.Close()

	for rows.Next() {
		var row reminderRow
		if err := s.db.ScanRows(rows, &row); err != nil {
			log.Error("Failed to scan reminder row", zap.Error(err))
			continue
		}

		// Log remainder instead of sending notification
		log.Info(fmt.Sprintf("User %s has %d pending tasks in %s", row.UserID, row.PendingCount, row.ProjectName))
	}

	log.Info("Daily Reminder Scan Completed.")
}
