package messaging

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// ─────────────────────────────────────────────────────────────────────────────
// Message types
// ─────────────────────────────────────────────────────────────────────────────

// ImageUploadedEvent is published to RabbitMQ after a file is successfully
// stored in MinIO. The Consumer then writes it to PostgreSQL.
// Topic 2 (Chiều về): MinIO → Postgres
type ImageUploadedEvent struct {
	DetailAssignID string    `json:"detail_assign_id"`
	MinioURL       string    `json:"minio_url"`
	ObjectPath     string    `json:"object_path"`
	Filename       string    `json:"filename"`
	MimeType       string    `json:"mime_type"`
	FileSizeBytes  int64     `json:"file_size_bytes"`
	UploadedAt     time.Time `json:"uploaded_at"`
}

// UploadRequestEvent is published to RabbitMQ when a client uploads an image.
// It instructs the MinIO Worker to pick up the staged file and push it to MinIO.
// Topic 1 (Chiều đi): API → MinIO
type UploadRequestEvent struct {
	DetailAssignID string    `json:"detail_assign_id"`
	TempPath       string    `json:"temp_path"`        // Absolute path on server disk
	ObjectPath     string    `json:"object_path"`      // Target path inside MinIO bucket
	Filename       string    `json:"filename"`
	MimeType       string    `json:"mime_type"`
	FileSizeBytes  int64     `json:"file_size_bytes"`
	QueuedAt       time.Time `json:"queued_at"`
}

// ─────────────────────────────────────────────────────────────────────────────
// RabbitMQ topology constants
// ─────────────────────────────────────────────────────────────────────────────

const (
	// Topic 2 (Chiều về): MinIO → Postgres
	exchangeName = "om.media"
	routingKey   = "image.uploaded"
	queueName    = "image_sync_queue"
	dlxName      = "om.media.dlx"
	dlqName      = "image_sync_dlq"

	// Topic 1 (Chiều đi): API → MinIO
	uploadRequestExchange = "om.media.upload"
	uploadRequestKey      = "upload.request"
	uploadRequestQueue    = "minio_upload_queue"
	uploadRequestDlqName  = "minio_upload_dlq"
)

// ─────────────────────────────────────────────────────────────────────────────
// Connection helper
// ─────────────────────────────────────────────────────────────────────────────

func dial() (*amqp.Connection, error) {
	url := os.Getenv("RABBITMQ_URL")
	if url == "" {
		url = "amqp://guest:guest@localhost:5672/"
	}
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq: dial failed: %w", err)
	}
	return conn, nil
}

// declareTopology ensures both pipelines' exchanges, queues, DLX, and DLQs all exist.
// It is idempotent — safe to call multiple times.
func declareTopology(ch *amqp.Channel) error {
	// ── Shared DLX ───────────────────────────────────────────────────────────
	if err := ch.ExchangeDeclare(dlxName, "fanout", true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declare DLX: %w", err)
	}
	if _, err := ch.QueueDeclare(dlqName, true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declare DLQ: %w", err)
	}
	if err := ch.QueueBind(dlqName, "", dlxName, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: bind DLQ: %w", err)
	}

	// ── Topic 2 (Chiều về): MinIO → Postgres ─────────────────────────────────
	if err := ch.ExchangeDeclare(exchangeName, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declare exchange: %w", err)
	}
	args2 := amqp.Table{"x-dead-letter-exchange": dlxName}
	if _, err := ch.QueueDeclare(queueName, true, false, false, false, args2); err != nil {
		return fmt.Errorf("rabbitmq: declare queue: %w", err)
	}
	if err := ch.QueueBind(queueName, routingKey, exchangeName, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: bind queue: %w", err)
	}

	// ── Topic 1 (Chiều đi): API → MinIO ──────────────────────────────────────
	if _, err := ch.QueueDeclare(uploadRequestDlqName, true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declare upload DLQ: %w", err)
	}
	if err := ch.QueueBind(uploadRequestDlqName, "", dlxName, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: bind upload DLQ: %w", err)
	}
	if err := ch.ExchangeDeclare(uploadRequestExchange, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declare upload exchange: %w", err)
	}
	uploadArgs := amqp.Table{"x-dead-letter-exchange": dlxName}
	if _, err := ch.QueueDeclare(uploadRequestQueue, true, false, false, false, uploadArgs); err != nil {
		return fmt.Errorf("rabbitmq: declare upload queue: %w", err)
	}
	if err := ch.QueueBind(uploadRequestQueue, uploadRequestKey, uploadRequestExchange, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: bind upload queue: %w", err)
	}

	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Publisher
// ─────────────────────────────────────────────────────────────────────────────

// Publisher publishes ImageUploadedEvent messages to RabbitMQ.
// It holds a single persistent connection + channel for efficiency.
type Publisher struct {
	conn *amqp.Connection
	ch   *amqp.Channel
}

// NewPublisher dials RabbitMQ and declares the full topology.
// Returns nil, nil when RABBITMQ_URL is not set (graceful no-op mode).
func NewPublisher() (*Publisher, error) {
	if os.Getenv("RABBITMQ_URL") == "" {
		log.Println("[RabbitMQ] RABBITMQ_URL not set — publisher disabled (sync mode active)")
		return nil, nil
	}

	conn, err := dial()
	if err != nil {
		return nil, err
	}
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("rabbitmq: open channel: %w", err)
	}
	if err := declareTopology(ch); err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}
	log.Println("[RabbitMQ] Publisher connected and topology declared")
	return &Publisher{conn: conn, ch: ch}, nil
}

// Publish serialises and sends an ImageUploadedEvent.
// If the Publisher is nil (disabled), this is a no-op.
func (p *Publisher) Publish(event ImageUploadedEvent) error {
	if p == nil {
		return nil
	}
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("rabbitmq: marshal event: %w", err)
	}
	err = p.ch.Publish(
		exchangeName,
		routingKey,
		false, // mandatory
		false, // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent, // survives broker restart
			Body:         body,
			Timestamp:    time.Now(),
		},
	)
	if err != nil {
		return fmt.Errorf("rabbitmq: publish: %w", err)
	}
	log.Printf("[RabbitMQ] Published image.uploaded for detail=%s url=%s", event.DetailAssignID, event.MinioURL)
	return nil
}

// PublishUploadRequest publishes an UploadRequestEvent to the "chiều đi" queue.
// The MinIO Worker picks this up and streams the staged file to MinIO.
func (p *Publisher) PublishUploadRequest(event UploadRequestEvent) error {
	if p == nil {
		return nil
	}
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("rabbitmq: marshal upload request: %w", err)
	}
	err = p.ch.Publish(
		uploadRequestExchange,
		uploadRequestKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Timestamp:    time.Now(),
		},
	)
	if err != nil {
		return fmt.Errorf("rabbitmq: publish upload request: %w", err)
	}
	log.Printf("[RabbitMQ] Published upload.request for detail=%s file=%s", event.DetailAssignID, event.Filename)
	return nil
}

// Close tears down the publisher's connection cleanly.
func (p *Publisher) Close() {
	if p == nil {
		return
	}
	if p.ch != nil {
		p.ch.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}
}
