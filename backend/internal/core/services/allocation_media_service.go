package services

import (
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"github.com/phuc/cmms-backend/internal/utils"
)

// AllocationMediaService handles all MinIO storage interactions for tasks.
// Extracted from allocation_handler.go to isolate the "media" responsibility.
type AllocationMediaService struct {
	detailAssignRepo domain.DetailAssignRepository
	minioClient      *storage.MinioClient // Shared connection — avoids re-dialing MinIO per request
}

// NewAllocationMediaService creates the service and pre-warms the MinIO connection at startup.
// If MinIO is unavailable at startup, uploads will fail gracefully with a clear error per request.
func NewAllocationMediaService(detailAssignRepo domain.DetailAssignRepository) *AllocationMediaService {
	mc, err := storage.NewMinioClient()
	if err != nil {
		fmt.Printf("[MediaService] WARNING: Could not pre-warm MinIO connection: %v\n", err)
		mc = nil
	}
	return &AllocationMediaService{
		detailAssignRepo: detailAssignRepo,
		minioClient:      mc,
	}
}

// getMinioClient returns the cached client or attempts a fresh connection.
func (s *AllocationMediaService) getMinioClient() (*storage.MinioClient, error) {
	if s.minioClient != nil {
		return s.minioClient, nil
	}
	mc, err := storage.NewMinioClient()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to object storage: %w", err)
	}
	s.minioClient = mc
	return mc, nil
}

// BuildMinioFolderPrefix constructs the standardized MinIO folder prefix for a detail task.
// Format: <Project>/<Year>/<MM-YYYY>/<ModelProject>/<Template>/<Work>/<SubWork>/<Asset>/<Process>
func (s *AllocationMediaService) BuildMinioFolderPrefix(detailAssignID uuid.UUID, t time.Time) (string, *domain.MinioPathContext, error) {
	ctxNames, err := s.detailAssignRepo.GetNamesForMinioPath(detailAssignID)
	if err != nil {
		return "", nil, fmt.Errorf("failed to get path context: %w", err)
	}

	yearStr := t.Format("2006")
	monthYearStr := t.Format("01-2006")

	var assetSeg string
	if ctxNames.ParentAssetName != "" {
		assetSeg = utils.SlugifyName(ctxNames.ParentAssetName) + "/" + utils.SlugifyName(ctxNames.AssetName)
	} else {
		assetSeg = utils.SlugifyName(ctxNames.AssetName)
	}

	prefix := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/%s",
		utils.SlugifyName(ctxNames.ProjectName),
		yearStr,
		monthYearStr,
		utils.SlugifyName(ctxNames.ModelProjectName),
		utils.SlugifyName(ctxNames.TemplateName),
		utils.SlugifyName(ctxNames.WorkName),
		utils.SlugifyName(ctxNames.SubWorkName),
		assetSeg,
		utils.SlugifyName(ctxNames.ProcessName),
	)

	return prefix, ctxNames, nil
}

// BuildMinioObjectPath constructs the full MinIO object path (folder/file) for an upload.
func (s *AllocationMediaService) BuildMinioObjectPath(detailAssignID uuid.UUID, filename string, ext string, t time.Time) (string, error) {
	prefix, _, err := s.BuildMinioFolderPrefix(detailAssignID, t)
	if err != nil {
		return "", err
	}
	uploadedName := strings.TrimSuffix(filename, ext)
	if uploadedName == "" {
		uploadedName = uuid.New().String()
	}
	return fmt.Sprintf("%s/%s%s", prefix, uploadedName, ext), nil
}

// UploadDetailFile validates file type, streams directly to MinIO without buffering into RAM.
// Returns (publicURL, objectPath, error).
//
// PERFORMANCE: Uses UploadStream (io.Reader → MinIO PutObject) instead of io.ReadAll,
// eliminating the peak RAM spike of (file size × concurrent uploads) on the server.
func (s *AllocationMediaService) UploadDetailFile(detailAssignID uuid.UUID, filename string, file io.Reader, fileSize int64) (string, string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	allowedExts := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".mp4":  "video/mp4",
		".webm": "video/webm",
	}
	contentType, ok := allowedExts[ext]
	if !ok {
		return "", "", fmt.Errorf("unsupported file format: %s", ext)
	}

	objectPath, err := s.BuildMinioObjectPath(detailAssignID, filename, ext, time.Now())
	if err != nil {
		return "", "", err
	}

	mc, err := s.getMinioClient()
	if err != nil {
		return "", "", err
	}

	// Stream directly — no io.ReadAll, no peak RAM buffering
	url, err := mc.UploadStream(file, fileSize, objectPath, contentType)
	if err != nil {
		return "", "", fmt.Errorf("failed to stream upload to MinIO: %w", err)
	}

	return url, objectPath, nil
}

// GetMinioURL returns the exact final public URL for a given MinIO object path.
// This is used by the async pipeline to predict the URL before uploading.
func (s *AllocationMediaService) GetMinioURL(objectPath string) (string, error) {
	mc, err := s.getMinioClient()
	if err != nil {
		return "", err
	}
	if mc == nil || mc.Client == nil {
		return "", fmt.Errorf("minio client not initialized")
	}
	endpointURL := mc.Client.EndpointURL()
	fullURL := fmt.Sprintf("%s/%s/%s", endpointURL.String(), mc.Bucket, objectPath)
	return fullURL, nil
}

// DeleteDetailFolder deletes all files in a task's MinIO folder. Returns the count of deleted objects.
func (s *AllocationMediaService) DeleteDetailFolder(detailAssignID uuid.UUID) (string, int, error) {
	prefix, _, err := s.BuildMinioFolderPrefix(detailAssignID, time.Now())
	if err != nil {
		return "", 0, err
	}

	mc, err := s.getMinioClient()
	if err != nil {
		return prefix, 0, err
	}

	count, err := mc.DeleteFolder(prefix)
	return prefix, count, err
}

// UploadNoteAsync uploads a note.txt file to MinIO in a background goroutine (non-blocking).
// Errors are logged but do not affect the caller.
func (s *AllocationMediaService) UploadNoteAsync(detailAssignID uuid.UUID, noteText string) {
	if noteText == "" {
		return
	}
	go func() {
		prefix, _, err := s.BuildMinioFolderPrefix(detailAssignID, time.Now())
		if err != nil {
			fmt.Printf("[NoteUpload] No path context for detail %s: %v\n", detailAssignID, err)
			return
		}

		notePath := prefix + "/note.txt"
		mc, err := s.getMinioClient()
		if err != nil {
			fmt.Printf("[NoteUpload] MinIO connect failed: %v\n", err)
			return
		}

		if _, err := mc.UploadBytes([]byte(noteText), notePath, "text/plain"); err != nil {
			fmt.Printf("[NoteUpload] Failed to upload note.txt to %s: %v\n", notePath, err)
		} else {
			fmt.Printf("[NoteUpload] Saved note.txt: %s\n", notePath)
		}
	}()
}
