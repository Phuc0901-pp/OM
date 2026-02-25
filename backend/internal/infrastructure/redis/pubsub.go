package redis

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ─── Channel naming ───────────────────────────────────────────────────────────

// notifyChannel returns the Redis pub/sub channel name for a specific user.
func notifyChannel(userID uuid.UUID) string {
	return fmt.Sprintf("notify:%s", userID.String())
}

// ─── NotificationEvent ────────────────────────────────────────────────────────

// NotificationEvent is the payload published over Redis Pub/Sub.
// It's intentionally small — the full Notification lives in Postgres already.
type NotificationEvent struct {
	UserID  string          `json:"user_id"`
	Payload json.RawMessage `json:"payload"` // Raw Notification JSON from DB
}

// ─── Broker ───────────────────────────────────────────────────────────────────

// Broker wraps a Redis client to provide typed Pub/Sub helpers.
//
// All backend instances publish events here. Each instance subscribes
// to ALL user channels it knows about (via Subscribe) and forwards
// messages to its local in-process WS Hub.
type Broker struct {
	redis *Client
	log   *zap.Logger
}

// NewBroker creates a Broker. Returns nil when rdb is nil (Redis disabled).
func NewBroker(rdb *Client) *Broker {
	if rdb == nil {
		return nil
	}
	return &Broker{redis: rdb, log: rdb.log}
}

// Publish broadcasts a notification payload to all backend instances
// that have the target user connected via WebSocket.
func (b *Broker) Publish(ctx context.Context, userID uuid.UUID, payload []byte) error {
	if b == nil {
		return nil // Redis disabled — no-op
	}

	evt := NotificationEvent{
		UserID:  userID.String(),
		Payload: json.RawMessage(payload),
	}
	msg, err := json.Marshal(evt)
	if err != nil {
		return fmt.Errorf("broker marshal: %w", err)
	}

	channel := notifyChannel(userID)
	if err := b.redis.Publish(ctx, channel, msg).Err(); err != nil {
		b.log.Error("[Broker] Publish failed", zap.String("channel", channel), zap.Error(err))
		return err
	}
	return nil
}

// SubscribeUser starts a goroutine that listens on the given user's channel
// and calls onMessage with the raw notification JSON whenever an event arrives.
// The goroutine stops when ctx is cancelled.
//
// Call this in the WS handler after authenticating the user so that THIS
// backend instance can receive events published by OTHER instances.
func (b *Broker) SubscribeUser(ctx context.Context, userID uuid.UUID, onMessage func([]byte)) {
	if b == nil {
		return // Redis disabled
	}

	sub := b.redis.Subscribe(ctx, notifyChannel(userID))
	ch := sub.Channel()

	go func() {
		defer sub.Close()
		b.log.Info("[Broker] Subscribed", zap.String("user_id", userID.String()))

		for {
			select {
			case <-ctx.Done():
				b.log.Info("[Broker] Subscription cancelled", zap.String("user_id", userID.String()))
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var evt NotificationEvent
				if err := json.Unmarshal([]byte(msg.Payload), &evt); err != nil {
					b.log.Warn("[Broker] Bad payload", zap.Error(err))
					continue
				}
				onMessage([]byte(evt.Payload))
			}
		}
	}()
}
