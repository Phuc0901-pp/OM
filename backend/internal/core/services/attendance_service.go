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
)

type AttendanceService struct {
	repo        *postgres.AttendanceRepository
	minioClient *storage.MinioClient
}

func NewAttendanceService(repo *postgres.AttendanceRepository, minioClient *storage.MinioClient) *AttendanceService {
	return &AttendanceService{
		repo:        repo,
		minioClient: minioClient,
	}
}

// CheckInWithPhotos handles user check-in with photos
func (s *AttendanceService) CheckInWithPhotos(userID uuid.UUID, projectID *uuid.UUID, photos map[string]interface{}) (*domain.Attendance, error) {
	now := time.Now()
	quarter := (now.Month()-1)/3 + 1
	timestamp := now.Format("20060102_150405")
	
	// Create base path: dev/Qxx/Checkin
	basePath := fmt.Sprintf("Q%d/Checkin", quarter)
	
	// Project ID for filename
	projectIDStr := "unknown"
	if projectID != nil {
		projectIDStr = projectID.String()
	}
	
	// Map field names to folder categories
	categoryMap := map[string]string{
		"personnel_photo":    "personnel",
		"id_card_front":      "CCCD",
		"id_card_back":       "CCCD",
		"safety_card_front":  "ATLD",
		"safety_card_back":   "ATLD",
		"tools_photos":       "Tool",
		"documents_photos":   "Record",
	}
	
	// Upload single photos to MinIO
	photoURLs := make(map[string]string)
	singlePhotoFields := []string{"personnel_photo", "id_card_front", "id_card_back", "safety_card_front", "safety_card_back"}
	
	for _, field := range singlePhotoFields {
		if base64Str, ok := photos[field].(string); ok && base64Str != "" {
			category := categoryMap[field]
			// Filename: <userid>_<projectid>_<timestamp>_checkin.jpg
			filename := fmt.Sprintf("%s_%s_%s_checkin.jpg", userID.String(), projectIDStr, timestamp)
			objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
			
			url, err := s.uploadBase64(base64Str, objectName)
			if err != nil {
				return nil, fmt.Errorf("failed to upload %s: %w", field, err)
			}
			photoURLs[field] = url
		}
	}
	
	// Upload array photos (tools, documents)
	arrayPhotoURLs := make(map[string][]string)
	arrayPhotoFields := []string{"tools_photos", "documents_photos"}
	
	for _, field := range arrayPhotoFields {
		if photosArray, ok := photos[field].([]interface{}); ok && len(photosArray) > 0 {
			urls := []string{}
			category := categoryMap[field]
			
			for i, photo := range photosArray {
				if base64Str, ok := photo.(string); ok && base64Str != "" {
					// Filename with index: <userid>_<projectid>_<timestamp>_<index>_checkin.jpg
					filename := fmt.Sprintf("%s_%s_%s_%d_checkin.jpg", userID.String(), projectIDStr, timestamp, i)
					objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
					
					url, err := s.uploadBase64(base64Str, objectName)
					if err != nil {
						return nil, fmt.Errorf("failed to upload %s[%d]: %w", field, i, err)
					}
					urls = append(urls, url)
				}
			}
			arrayPhotoURLs[field] = urls
		}
	}
	
	// Create or update attendance record
	attendance, err := s.repo.CheckIn(userID, projectID)
	if err != nil {
		return nil, err
	}
	
	// Update photo URLs
	attendance.PersonnelPhoto = photoURLs["personnel_photo"]
	attendance.IDCardFront = photoURLs["id_card_front"]
	attendance.IDCardBack = photoURLs["id_card_back"]
	attendance.SafetyCardFront = photoURLs["safety_card_front"]
	attendance.SafetyCardBack = photoURLs["safety_card_back"]
	
	// Encode arrays as JSON
	if urls, ok := arrayPhotoURLs["tools_photos"]; ok && len(urls) > 0 {
		jsonBytes, _ := json.Marshal(urls)
		attendance.ToolsPhotos = string(jsonBytes)
	}
	if urls, ok := arrayPhotoURLs["documents_photos"]; ok && len(urls) > 0 {
		jsonBytes, _ := json.Marshal(urls)
		attendance.DocumentsPhotos = string(jsonBytes)
	}
	
	// Save updated attendance
	if err := s.repo.UpdatePhotos(attendance); err != nil {
		return nil, err
	}
	
	return attendance, nil
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
func (s *AttendanceService) CheckIn(userID uuid.UUID, projectID *uuid.UUID) (*domain.Attendance, error) {
	return s.repo.CheckIn(userID, projectID)
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

// RequestCheckout allows user to request checkout
func (s *AttendanceService) RequestCheckout(userID uuid.UUID) (*domain.Attendance, error) {
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

	// Request checkout
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

// GetPendingCheckoutRequests gets all pending checkout requests for manager
func (s *AttendanceService) GetPendingCheckoutRequests() ([]domain.Attendance, error) {
	return s.repo.GetPendingCheckoutRequests()
}

// GetTodayAttendance gets today's attendance for a user
func (s *AttendanceService) GetTodayAttendance(userID uuid.UUID) (*domain.Attendance, error) {
	return s.repo.GetTodayAttendance(userID)
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
