package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────────────────────────────────
// Consumer — Goroutine Pool
// ─────────────────────────────────────────────────────────────────────────────

// Consumer reads ImageUploadedEvent from RabbitMQ and writes the MinIO URL
// into PostgreSQL (detail_assigns.data JSON array). It runs a fixed-size
// goroutine pool so multiple messages can be processed concurrently.
type Consumer struct {
	conn        *amqp.Connection
	workerCount int
	db          *gorm.DB
	stopCh      chan struct{}
}

// NewConsumer dials RabbitMQ and returns a Consumer ready to be started.
// Returns nil, nil when RABBITMQ_URL is not set (graceful no-op).
func NewConsumer(db *gorm.DB, workerCount int) (*Consumer, error) {
	if os.Getenv("RABBITMQ_URL") == "" {
		log.Println("[RabbitMQ] RABBITMQ_URL not set — consumer disabled")
		return nil, nil
	}
	if workerCount < 1 {
		workerCount = 4
	}
	conn, err := dial()
	if err != nil {
		return nil, err
	}
	log.Printf("[RabbitMQ] Consumer connected (%d workers)", workerCount)
	return &Consumer{
		conn:        conn,
		workerCount: workerCount,
		db:          db,
		stopCh:      make(chan struct{}),
	}, nil
}

// Start launches the goroutine pool and blocks until ctx is cancelled.
// Call this in a separate goroutine: go consumer.Start(ctx).
func (c *Consumer) Start(ctx context.Context) {
	if c == nil {
		return
	}

	ch, err := c.conn.Channel()
	if err != nil {
		log.Printf("[RabbitMQ Consumer] Failed to open channel: %v", err)
		return
	}
	defer ch.Close()

	if err := declareTopology(ch); err != nil {
		log.Printf("[RabbitMQ Consumer] Topology declare failed: %v", err)
		return
	}

	// Prefetch = workerCount so broker distributes evenly
	if err := ch.Qos(c.workerCount, 0, false); err != nil {
		log.Printf("[RabbitMQ Consumer] Qos failed: %v", err)
		return
	}

	deliveries, err := ch.Consume(
		queueName,
		"",    // auto-generated consumer tag
		false, // manual ack
		false, false, false, nil,
	)
	if err != nil {
		log.Printf("[RabbitMQ Consumer] Consume failed: %v", err)
		return
	}

	// Worker pool — each worker processes one message at a time
	sem := make(chan struct{}, c.workerCount)
	log.Printf("[RabbitMQ Consumer] Listening on queue '%s' with %d workers", queueName, c.workerCount)

	for {
		select {
		case <-ctx.Done():
			log.Println("[RabbitMQ Consumer] Context cancelled — shutting down")
			return
		case <-c.stopCh:
			log.Println("[RabbitMQ Consumer] Stop signal received — shutting down")
			return
		case msg, ok := <-deliveries:
			if !ok {
				log.Println("[RabbitMQ Consumer] Delivery channel closed — reconnect needed")
				return
			}
			sem <- struct{}{}
			go func(d amqp.Delivery) {
				defer func() { <-sem }()
				c.handleMessage(d)
			}(msg)
		}
	}
}

// Stop signals the consumer goroutine to exit cleanly.
func (c *Consumer) Stop() {
	if c == nil {
		return
	}
	close(c.stopCh)
	if c.conn != nil {
		c.conn.Close()
	}
}

// handleMessage processes a single delivery:
// deserialise → upsert URL into PostgreSQL detail_assigns.data → ACK or NACK.
func (c *Consumer) handleMessage(d amqp.Delivery) {
	var event ImageUploadedEvent
	if err := json.Unmarshal(d.Body, &event); err != nil {
		log.Printf("[Consumer] Bad message (NACK, no-requeue): %v — body: %s", err, string(d.Body))
		// Malformed message — send to DLQ immediately
		d.Nack(false, false)
		return
	}

	log.Printf("[Consumer] Processing image.uploaded: detail=%s url=%s", event.DetailAssignID, event.MinioURL)

	if err := c.persistURL(event); err != nil {
		log.Printf("[Consumer] DB write failed for detail=%s: %v — NACK (requeue)", event.DetailAssignID, err)
		// Transient DB error — requeue for retry (will eventually hit DLQ after max-retries)
		d.Nack(false, true)
		return
	}

	log.Printf("[Consumer] ACK image.uploaded for detail=%s", event.DetailAssignID)
	d.Ack(false)
}

// persistURL safely appends the MinIO URL to the detail_assigns.data JSON array.
// It uses a DB-level UNION merge to prevent overwriting concurrent updates.
func (c *Consumer) persistURL(event ImageUploadedEvent) error {
	const maxRetries = 3
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		err := c.db.Transaction(func(tx *gorm.DB) error {
			// 1. Read current JSON array with row-level lock
			var raw struct {
				Data datatypes.JSON `gorm:"column:data"`
			}
			if err := tx.Raw(
				`SELECT data FROM detail_assigns WHERE id = ? FOR UPDATE`,
				event.DetailAssignID,
			).Scan(&raw).Error; err != nil {
				return fmt.Errorf("select failed: %w", err)
			}

			// 2. Unmarshal existing URLs
			var existing []string
			if len(raw.Data) > 0 && string(raw.Data) != "null" {
				if err := json.Unmarshal(raw.Data, &existing); err != nil {
					return fmt.Errorf("unmarshal data: %w", err)
				}
			}

			// 3. Deduplicate — append only if not already present
			seen := make(map[string]struct{}, len(existing)+1)
			for _, u := range existing {
				seen[u] = struct{}{}
			}
			if _, dup := seen[event.MinioURL]; dup {
				log.Printf("[Consumer] URL already exists in DB, skipping duplicate: %s", event.MinioURL)
				return nil // idempotent — not an error
			}
			merged := append(existing, event.MinioURL)
			mergedJSON, err := json.Marshal(merged)
			if err != nil {
				return fmt.Errorf("marshal merged: %w", err)
			}

			// 4. Update — only the data column to avoid clobbering other fields
			if err := tx.Exec(
				`UPDATE detail_assigns SET data = ? WHERE id = ?`,
				datatypes.JSON(mergedJSON),
				event.DetailAssignID,
			).Error; err != nil {
				return fmt.Errorf("update failed: %w", err)
			}
			return nil
		})

		if err == nil {
			return nil
		}

		lastErr = err
		backoff := time.Duration(attempt*attempt) * 500 * time.Millisecond // 0.5s, 2s, 4.5s
		log.Printf("[Consumer] DB attempt %d/%d failed: %v — retrying in %v", attempt, maxRetries, err, backoff)
		time.Sleep(backoff)
	}

	return fmt.Errorf("all %d DB attempts failed: %w", maxRetries, lastErr)
}
