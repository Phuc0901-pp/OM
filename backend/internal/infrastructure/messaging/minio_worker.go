package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
)

// ─────────────────────────────────────────────────────────────────────────────
// MinioWorker — Consumer 1 (Chiều đi: API → MinIO)
// ─────────────────────────────────────────────────────────────────────────────
// Listens to `minio_upload_queue`.
// For each UploadRequestEvent it:
//   1. Opens the staged temp file from disk.
//   2. Streams it directly to MinIO (no RAM buffering).
//   3. Deletes the temp file on success.
//   4. Publishes an ImageUploadedEvent to `image_sync_queue` (Consumer 2 / Chiều về).

type MinioWorker struct {
	conn        *amqp.Connection
	workerCount int
	minioClient *storage.MinioClient
	publisher   *Publisher // to forward to Topic 2 (Chiều về)
	stopCh      chan struct{}
}

// NewMinioWorker dials RabbitMQ and returns a MinioWorker ready to Start.
// Returns nil, nil when RABBITMQ_URL is not set (graceful no-op).
func NewMinioWorker(workerCount int, minioClient *storage.MinioClient, publisher *Publisher) (*MinioWorker, error) {
	if os.Getenv("RABBITMQ_URL") == "" {
		log.Println("[MinioWorker] RABBITMQ_URL not set — worker disabled")
		return nil, nil
	}
	if workerCount < 1 {
		workerCount = 4
	}
	conn, err := dial()
	if err != nil {
		return nil, fmt.Errorf("minio_worker: dial: %w", err)
	}
	log.Printf("[MinioWorker] Connected (%d workers)", workerCount)
	return &MinioWorker{
		conn:        conn,
		workerCount: workerCount,
		minioClient: minioClient,
		publisher:   publisher,
		stopCh:      make(chan struct{}),
	}, nil
}

// Start launches the goroutine pool listening on `minio_upload_queue`.
// Call via: go worker.Start(ctx)
func (w *MinioWorker) Start(ctx context.Context) {
	if w == nil {
		return
	}

	ch, err := w.conn.Channel()
	if err != nil {
		log.Printf("[MinioWorker] Failed to open channel: %v", err)
		return
	}
	defer ch.Close()

	if err := declareTopology(ch); err != nil {
		log.Printf("[MinioWorker] Topology declare failed: %v", err)
		return
	}

	if err := ch.Qos(w.workerCount, 0, false); err != nil {
		log.Printf("[MinioWorker] Qos failed: %v", err)
		return
	}

	deliveries, err := ch.Consume(
		uploadRequestQueue,
		"",    // auto-generated consumer tag
		false, // manual ack
		false, false, false, nil,
	)
	if err != nil {
		log.Printf("[MinioWorker] Consume failed: %v", err)
		return
	}

	sem := make(chan struct{}, w.workerCount)
	log.Printf("[MinioWorker] Listening on '%s' with %d workers", uploadRequestQueue, w.workerCount)

	for {
		select {
		case <-ctx.Done():
			log.Println("[MinioWorker] Context cancelled — shutting down")
			return
		case <-w.stopCh:
			log.Println("[MinioWorker] Stop signal — shutting down")
			return
		case msg, ok := <-deliveries:
			if !ok {
				log.Println("[MinioWorker] Delivery channel closed")
				return
			}
			sem <- struct{}{}
			go func(d amqp.Delivery) {
				defer func() { <-sem }()
				w.handleMessage(d)
			}(msg)
		}
	}
}

// Stop signals the worker to exit cleanly.
func (w *MinioWorker) Stop() {
	if w == nil {
		return
	}
	close(w.stopCh)
	if w.conn != nil {
		w.conn.Close()
	}
}

// handleMessage processes a single upload request:
//  1. Deserialise UploadRequestEvent.
//  2. Stream temp file → MinIO.
//  3. Delete temp file.
//  4. Publish ImageUploadedEvent → Consumer 2 (Chiều về).
func (w *MinioWorker) handleMessage(d amqp.Delivery) {
	var event UploadRequestEvent
	if err := json.Unmarshal(d.Body, &event); err != nil {
		log.Printf("[MinioWorker] Bad message (NACK, no-requeue): %v", err)
		d.Nack(false, false)
		return
	}

	log.Printf("[MinioWorker] Processing upload.request: detail=%s file=%s", event.DetailAssignID, event.Filename)

	if err := w.processUpload(event); err != nil {
		if strings.HasPrefix(err.Error(), "POISON_FILE_MISSING:") {
			log.Printf("[MinioWorker] File permanently lost for detail=%s: %v — NACK (drop, no requeue)", event.DetailAssignID, err)
			d.Nack(false, false) // Drop poison message
			return
		}
		log.Printf("[MinioWorker] Upload failed for detail=%s: %v — NACK (requeue)", event.DetailAssignID, err)
		d.Nack(false, true) // Network issue -> requeue for retry
		return
	}

	log.Printf("[MinioWorker] ACK upload.request for detail=%s", event.DetailAssignID)
	d.Ack(false)
}

// processUpload streams the staged file to MinIO then forwards to Topic 2.
func (w *MinioWorker) processUpload(event UploadRequestEvent) error {
	// 1. Open staged temp file
	f, err := os.Open(event.TempPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("POISON_FILE_MISSING: %w", err)
		}
		return fmt.Errorf("open temp file %s: %w", event.TempPath, err)
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return fmt.Errorf("stat temp file: %w", err)
	}

	// Resolve MIME type (use stored value if available, else detect from ext)
	contentType := event.MimeType
	if contentType == "" {
		ext := filepath.Ext(event.Filename)
		contentType = mime.TypeByExtension(ext)
		if contentType == "" {
			contentType = "application/octet-stream"
		}
	}

	// 2. Stream to MinIO
	mc := w.minioClient
	if mc == nil {
		var dialErr error
		mc, dialErr = storage.NewMinioClient()
		if dialErr != nil {
			return fmt.Errorf("connect MinIO: %w", dialErr)
		}
	}

	minioURL, err := mc.UploadStream(f, fi.Size(), event.ObjectPath, contentType)
	if err != nil {
		return fmt.Errorf("upload to MinIO: %w", err)
	}

	log.Printf("[MinioWorker] Uploaded to MinIO: %s → %s", event.TempPath, minioURL)

	// 3. Delete temp file (best-effort — don't fail the pipeline if cleanup fails)
	if removeErr := os.Remove(event.TempPath); removeErr != nil {
		log.Printf("[MinioWorker] WARN: failed to clean up temp file %s: %v", event.TempPath, removeErr)
	}

	// 4. Publish to Topic 2 (Chiều về: MinIO → Postgres)
	if w.publisher != nil {
		dbEvent := ImageUploadedEvent{
			DetailAssignID: event.DetailAssignID,
			MinioURL:       minioURL,
			ObjectPath:     event.ObjectPath,
			Filename:       event.Filename,
			MimeType:       contentType,
			FileSizeBytes:  fi.Size(),
			UploadedAt:     time.Now(),
		}
		if pubErr := w.publisher.Publish(dbEvent); pubErr != nil {
			// Non-fatal: log and continue (URL is already in MinIO, can be recovered)
			log.Printf("[MinioWorker] WARN: failed to publish image.uploaded for detail=%s: %v", event.DetailAssignID, pubErr)
		}
	}

	return nil
}
