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
	repo         *postgres.AttendanceRepository
	minioClient  *storage.MinioClient
	Notification *NotificationService
}

func NewAttendanceService(repo *postgres.AttendanceRepository, minioClient *storage.MinioClient, notif *NotificationService) *AttendanceService {
	return &AttendanceService{
		repo:         repo,
		minioClient:  minioClient,
		Notification: notif,
	}
}

// CheckInWithPhotos handles user check-in with photos
func (s *AttendanceService) CheckInWithPhotos(userID uuid.UUID, projectID *uuid.UUID, photos map[string]interface{}, address string) (*domain.Attendance, error) {
	now := time.Now()
	year := now.Year()
	quarter := (now.Month()-1)/3 + 1
	timestamp := now.Format("20060102_150405")
	
	// Project for filename and path
	projectIDStr := "unknown"
	projectName := "unknown"
	if projectID != nil {
		projectIDStr = projectID.String()
		projectName = s.repo.GetProjectName(*projectID)
	}

	// Create base path: YYYY/Qxx/{ProjectName}/Checkin
	basePath := fmt.Sprintf("%d/Q%d/%s/Checkin", year, quarter, projectName)
	
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
	singlePhotoFields := []string{"id_card_front", "id_card_back", "safety_card_front", "safety_card_back"}
	
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

	// Handle Personnel Photo (Can be Single or Array)
	var personnelPhotoURL string
	if val, ok := photos["personnel_photo"]; ok {
		// Case 1: Single String
		if base64Str, ok := val.(string); ok && base64Str != "" {
			category := categoryMap["personnel_photo"]
			filename := fmt.Sprintf("%s_%s_%s_checkin.jpg", userID.String(), projectIDStr, timestamp)
			objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
			url, err := s.uploadBase64(base64Str, objectName)
			if err != nil {
				return nil, fmt.Errorf("failed to upload personnel_photo: %w", err)
			}
			personnelPhotoURL = url
		} else if photosArray, ok := val.([]interface{}); ok && len(photosArray) > 0 {
			// Case 2: Array of Strings
			urls := []string{}
			category := categoryMap["personnel_photo"]
			for i, photo := range photosArray {
				if base64Str, ok := photo.(string); ok && base64Str != "" {
					filename := fmt.Sprintf("%s_%s_%s_%d_checkin.jpg", userID.String(), projectIDStr, timestamp, i)
					objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
					url, err := s.uploadBase64(base64Str, objectName)
					if err != nil {
						return nil, fmt.Errorf("failed to upload personnel_photo[%d]: %w", i, err)
					}
					urls = append(urls, url)
				}
			}
			if len(urls) > 0 {
				// Serialize to JSON for storage
				jsonBytes, _ := json.Marshal(urls)
				personnelPhotoURL = string(jsonBytes)
			}
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
	attendance, err := s.repo.CheckIn(userID, projectID, address)
	if err != nil {
		return nil, err
	}
	
	// Update photo URLs
	attendance.PersonnelPhoto = personnelPhotoURL
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
    
    // NOTIFICATION
    if s.Notification != nil {
        go func() {
             var u domain.User
             if err := s.Notification.DB.First(&u, "id = ?", userID).Error; err == nil {
                 msg := fmt.Sprintf("%s đã chấm công vào làm tại %s", u.FullName, address)
                 meta := map[string]interface{}{
                     "type": "checkin",
                     "attendance_id": attendance.ID.String(),
                     "personnel_photo": attendance.PersonnelPhoto, // Sends First Image or JSON string (notification handler might need update to safe parse)
                 }
                 s.Notification.NotifyManagers("Chấm công (Vào) 🕒", msg, meta)
             }
        }()
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
func (s *AttendanceService) CheckIn(userID uuid.UUID, projectID *uuid.UUID) (*domain.Attendance, error) {
	return s.repo.CheckIn(userID, projectID, "")
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
	quarter := (now.Month()-1)/3 + 1
	timestamp := now.Format("20060102_150405")

	// Project string
	projectIDStr := "unknown"
	projectName := "unknown"
	if attendance.IDProject != nil {
		projectIDStr = attendance.IDProject.String()
		projectName = s.repo.GetProjectName(*attendance.IDProject)
	}

	// Base path: YYYY/Qx/{ProjectName}/Checkout
	basePath := fmt.Sprintf("%d/Q%d/%s/Checkout", year, quarter, projectName)

	// Field mapping
	categoryMap := map[string]string{
		"personnel_photo":    "personnel",
		"id_card_front":      "CCCD",
		"id_card_back":       "CCCD",
		"safety_card_front":  "ATLD",
		"safety_card_back":   "ATLD",
		"tools_photos":       "Tool",
		"documents_photos":   "Record",
	}

	photoURLs := make(map[string]string)
	singlePhotoFields := []string{"id_card_front", "id_card_back", "safety_card_front", "safety_card_back"}
	
	for _, field := range singlePhotoFields {
		if base64Str, ok := photos[field].(string); ok && base64Str != "" {
			category := categoryMap[field]
			// Filename: <userid>_<projectid>_<timestamp>_checkout.jpg
			filename := fmt.Sprintf("%s_%s_%s_checkout.jpg", userID.String(), projectIDStr, timestamp)
			objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
			
			url, err := s.uploadBase64(base64Str, objectName)
			if err != nil {
				// Log error but proceed? Or fail? Fail is better contextually.
				return nil, fmt.Errorf("failed to upload %s: %w", field, err)
			}
			photoURLs[field] = url
		}
	}
	
	// Handle Personnel Photo (Checkout Image) - Can be Single or Array
	var checkoutImgURL string
	if val, ok := photos["personnel_photo"]; ok {
		if base64Str, ok := val.(string); ok && base64Str != "" {
			category := categoryMap["personnel_photo"]
			filename := fmt.Sprintf("%s_%s_%s_checkout.jpg", userID.String(), projectIDStr, timestamp)
			objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
			url, err := s.uploadBase64(base64Str, objectName)
			if err != nil {
				return nil, fmt.Errorf("failed to upload personnel_photo: %w", err)
			}
			checkoutImgURL = url
		} else if photosArray, ok := val.([]interface{}); ok && len(photosArray) > 0 {
			urls := []string{}
			category := categoryMap["personnel_photo"]
			for i, photo := range photosArray {
				if base64Str, ok := photo.(string); ok && base64Str != "" {
					filename := fmt.Sprintf("%s_%s_%s_%d_checkout.jpg", userID.String(), projectIDStr, timestamp, i)
					objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
					url, err := s.uploadBase64(base64Str, objectName)
					if err != nil {
						return nil, fmt.Errorf("failed to upload personnel_photo[%d]: %w", i, err)
					}
					urls = append(urls, url)
				}
			}
			if len(urls) > 0 {
				jsonBytes, _ := json.Marshal(urls)
				checkoutImgURL = string(jsonBytes)
			}
		}
	}

	// Handle Array Photos (Tools, Docs) - Uploading them for audit even if not saving to DB cols (yet)
	arrayPhotoFields := []string{"tools_photos", "documents_photos"}
	for _, field := range arrayPhotoFields {
		if photosArray, ok := photos[field].([]interface{}); ok && len(photosArray) > 0 {
			category := categoryMap[field]
			for i, photo := range photosArray {
				if base64Str, ok := photo.(string); ok && base64Str != "" {
					filename := fmt.Sprintf("%s_%s_%s_%d_checkout.jpg", userID.String(), projectIDStr, timestamp, i)
					objectName := fmt.Sprintf("%s/%s/%s", basePath, category, filename)
					_, err := s.uploadBase64(base64Str, objectName)
					if err != nil {
						return nil, fmt.Errorf("failed to upload %s[%d]: %w", field, i, err)
					}
				}
			}
		}
	}

	// Update Attendance Struct with Checkout Image URL and Address
	if checkoutImgURL != "" {
		attendance.CheckoutImgURL = checkoutImgURL
	}
	if address != "" {
		attendance.AddressCheckout = address
	}
	// -----------------------------------------------------

	// Request checkout in Repo
	if err := s.repo.RequestCheckout(attendance); err != nil {
		return nil, err
	}
    
    // NOTIFICATION
    if s.Notification != nil {
        go func() {
             var u domain.User
             if err := s.Notification.DB.First(&u, "id = ?", userID).Error; err == nil {
                 msg := fmt.Sprintf("%s yêu cầu Checkout tại %s", u.FullName, address)
                 meta := map[string]interface{}{
                     "type": "checkout_request",
                     "attendance_id": attendance.ID.String(),
                     "checkout_img_url": attendance.CheckoutImgURL,
                     "personnel_photo": attendance.PersonnelPhoto,
                 }
                 s.Notification.NotifyManagers("Yêu cầu Checkout 🚪", msg, meta)
             }
        }()
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

    // NOTIFICATION
    if s.Notification != nil {
        s.Notification.NotifyCheckoutStatus(attendance.IDUser, true, "", attendance.ID, attendance.PersonnelPhoto, attendance.CheckoutImgURL)
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

    // NOTIFICATION
    if s.Notification != nil {
        s.Notification.NotifyCheckoutStatus(attendance.IDUser, false, reason, attendance.ID, attendance.PersonnelPhoto, attendance.CheckoutImgURL)
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
