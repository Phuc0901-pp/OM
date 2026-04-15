package handlers

import (
	"archive/zip"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
	"golang.org/x/text/unicode/norm"
)

type MediaHandler struct {
	MinioClient *storage.MinioClient
}

func NewMediaHandler(minioClient *storage.MinioClient) *MediaHandler {
	return &MediaHandler{
		MinioClient: minioClient,
	}
}

// GetLibraryImages returns a list of all images in the MinIO bucket
// @Summary      Get Image Library
// @Description  Get list of all images available in MinIO storage
// @Tags         media
// @Accept       json
// @Produce      json
// @Success      200  {array}   string
// @Router       /media/library [get]
func (h *MediaHandler) GetLibraryImages(c *gin.Context) {
	// List all objects. You might want to filter by prefix like "library/" or rely on all objects.
	// For now, listing everything or a specific folder if user requested.
	// User just said "connect to minio to sync library".

	// List all objects. Return raw keys so frontend can build folder structure.
	// Presigned URLs expire and are too long for tree building.
	// Frontend will request proxy/download using the key.

	urls, err := h.MinioClient.ListObjectKeys("")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list images"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": urls})
}

// ProxyImage streams an image from MinIO via the backend
// @Summary      Proxy Image
// @Description  Stream image from MinIO by key
// @Tags         media
// @Param        key  query     string  true  "Object Key"
// @Success      200  {file}    binary
// @Router       /media/proxy [get]
func (h *MediaHandler) ProxyImage(c *gin.Context) {
	key := c.Query("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Key is required"})
		return
	}

	// URL decode the key in case it was double-encoded
	decodedKey, err := url.QueryUnescape(key)
	if err != nil {
		log.Printf("[ProxyImage] Failed to decode key: %v, using original", err)
		decodedKey = key
	}

	log.Printf("[ProxyImage] Original key: %s", key)
	log.Printf("[ProxyImage] Decoded key: %s", decodedKey)

	// Fetch object from MinIO using decoded key
	content, err := h.MinioClient.GetObject(decodedKey)
	if err != nil {
		// Try with original key as fallback
		log.Printf("[ProxyImage] Trying original key as fallback")
		content, err = h.MinioClient.GetObject(key)
		if err != nil {
			// Try Unicode Normalization Fallbacks (NFC and NFD)
			// Vietnamese characters can be represented differently (e.g., 'á' vs 'a' + '´')
			
			// 1. Try NFC
			nfcKey := norm.NFC.String(decodedKey)
			if nfcKey != decodedKey {
				log.Printf("[ProxyImage] Trying NFC key: %s", nfcKey)
				content, err = h.MinioClient.GetObject(nfcKey)
			}

			// 2. Try NFD (if NFC failed or was same)
			if err != nil {
				nfdKey := norm.NFD.String(decodedKey)
				if nfdKey != decodedKey && nfdKey != nfcKey {
					log.Printf("[ProxyImage] Trying NFD key: %s", nfdKey)
					content, err = h.MinioClient.GetObject(nfdKey)
				}
			}

			// ── SMART PROXY FALLBACK (Local Staging) ──────────────────────────
			// If all MinIO variations failed, check if the file is still in the local async queue
			if err != nil {
				stageDir := os.Getenv("UPLOAD_STAGE_DIR")
				if stageDir == "" {
					stageDir = "/tmp/om_uploads"
				}
				b64Key := base64.URLEncoding.EncodeToString([]byte(decodedKey))
				ext := filepath.Ext(decodedKey)
				stagedPath := filepath.Join(stageDir, b64Key+ext)

				if stagedContent, readErr := os.ReadFile(stagedPath); readErr == nil {
					log.Printf("[ProxyImage] Serving from staged file directly: %s", stagedPath)
					content = stagedContent
					err = nil // Successfully recovered from local staging
				} else {
					log.Printf("ProxyImage Error: MinIO %v, Local fallback (%s) failed: %v", err, stagedPath, readErr)
					
					// DEBUG: List files in parent directory to see what's actually there
					parentDir := filepath.Dir(decodedKey)
					if parentDir == "." { parentDir = "" } // Root
					log.Printf("[ProxyImage] Debug: Listing files in parent dir: %s", parentDir)
					
					listPrefix := filepath.ToSlash(parentDir)
					if listPrefix != "" && !strings.HasSuffix(listPrefix, "/") {
						listPrefix += "/"
					}
					
					if objects, listErr := h.MinioClient.ListObjectKeys(listPrefix); listErr == nil {
						log.Printf("[ProxyImage] Debug: Found %d objects in %s:", len(objects), listPrefix)
						for _, obj := range objects {
							log.Printf("  - %s (hex: %x)", obj, obj)
						}
					}

					c.JSON(http.StatusNotFound, gin.H{"error": "Image not found"})
					return
				}
			}
		}
	}

	// Determine content type
	ext := strings.ToLower(filepath.Ext(decodedKey))
	contentType := mime.TypeByExtension(ext)

	log.Printf("[ProxyImage] Request Key: %s | Ext: %s | Size: %d bytes | DetectedType: %s", decodedKey, ext, len(content), contentType)
	if contentType == "" {
		// Fallback to detection
		if len(content) > 512 {
			contentType = http.DetectContentType(content[:512])
		} else {
			contentType = "application/octet-stream"
		}
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Length", fmt.Sprintf("%d", len(content)))
	c.Header("Cache-Control", "public, max-age=31536000") // Cache for 1 year
	c.Header("Content-Disposition", "inline")

	c.Data(http.StatusOK, contentType, content)
}

// DeleteFolder removes all objects under a prefix in MinIO
// @Summary      Delete Folder
// @Description  Delete all objects under the given prefix (folder) from MinIO storage
// @Tags         media
// @Param        prefix  query     string  true  "Folder Prefix (e.g., canon-1/)"
// @Success      200  {object}  map[string]interface{}
// @Router       /media/folder [delete]
func (h *MediaHandler) DeleteFolder(c *gin.Context) {
	prefix := c.Query("prefix")
	if prefix == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prefix is required"})
		return
	}

	// Safety guard: reject suspiciously short / root prefixes to prevent wiping everything
	if len(strings.TrimSpace(strings.TrimSuffix(prefix, "/"))) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prefix too short — refusing to delete root-level objects"})
		return
	}

	log.Printf("[DeleteFolder] Deleting all objects under prefix: %s", prefix)

	count, err := h.MinioClient.DeleteFolder(prefix)
	if err != nil {
		log.Printf("[DeleteFolder] Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete folder", "detail": err.Error()})
		return
	}

	log.Printf("[DeleteFolder] Deleted %d objects under prefix: %s", count, prefix)
	c.JSON(http.StatusOK, gin.H{
		"message": "Folder deleted successfully",
		"prefix":  prefix,
		"deleted": count,
	})
}

// DownloadFolder zips and downloads a folder from MinIO
// @Summary      Download Folder as Zip
// @Description  Download a folder from MinIO as a Zip archive
// @Tags         media
// @Param        prefix  query     string  true  "Folder Prefix (e.g., 2026/Q1/ProjectA/)"
// @Success      200  {file}    binary
// @Router       /media/download-zip [get]
func (h *MediaHandler) DownloadFolder(c *gin.Context) {
	prefix := c.Query("prefix")
	if prefix == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prefix is required"})
		return
	}

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", filepath.Base(filepath.Clean(prefix))))

	// Create Zip Writer writing to ResponseWriter
	zipWriter := zip.NewWriter(c.Writer)
	defer zipWriter.Close()

	// List objects
	keys, err := h.MinioClient.ListObjectKeys(prefix)
	if err != nil {
		log.Printf("[DownloadZip] List keys failed: %v", err)
		return
	}

	for _, key := range keys {
		// Skip directory markers
		if strings.HasSuffix(key, "/") {
			continue
		}

		// Get Object Stream
		object, err := h.MinioClient.GetObjectStream(key)
		if err != nil {
			log.Printf("[DownloadZip] Failed to get object stream %s: %v", key, err)
			continue
		}
		
		// Get Info for Header (Size, ModTime)
		stat, err := object.Stat()
		if err != nil {
			log.Printf("[DownloadZip] Object stat failed %s: %v", key, err)
			object.Close()
			continue
		}

		// Determine relative path for zip
		relPath := key
		if strings.HasPrefix(key, prefix) {
			relPath = strings.TrimPrefix(key, prefix)
		}
		relPath = strings.TrimPrefix(relPath, "/")

		// Create Header
		// Use manual header creation since minio.ObjectInfo doesn't implement fs.FileInfo
		header := &zip.FileHeader{
			Name:   relPath,
			Method: zip.Deflate,
		}

		// Set modification time
		header.SetModTime(stat.LastModified)

		f, err := zipWriter.CreateHeader(header)
		if err != nil {
			log.Printf("[DownloadZip] Zip Create failed: %v", err)
			object.Close()
			continue
		}

		// Stream content
		if _, err := io.Copy(f, object); err != nil {
			log.Printf("[DownloadZip] Zip Copy failed: %v", err)
		}
		
		object.Close()
	}
}
