package websocket

import (
	"encoding/json"
	"sync"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/platform/logger"
)

func safeClose(ch chan []byte) {
	defer func() { recover() }()
	close(ch)
}

// ─── Client ───────────────────────────────────────────────────────────────────

// Client represents a single active WebSocket connection for a user.
type Client struct {
	UserID uuid.UUID
	Send   chan []byte // Buffered channel of outbound messages
}

// ─── Hub ──────────────────────────────────────────────────────────────────────

// Hub maintains the set of active clients and broadcasts messages to them.
// It is safe for concurrent use from multiple goroutines.
type Hub struct {
	mu       sync.RWMutex
	clients  map[uuid.UUID][]*Client // One user can have multiple tabs open
	log      *zap.Logger
	userRepo domain.UserRepository   // Used to sync status_user in DB
}

// NewHub creates and returns a new Hub.
func NewHub(userRepo domain.UserRepository) *Hub {
	return &Hub{
		clients:  make(map[uuid.UUID][]*Client),
		log:      logger.Get(),
		userRepo: userRepo,
	}
}

// Register adds a new client to the Hub.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Limit to max 5 concurrent connections per user (prevent DoS)
	if len(h.clients[c.UserID]) >= 5 {
		// Drop the oldest connection to make room for the new one
		oldest := h.clients[c.UserID][0]
		safeClose(oldest.Send)
		
		// Shift remaining connections left
		h.clients[c.UserID] = h.clients[c.UserID][1:]
		
		h.log.Warn("[WS Hub] Connection limit reached for user, dropped oldest connection",
			zap.String("user_id", c.UserID.String()),
		)
	}

	isFirstConn := len(h.clients[c.UserID]) == 0
	h.clients[c.UserID] = append(h.clients[c.UserID], c)
	h.log.Info("[WS Hub] Client connected",
		zap.String("user_id", c.UserID.String()),
		zap.Int("total_conns", len(h.clients[c.UserID])),
	)

	// Set status_user = 1 only when this is the first tab connecting
	if isFirstConn && h.userRepo != nil {
		if err := h.userRepo.UpdateStatus(c.UserID, 1); err != nil {
			h.log.Warn("[WS Hub] Failed to set user online",
				zap.String("user_id", c.UserID.String()),
				zap.Error(err),
			)
		} else {
			// Broadcast the presence update to all connected clients
			msgPayload := map[string]interface{}{
				"type": "user_status_changed",
				"data": map[string]interface{}{
					"user_id": c.UserID.String(),
					"status":  1,
				},
			}
			if msgBytes, err := json.Marshal(msgPayload); err == nil {
				go h.BroadcastAll(msgBytes)
			}
		}
	}
}

// Unregister removes a client from the Hub and closes its send channel.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.clients[c.UserID]
	newClients := clients[:0]
	for _, existing := range clients {
		if existing != c {
			newClients = append(newClients, existing)
		}
	}

	isLastConn := len(newClients) == 0
	if isLastConn {
		delete(h.clients, c.UserID)
	} else {
		h.clients[c.UserID] = newClients
	}

	safeClose(c.Send)
	h.log.Info("[WS Hub] Client disconnected",
		zap.String("user_id", c.UserID.String()),
		zap.Int("remaining_conns", len(newClients)),
	)

	// Set status_user = 0 only when the LAST tab/connection is gone
	if isLastConn && h.userRepo != nil {
		if err := h.userRepo.UpdateStatus(c.UserID, 0); err != nil {
			h.log.Warn("[WS Hub] Failed to set user offline",
				zap.String("user_id", c.UserID.String()),
				zap.Error(err),
			)
		} else {
			// Broadcast the presence update to all connected clients
			msgPayload := map[string]interface{}{
				"type": "user_status_changed",
				"data": map[string]interface{}{
					"user_id": c.UserID.String(),
					"status":  0,
				},
			}
			if msgBytes, err := json.Marshal(msgPayload); err == nil {
				go h.BroadcastAll(msgBytes)
			}
		}
	}
}

// SendToUser pushes a raw JSON message to all active connections for a given user.
// It is a no-op if the user is not connected.
func (h *Hub) SendToUser(userID uuid.UUID, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clients, ok := h.clients[userID]
	if !ok {
		return // User not online via WebSocket
	}

	for _, c := range clients {
		// Non-blocking send: if buffer is full drop the message (client is too slow)
		select {
		case c.Send <- message:
		default:
			h.log.Warn("[WS Hub] Client send buffer full, dropping message",
				zap.String("user_id", userID.String()),
			)
		}
	}
}

// BroadcastAll pushes a raw JSON message to all active connections in the Hub.
// Useful for system-wide notifications like "task_updated" for all Managers.
func (h *Hub) BroadcastAll(message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, clients := range h.clients {
		for _, c := range clients {
			select {
			case c.Send <- message:
			default:
				h.log.Warn("[WS Hub] Client send buffer full, dropping broadcast message",
					zap.String("user_id", c.UserID.String()),
				)
			}
		}
	}
}

// IsOnline reports whether a user has at least one active WebSocket connection.
func (h *Hub) IsOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID]) > 0
}

// HubStats contains snapshot metrics from the Hub.
type HubStats struct {
	UniqueUsers     int `json:"unique_users"`      // Distinct online users
	TotalConns      int `json:"total_connections"` // Total WS connections (multi-tab)
}

// Stats returns a point-in-time snapshot of Hub connection metrics.
func (h *Hub) Stats() HubStats {
	h.mu.RLock()
	defer h.mu.RUnlock()
	total := 0
	for _, clients := range h.clients {
		total += len(clients)
	}
	return HubStats{
		UniqueUsers: len(h.clients),
		TotalConns:  total,
	}
}
