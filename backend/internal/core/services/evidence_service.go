package services

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"gorm.io/gorm"
)

type EvidenceService struct {
	DB           *gorm.DB
	MinioClient  *storage.MinioClient
	Notification *NotificationService
}

func NewEvidenceService(db *gorm.DB, minioClient *storage.MinioClient, notification *NotificationService) *EvidenceService {
	return &EvidenceService{
		DB:           db,
		MinioClient:  minioClient,
		Notification: notification,
	}
}

// GetDetailEvidence retrieves the image URLs stored in a DetailAssign's data field
func (s *EvidenceService) GetDetailEvidence(detailID uuid.UUID) ([]string, error) {
	var detail domain.DetailAssign
	if err := s.DB.Where("id = ? AND deleted_at IS NULL", detailID).First(&detail).Error; err != nil {
		return nil, fmt.Errorf("detail not found")
	}

	if len(detail.Data) == 0 {
		return []string{}, nil
	}
	var urls []string
	if err := json.Unmarshal(detail.Data, &urls); err != nil {
		return []string{}, nil
	}
	return urls, nil
}

// UploadDetailEvidence uploads a file to MinIO and returns the URL
func (s *EvidenceService) UploadDetailEvidence(detailID uuid.UUID, fileContent []byte, originalFilename, contentType string) (string, error) {
	var detail domain.DetailAssign
	if err := s.DB.Where("id = ? AND deleted_at IS NULL", detailID).First(&detail).Error; err != nil {
		return "", fmt.Errorf("detail not found")
	}

	if s.MinioClient == nil {
		return "", fmt.Errorf("minio unavailable")
	}

	fileUUID := uuid.New().String()
	ext := getExtension(originalFilename)
	objectPath := fmt.Sprintf("evidence/%s/%s%s", detailID.String(), fileUUID, ext)

	urlStr, err := s.MinioClient.UploadBytes(fileContent, objectPath, contentType)
	if err != nil {
		return "", err
	}

	// Append to existing urls
	var urls []string
	if len(detail.Data) > 0 {
		_ = json.Unmarshal(detail.Data, &urls)
	}
	urls = append(urls, urlStr)
	newData, _ := json.Marshal(urls)

	s.DB.Model(&detail).Update("data", newData)
	return urlStr, nil
}

// DeleteEvidence removes a specific object from MinIO and updates the detail's data
func (s *EvidenceService) DeleteEvidence(detailID uuid.UUID, objectKey string) error {
	if s.MinioClient == nil {
		return fmt.Errorf("minio unavailable")
	}
	if err := s.MinioClient.RemoveObject(objectKey); err != nil {
		return err
	}

	var detail domain.DetailAssign
	if err := s.DB.Where("id = ?", detailID).First(&detail).Error; err != nil {
		return nil
	}

	var urls []string
	if len(detail.Data) > 0 {
		_ = json.Unmarshal(detail.Data, &urls)
	}

	var newURLs []string
	for _, u := range urls {
		parsed, err := url.Parse(u)
		if err == nil {
			keyParam := parsed.Query().Get("key")
			if keyParam == objectKey || strings.Contains(u, objectKey) {
				continue
			}
		}
		newURLs = append(newURLs, u)
	}

	newData, _ := json.Marshal(newURLs)
	s.DB.Model(&detail).Update("data", newData)
	return nil
}

func isImageFile(filename string) bool {
	return strings.HasSuffix(filename, ".jpg") ||
		strings.HasSuffix(filename, ".jpeg") ||
		strings.HasSuffix(filename, ".png") ||
		strings.HasSuffix(filename, ".gif") ||
		strings.HasSuffix(filename, ".webp") ||
		strings.HasSuffix(filename, ".webm")
}

func getExtension(filename string) string {
	for i := len(filename) - 1; i >= 0; i-- {
		if filename[i] == '.' {
			return filename[i:]
		}
	}
	return ""
}
