package services

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/adapters/storage/postgres"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"github.com/phuc/cmms-backend/internal/utils"
)

type AttendanceService struct {
	repo         *postgres.AttendanceRepository
	minioClient  *storage.MinioClient
}
func NewAttendanceService(repo *postgres.AttendanceRepository, minioClient *storage.MinioClient) *AttendanceService {
	return &AttendanceService{
		repo:         repo,
		minioClient:  minioClient,
	}
}

// CheckInWithPhotos handles user check-in with photos
func (s *AttendanceService) CheckInWithPhotos(userID uuid.UUID, projectID *uuid.UUID, assignID *uuid.UUID, photos map[string]interface{}, address string) (*domain.Attendance, error) {
	now := time.Now()
	year := now.Year()
	timestamp := now.Format("20060102_150405")

	// Project for filename and path
	projectIDStr := "unknown"
	projectName := "unknown"
	if projectID != nil {
		projectIDStr = projectID.String()
		projectName = s.repo.GetProjectName(*projectID)
	}

	// Format: <ProjectName Slug>/<YYYY>/<MM>-<YYYY>/Attendance/Checkin
	monthYearStr := now.Format("01-2006")
	basePath := fmt.Sprintf("%s/%d/%s/Attendance/Checkin", utils.SlugifyName(projectName), year, monthYearStr)

	categoryMap := map[string]string{
		"personnel_photo":   "personnel",
		"id_card_front":     "CCCD",
		"id_card_back":      "CCCD",
		"safety_card_front": "ATLD",
		"safety_card_back":  "ATLD",
		"tools_photos":      "Tool",
		"documents_photos":  "Record",
	}

	processPhotoField := func(field string, action string) (string, error) {
		var finalURL string
		if val, ok := photos[field]; ok && val != nil {
			category := categoryMap[field]
			if base64Str, ok := val.(string); ok && base64Str != "" {
				filename := fmt.Sprintf("%s_%s_%s_%s_%s.jpg", userID.String(), projectIDStr, timestamp, field, action)
				objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
				url, err := s.uploadBase64(base64Str, objectName)
				if err != nil {
					return "", fmt.Errorf("failed to upload %s: %w", field, err)
				}
				finalURL = url
			} else if photosArray, ok := val.([]interface{}); ok && len(photosArray) > 0 {
				urls := []string{}
				for i, photo := range photosArray {
					if base64Str, ok := photo.(string); ok && base64Str != "" {
						filename := fmt.Sprintf("%s_%s_%s_%s_%d_%s.jpg", userID.String(), projectIDStr, timestamp, field, i, action)
						objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
						url, err := s.uploadBase64(base64Str, objectName)
						if err != nil {
							return "", fmt.Errorf("failed to upload %s[%d]: %w", field, i, err)
						}
						urls = append(urls, url)
					}
				}
				if len(urls) > 0 {
					jsonBytes, _ := json.Marshal(urls)
					finalURL = string(jsonBytes)
				}
			}
		}
		return finalURL, nil
	}

	// Upload all photos using the helper
	fields := []string{"personnel_photo", "id_card_front", "id_card_back", "safety_card_front", "safety_card_back", "tools_photos", "documents_photos"}
	photoURLs := make(map[string]string)
	for _, field := range fields {
		url, err := processPhotoField(field, "checkin")
		if err != nil {
			return nil, err
		}
		photoURLs[field] = url
	}

	// Create or update attendance record
	attendance, err := s.repo.CheckIn(userID, projectID, assignID, address)
	if err != nil {
		return nil, err
	}

	// Update photo URLs
	attendance.PersonnelPhoto = photoURLs["personnel_photo"]
	attendance.IDCardFront = photoURLs["id_card_front"]
	attendance.IDCardBack = photoURLs["id_card_back"]
	attendance.SafetyCardFront = photoURLs["safety_card_front"]
	attendance.SafetyCardBack = photoURLs["safety_card_back"]
	attendance.ToolsPhotos = photoURLs["tools_photos"]
	attendance.DocumentsPhotos = photoURLs["documents_photos"]

	// Save updated attendance
	if err := s.repo.UpdatePhotos(attendance); err != nil {
		return nil, err
	}

	return attendance, nil
}

// GetByID returns a single attendance record by its ID
func (s *AttendanceService) GetByID(id uuid.UUID) (*domain.Attendance, error) {
	return s.repo.GetAttendanceByID(id)
}

// GetByDate returns an attendance record by user ID and date
func (s *AttendanceService) GetByDate(userID uuid.UUID, date time.Time) (*domain.Attendance, error) {
	return s.repo.GetAttendanceByDate(userID, date)
}

// uploadBase64 uploads a base64 encoded image to MinIO
func (s *AttendanceService) uploadBase64(base64Str string, objectName string) (string, error) {
	if s.minioClient == nil {
		return "", fmt.Errorf("MinIO client not initialized")
	}

	// Remove data:image/...;base64, prefix if present
	if idx := strings.Index(base64Str, ","); idx != -1 {
		base64Str = base64Str[idx+1:]
	}

	// Decode base64
	decoded, err := base64.StdEncoding.DecodeString(base64Str)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	// Upload to MinIO
	url, err := s.minioClient.UploadBytes(decoded, objectName, "image/jpeg")
	if err != nil {
		return "", fmt.Errorf("failed to upload to MinIO: %w", err)
	}

	return url, nil
}

// CheckIn handles simple user check-in without photos (backward compatibility)
func (s *AttendanceService) CheckIn(userID uuid.UUID, projectID *uuid.UUID, assignID *uuid.UUID) (*domain.Attendance, error) {
	return s.repo.CheckIn(userID, projectID, assignID, "")
}

// CheckOut handles user check-out (requires approval)
func (s *AttendanceService) CheckOut(userID uuid.UUID) (*domain.Attendance, error) {
	// Get today's attendance
	attendance, err := s.repo.GetTodayAttendance(userID)
	if err != nil {
		return nil, fmt.Errorf("no attendance record found for today")
	}

	// Check if checkout is approved
	if !attendance.CheckoutApproved {
		return nil, fmt.Errorf("checkout not approved yet, please request checkout first")
	}

	// Proceed with checkout
	return s.repo.CheckOut(userID)
}

// RequestCheckout allows user to request checkout with photos
func (s *AttendanceService) RequestCheckout(userID uuid.UUID, photos map[string]interface{}, address string) (*domain.Attendance, error) {
	// Get today's attendance
	attendance, err := s.repo.GetTodayAttendance(userID)
	if err != nil {
		return nil, fmt.Errorf("no attendance record found for today")
	}

	// Check if already requested
	if attendance.CheckoutRequested {
		return nil, fmt.Errorf("checkout already requested")
	}

	// Check if already approved
	if attendance.CheckoutApproved {
		return nil, fmt.Errorf("checkout already approved, you can checkout now")
	}

	// ------------- Handle Photos Upload Logic -------------
	now := time.Now()
	year := now.Year()
	timestamp := now.Format("20060102_150405")

	// Project string
	projectIDStr := "unknown"
	projectName := "unknown"
	if attendance.IDProject != nil {
		projectIDStr = attendance.IDProject.String()
		projectName = s.repo.GetProjectName(*attendance.IDProject)
	}

	// Format: <ProjectName Slug>/<YYYY>/<MM>-<YYYY>/Attendance/Checkout
	monthYearStr := now.Format("01-2006")
	basePath := fmt.Sprintf("%s/%d/%s/Attendance/Checkout", utils.SlugifyName(projectName), year, monthYearStr)

	categoryMap := map[string]string{
		"personnel_photo":   "personnel",
		"id_card_front":     "CCCD",
		"id_card_back":      "CCCD",
		"safety_card_front": "ATLD",
		"safety_card_back":  "ATLD",
		"tools_photos":      "Tool",
		"documents_photos":  "Record",
	}

	processPhotoField := func(field string, action string) (string, error) {
		var finalURL string
		if val, ok := photos[field]; ok && val != nil {
			category := categoryMap[field]
			if base64Str, ok := val.(string); ok && base64Str != "" {
				filename := fmt.Sprintf("%s_%s_%s_%s_%s.jpg", userID.String(), projectIDStr, timestamp, field, action)
				objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
				url, err := s.uploadBase64(base64Str, objectName)
				if err != nil {
					return "", fmt.Errorf("failed to upload %s: %w", field, err)
				}
				finalURL = url
			} else if photosArray, ok := val.([]interface{}); ok && len(photosArray) > 0 {
				urls := []string{}
				for i, photo := range photosArray {
					if base64Str, ok := photo.(string); ok && base64Str != "" {
						filename := fmt.Sprintf("%s_%s_%s_%s_%d_%s.jpg", userID.String(), projectIDStr, timestamp, field, i, action)
						objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
						url, err := s.uploadBase64(base64Str, objectName)
						if err != nil {
							return "", fmt.Errorf("failed to upload %s[%d]: %w", field, i, err)
						}
						urls = append(urls, url)
					}
				}
				if len(urls) > 0 {
					jsonBytes, _ := json.Marshal(urls)
					finalURL = string(jsonBytes)
				}
			}
		}
		return finalURL, nil
	}

	// Upload all photos for audit, but collect them all into a map for DB storage
	fields := []string{"personnel_photo", "id_card_front", "id_card_back", "safety_card_front", "safety_card_back", "tools_photos", "documents_photos"}
	photoURLs := make(map[string]string)
	for _, field := range fields {
		url, err := processPhotoField(field, "checkout")
		if err != nil {
			return nil, err
		}
		if url != "" {
			photoURLs[field] = url
		}
	}

	// Update Attendance Struct with Checkout Image URL and Address
	// We want to combine all checkout photos into a single JSON object stored in CheckoutImgURL
	if len(photoURLs) > 0 {
		jsonBytes, err := json.Marshal(photoURLs)
		if err == nil {
			attendance.CheckoutImgURL = string(jsonBytes)
		} else {
			// Fallback if marshal fails (unlikely), just save personnel photo if available
			attendance.CheckoutImgURL = photoURLs["personnel_photo"]
		}
	}

	if address != "" {
		attendance.AddressCheckout = address
	}
	// -----------------------------------------------------

	// Request checkout in Repo
	if err := s.repo.RequestCheckout(attendance); err != nil {
		return nil, err
	}


	return attendance, nil
}

// ApproveCheckout allows manager to approve checkout request
func (s *AttendanceService) ApproveCheckout(attendanceID, managerID uuid.UUID) (*domain.Attendance, error) {
	// Get attendance record
	attendance, err := s.repo.GetAttendanceByID(attendanceID)
	if err != nil {
		return nil, fmt.Errorf("attendance record not found")
	}

	// Check if checkout was requested
	if !attendance.CheckoutRequested {
		return nil, fmt.Errorf("no checkout request found")
	}

	// Set approval fields
	attendance.CheckoutApprovedBy = &managerID

	// Approve checkout
	if err := s.repo.ApproveCheckout(attendance); err != nil {
		return nil, err
	}


	return attendance, nil
}

// RejectCheckout allows manager to reject checkout request
func (s *AttendanceService) RejectCheckout(attendanceID, managerID uuid.UUID, reason string) (*domain.Attendance, error) {
	// Get attendance record
	attendance, err := s.repo.GetAttendanceByID(attendanceID)
	if err != nil {
		return nil, fmt.Errorf("attendance record not found")
	}

	// Check if checkout was requested
	if !attendance.CheckoutRequested {
		return nil, fmt.Errorf("no checkout request found")
	}

	// Set rejection reason
	attendance.CheckoutRejectReason = reason

	// Reject checkout
	if err := s.repo.RejectCheckout(attendance); err != nil {
		return nil, err
	}


	return attendance, nil
}

// GetPendingCheckoutRequests gets pending checkout requests for a manager (filtered by their staff)
func (s *AttendanceService) GetPendingCheckoutRequests(managerID *uuid.UUID) ([]domain.Attendance, error) {
	return s.repo.GetPendingCheckoutRequests(managerID)
}

// GetTodayAttendance gets today's attendance for a user
func (s *AttendanceService) GetTodayAttendance(userID uuid.UUID) (*domain.Attendance, error) {
	return s.repo.GetTodayAttendance(userID)
}

// GetTodayAttendanceByAssign gets today's attendance for a user filtered by assign
func (s *AttendanceService) GetTodayAttendanceByAssign(userID uuid.UUID, assignID *uuid.UUID) (*domain.Attendance, error) {
	return s.repo.GetTodayAttendanceByAssign(userID, assignID)
}

// GetUserHistory gets attendance history for a user
func (s *AttendanceService) GetUserHistory(userID uuid.UUID, limit int) ([]domain.Attendance, error) {
	return s.repo.GetUserAttendanceHistory(userID, limit)
}

// GetAllTodayAttendances gets all today's attendances (for managers)
func (s *AttendanceService) GetAllTodayAttendances() ([]domain.Attendance, error) {
	return s.repo.GetAllTodayAttendances()
}

// GetUsersOnSite gets all users currently on site
func (s *AttendanceService) GetUsersOnSite() ([]domain.Attendance, error) {
	return s.repo.GetUsersOnSite()
}

// GetAllAttendanceHistory gets all attendance records for managers
func (s *AttendanceService) GetAllAttendanceHistory(limit int) ([]domain.Attendance, error) {
	return s.repo.GetAllAttendanceHistory(limit)
}

// GetByAssignAndDates returns attendances for a specific assign on a set of dates (for report generation)
func (s *AttendanceService) GetByAssignAndDates(assignID uuid.UUID, dates []string) ([]domain.Attendance, error) {
	return s.repo.GetAttendanceByAssignAndDates(assignID, dates)
}

