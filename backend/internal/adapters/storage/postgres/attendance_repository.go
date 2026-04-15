package postgres

import (
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

type AttendanceRepository struct {
	db *gorm.DB
}

func NewAttendanceRepository(db *gorm.DB) *AttendanceRepository {
	return &AttendanceRepository{db: db}
}

// CheckIn creates a new attendance record or updates existing one for check-in
func (r *AttendanceRepository) CheckIn(userID uuid.UUID, projectID *uuid.UUID, assignID *uuid.UUID, address string) (*domain.Attendance, error) {
	now := time.Now()
	
	// Check if user has an active (not checked out) attendance
	var attendance domain.Attendance
	
	// Find the active attendance for this specific assignment today.
	// Each assign can have its own check-in record.
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := today.Add(24 * time.Hour)

	query := r.db.Where("id_user = ? AND created_at >= ? AND created_at < ?", userID, today, tomorrow)
	if assignID != nil {
		query = query.Where("id_assign = ?", *assignID)
	}
	err := query.Order("created_at DESC").First(&attendance).Error
	
	if err == gorm.ErrRecordNotFound {
		// Create new attendance record
		attendance = domain.Attendance{
			IDUser:         userID,
			IDProject:      projectID,
			IDAssign:       assignID,
			StatusCheckin:  1,
			DateCheckin:    &now,
			SiteStatus:     1,
			AddressCheckin: address,
		}
		if err := r.db.Create(&attendance).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		// Logic: If the latest record is already checked out, do we create a new one?
		if attendance.StatusCheckout == 1 {
			newAttendance := domain.Attendance{
				IDUser:         userID,
				IDProject:      projectID,
				IDAssign:       assignID,
				StatusCheckin:  1,
				DateCheckin:    &now,
				SiteStatus:     1,
				AddressCheckin: address,
			}
			if err := r.db.Create(&newAttendance).Error; err != nil {
				return nil, err
			}
			return &newAttendance, nil
		}

		// Otherwise, update existing record
		attendance.StatusCheckin = 1
		attendance.DateCheckin = &now
		attendance.SiteStatus = 1
		attendance.IDProject = projectID
		attendance.IDAssign = assignID
		if address != "" {
			attendance.AddressCheckin = address
		}
		if err := r.db.Save(&attendance).Error; err != nil {
			return nil, err
		}
	}
	
	return &attendance, nil
}

// CheckOut updates attendance record for check-out
func (r *AttendanceRepository) CheckOut(userID uuid.UUID) (*domain.Attendance, error) {
	now := time.Now()
	
	// Find today's attendance record
	var attendance domain.Attendance
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := today.Add(24 * time.Hour)
	
	err := r.db.Where("id_user = ? AND created_at >= ? AND created_at < ?", userID, today, tomorrow).
		First(&attendance).Error
	
	if err != nil {
		return nil, err
	}
	
	// Update checkout info
	attendance.StatusCheckout = 1
	attendance.DateCheckout = &now
	attendance.SiteStatus = 0
	
	if err := r.db.Save(&attendance).Error; err != nil {
		return nil, err
	}
	
	return &attendance, nil
}

// GetTodayAttendance gets today's attendance record for a user (latest, any assign)
func (r *AttendanceRepository) GetTodayAttendance(userID uuid.UUID) (*domain.Attendance, error) {
	return r.GetTodayAttendanceByAssign(userID, nil)
}

// GetTodayAttendanceByAssign gets today's attendance for a specific assign (or latest if assignID is nil)
func (r *AttendanceRepository) GetTodayAttendanceByAssign(userID uuid.UUID, assignID *uuid.UUID) (*domain.Attendance, error) {
	var attendance domain.Attendance
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := today.Add(24 * time.Hour)

	query := r.db.Preload("User").Preload("Project").Preload("Assign").Preload("Assign.Template").
		Where("id_user = ? AND created_at >= ? AND created_at < ?", userID, today, tomorrow)
	if assignID != nil {
		query = query.Where("id_assign = ?", *assignID)
	}
	err := query.Order("created_at DESC").First(&attendance).Error

	if err != nil {
		return nil, err
	}

	return &attendance, nil
}

// GetUserAttendanceHistory gets attendance history for a user
func (r *AttendanceRepository) GetUserAttendanceHistory(userID uuid.UUID, limit int) ([]domain.Attendance, error) {
	var attendances []domain.Attendance
	
	query := r.db.Preload("Project").Preload("Assign").Preload("Assign.Template").Where("id_user = ?", userID).Order("created_at DESC")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	if err := query.Find(&attendances).Error; err != nil {
		return nil, err
	}
	
	return attendances, nil
}

// GetAllTodayAttendances gets all attendance records for today (for managers)
func (r *AttendanceRepository) GetAllTodayAttendances() ([]domain.Attendance, error) {
	var attendances []domain.Attendance
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := today.Add(24 * time.Hour)
	
	err := r.db.Preload("User").Preload("Project").Preload("Assign").Preload("Assign.Template").
		Where("created_at >= ? AND created_at < ?", today, tomorrow).
		Order("created_at DESC").
		Find(&attendances).Error
	
	if err != nil {
		return nil, err
	}
	
	return attendances, nil
}

// GetAllAttendanceHistory gets all attendance records (for managers) with pagination support via limit
func (r *AttendanceRepository) GetAllAttendanceHistory(limit int) ([]domain.Attendance, error) {
	var attendances []domain.Attendance
	
	query := r.db.Preload("User").Preload("Project").Preload("Assign").Preload("Assign.Template").Order("created_at DESC")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	if err := query.Find(&attendances).Error; err != nil {
		return nil, err
	}
	
	return attendances, nil
}

// GetUsersOnSite gets all users currently on site
func (r *AttendanceRepository) GetUsersOnSite() ([]domain.Attendance, error) {
	var attendances []domain.Attendance
	
	err := r.db.Preload("User").Preload("Project").
		Where("site_status = ?", 1).
		Order("date_checkin DESC").
		Find(&attendances).Error
	
	if err != nil {
		return nil, err
	}
	
	return attendances, nil
}

// UpdatePhotos updates photo URLs for an attendance record
func (r *AttendanceRepository) UpdatePhotos(attendance *domain.Attendance) error {
	return r.db.Save(attendance).Error
}

// RequestCheckout marks an attendance record as requesting checkout
func (r *AttendanceRepository) RequestCheckout(attendance *domain.Attendance) error {
	now := time.Now()
	attendance.CheckoutRequested = true
	attendance.CheckoutRequestTime = &now
	return r.db.Omit("User").Save(attendance).Error
}

// ApproveCheckout approves a checkout request and finalizes the checkout
func (r *AttendanceRepository) ApproveCheckout(attendance *domain.Attendance) error {
	now := time.Now()
	attendance.CheckoutApproved = true
	attendance.CheckoutApprovedTime = &now
	attendance.CheckoutRequested = false
	
	// Finalize Checkout Logic:
	// Use the time they requested checkout as the actual checkout time
	if attendance.CheckoutRequestTime != nil {
		attendance.DateCheckout = attendance.CheckoutRequestTime
	} else {
		attendance.DateCheckout = &now
	}
	attendance.StatusCheckout = 1
	attendance.SiteStatus = 0

	return r.db.Omit("User").Save(attendance).Error
}

// RejectCheckout rejects a checkout request
func (r *AttendanceRepository) RejectCheckout(attendance *domain.Attendance) error {
	attendance.CheckoutRejected = true
	attendance.CheckoutRequested = false
	return r.db.Omit("User").Save(attendance).Error
}

// GetPendingCheckoutRequests gets pending checkout requests.
// If managerID is provided, only returns requests from users managed by that manager.
func (r *AttendanceRepository) GetPendingCheckoutRequests(managerID *uuid.UUID) ([]domain.Attendance, error) {
	var attendances []domain.Attendance

	query := r.db.
		Preload("User").Preload("User.Team").Preload("Project").Preload("Assign").Preload("Assign.Template").
		Where("checkout_requested = ? AND checkout_approved = ? AND checkout_rejected = ?", true, false, false).
		Order("checkout_request_time ASC")

	if managerID != nil {
		query = query.
			Joins("JOIN users ON users.id = attendances.id_user AND users.deleted_at IS NULL").
			Where("users.id_leader = ?", *managerID)
	}

	if err := query.Find(&attendances).Error; err != nil {
		return nil, err
	}

	return attendances, nil
}

// GetAttendanceByID gets an attendance record by ID
func (r *AttendanceRepository) GetAttendanceByID(id uuid.UUID) (*domain.Attendance, error) {
	var attendance domain.Attendance
	err := r.db.Preload("User").Preload("Project").Preload("Assign").Preload("Assign.Template").First(&attendance, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &attendance, nil
}

// GetAttendanceByDate gets an attendance record for a specific date, checking multiple event time columns
func (r *AttendanceRepository) GetAttendanceByDate(userID uuid.UUID, date time.Time) (*domain.Attendance, error) {
	var attendance domain.Attendance
	// Normalize to start and end of the day
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	end := start.Add(24 * time.Hour)
	
	err := r.db.Preload("User").Preload("Project").
		Where("id_user = ? AND ("+
			"(created_at >= ? AND created_at < ?) OR "+
			"(date_checkin >= ? AND date_checkin < ?) OR "+
			"(date_checkout >= ? AND date_checkout < ?) OR "+
			"(checkout_request_time >= ? AND checkout_request_time < ?) OR "+
			"(checkout_approved_time >= ? AND checkout_approved_time < ?)"+
			")", userID, start, end, start, end, start, end, start, end, start, end).
		Order("created_at DESC"). // Get the most recent one if multiple exist
		First(&attendance).Error
	
	if err != nil {
		return nil, err
	}
	
	return &attendance, nil
}

// GetProjectName is a helper to retrieve the project name by ID
func (r *AttendanceRepository) GetProjectName(projectID uuid.UUID) string {
	var project domain.Project
	if err := r.db.Select("name").Where("id = ?", projectID).First(&project).Error; err == nil && project.Name != "" {
		return project.Name
	}
	return projectID.String()
}

// GetAttendanceByAssignAndDates fetches all attendances for an assign on a list of calendar dates (YYYY-MM-DD).
func (r *AttendanceRepository) GetAttendanceByAssignAndDates(assignID uuid.UUID, dates []string) ([]domain.Attendance, error) {
	var attendances []domain.Attendance
	if len(dates) == 0 {
		return attendances, nil
	}

	// Build OR conditions: one per date range (start-of-day to end-of-day)
	var conditions []string
	var args []interface{}
	for _, d := range dates {
		t, err := time.ParseInLocation("2006-01-02", d, time.Local)
		if err != nil {
			continue
		}
		start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
		end := start.Add(24 * time.Hour)
		conditions = append(conditions, "(created_at >= ? AND created_at < ?)")
		args = append(args, start, end)
	}
	if len(conditions) == 0 {
		return attendances, nil
	}

	dateFilter := "(" + joinStrings(conditions, " OR ") + ")"
	args = append([]interface{}{assignID}, args...)

	err := r.db.Preload("User").Preload("Project").
		Where("id_assign = ? AND "+dateFilter, args...).
		Order("created_at ASC").
		Find(&attendances).Error
	return attendances, err
}

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

