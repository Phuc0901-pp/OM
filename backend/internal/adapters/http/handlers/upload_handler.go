package handlers

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
)

type UploadHandler struct {
	MinioClient *storage.MinioClient
}

func NewUploadHandler(minioClient *storage.MinioClient) *UploadHandler {
	return &UploadHandler{MinioClient: minioClient}
}

// POST /upload/guideline
// Form fields: file (multipart), project_id, work_id, sub_work_id, asset_id
func (h *UploadHandler) UploadGuideline(c *gin.Context) {
	// Parse form fields
	projectID := c.PostForm("project_id")
	workID := c.PostForm("work_id")
	subWorkID := c.PostForm("sub_work_id")
	assetID := c.PostForm("asset_id")

	if projectID == "" || workID == "" || subWorkID == "" || assetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id, work_id, sub_work_id, asset_id are required"})
		return
	}

	// Get file from form
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	// Validate extension
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	allowedExts := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
	}
	contentType, ok := allowedExts[ext]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only .jpg, .jpeg, .png files are allowed"})
		return
	}

	// Read file bytes
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// Build ordered UUID filename and object path
	// Pattern: GuideLine/{project_id}/{work_id}/{sub_work_id}/{asset_id}/{uuid}{ext}
	fileID := uuid.New().String()
	objectName := fmt.Sprintf("GuideLine/%s/%s/%s/%s/%s%s",
		projectID, workID, subWorkID, assetID, fileID, ext)

	// Upload to MinIO
	url, err := h.MinioClient.UploadBytes(data, objectName, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Upload failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":         url,
		"object_name": objectName,
	})
}
