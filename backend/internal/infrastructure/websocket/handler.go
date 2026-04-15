package websocket

import (
	"net/http"
	"time"

	gorillaws "github.com/gorilla/websocket"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/phuc/cmms-backend/internal/core/services"
	"github.com/phuc/cmms-backend/internal/platform/logger"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512

	// Client send channel buffer size
	sendBufSize = 32
)

var upgrader = gorillaws.Upgrader{
	HandshakeTimeout: 10 * time.Second,
	ReadBufferSize:   1024,
	WriteBufferSize:  1024,
	// Allow all origins (CORS is already handled by Gin middleware)
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// Handler upgrades HTTP connections to WebSocket and registers them with the Hub.
type Handler struct {
	hub         *Hub
	authService *services.AuthService
	log         *zap.Logger
}

// NewHandler creates a new WebSocket HTTP handler.
func NewHandler(hub *Hub, authService *services.AuthService) *Handler {
	return &Handler{
		hub:         hub,
		authService: authService,
		log:         logger.Get(),
	}
}

// ServeWS godoc
// @Summary      WebSocket endpoint for real-time notifications
// @Description  Establishes a persistent WebSocket connection. Requires authentication via ?token= query parameter.
// @Tags         websocket
// @Param        token  query  string  true  "JWT Bearer token (without 'Bearer' prefix)"
// @Router       /api/ws [get]
func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	// ── 1. Authenticate via query param (browsers cannot send custom headers during WS handshake) ──
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	claims, err := h.authService.VerifyToken(token)
	if err != nil {
		http.Error(w, "invalid or expired token", http.StatusUnauthorized)
		return
	}

	rawID, ok := claims["user_id"].(string)
	if !ok {
		http.Error(w, "invalid claims", http.StatusUnauthorized)
		return
	}

	userID, err := uuid.Parse(rawID)
	if err != nil {
		http.Error(w, "invalid user_id", http.StatusUnauthorized)
		return
	}

	// ── 2. Upgrade HTTP → WebSocket ──────────────────────────────────────────
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.log.Error("[WS] Upgrade failed", zap.Error(err))
		return
	}

	client := &Client{
		UserID: userID,
		Send:   make(chan []byte, sendBufSize),
	}

	h.hub.Register(client)

	// ── 3. Run pumps in goroutines ────────────────────────────────────────────
	go writePump(conn, client, h.hub)
	go readPump(conn, client, h.hub)
}

// ─── Pumps ────────────────────────────────────────────────────────────────────

// writePump pushes messages from client.Send channel to the WebSocket connection.
func writePump(conn *gorillaws.Conn, client *Client, hub *Hub) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel — send close frame and exit
				conn.WriteMessage(gorillaws.CloseMessage, []byte{})
				return
			}
			if err := conn.WriteMessage(gorillaws.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(gorillaws.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads messages from the WebSocket connection (mostly for pong/close).
// Actual notification data only flows server → client, but we need this goroutine
// to detect disconnections and to handle the WebSocket Pong protocol correctly.
func readPump(conn *gorillaws.Conn, client *Client, hub *Hub) {
	defer func() {
		hub.Unregister(client)
		conn.Close()
	}()

	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// Drain any incoming messages (we don't expect any, but must read to detect close)
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			if gorillaws.IsUnexpectedCloseError(err, gorillaws.CloseGoingAway, gorillaws.CloseAbnormalClosure) {
				logger.Get().Warn("[WS] Unexpected close", zap.Error(err))
			}
			break
		}
	}
}
