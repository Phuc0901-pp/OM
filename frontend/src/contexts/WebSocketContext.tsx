/**
 * WebSocketContext — Global WebSocket Provider
 *
 * PROBLEM SOLVED: Trước đây mỗi component gọi useWebSocket() đều tạo ra
 * một WebSocket connection riêng biệt. Điều này dẫn đến:
 *   - Nhiều connections ảo (2-3 WS per tab)
 *   - Backend nhận diện sai `isLastConn` → status_user không về 0 khi tắt tab
 *   - Broadcast "user_status_changed" bị miss vì component mount sau khi event đã gửi
 *
 * SOLUTION: Dùng React Context để chia sẻ 1 WebSocket duy nhất cho toàn bộ app.
 * Tất cả component chỉ subscribe vào lastMessage từ 1 connection duy nhất.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebSocketMessage {
  type?: string;
  event?: string;
  [key: string]: any;
}

interface WebSocketContextValue {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  lastMessage: null,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  // Track if we have intentionally unmounted to avoid reconnecting after logout
  const isMounted = useRef(true);

  const buildWsUrl = useCallback((token: string): string => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    if (baseUrl.startsWith('http')) {
      return baseUrl.replace(/^http/, 'ws') + `/ws?token=${token}`;
    }
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}${baseUrl}/ws?token=${token}`;
  }, []);

  const connect = useCallback(() => {
    if (!isMounted.current) return;

    const token = sessionStorage.getItem('token');
    if (!token) return;

    // Đóng connection cũ nếu vẫn còn đang mở
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      ws.current.onclose = null; // Tắt handler để tránh trigger reconnect loop
      ws.current.close();
    }

    const url = buildWsUrl(token);
    console.log('[WS Global] Connecting to:', url.replace(/token=.*/, 'token=***'));

    const socket = new window.WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      if (!isMounted.current) return;
      console.log('[WS Global] Connected ✓');
      setIsConnected(true);
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    socket.onmessage = (event) => {
      if (!isMounted.current) return;
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        console.log('[WS Global] Message received:', data?.type ?? data?.event);
        setLastMessage(data);
      } catch {
        console.warn('[WS Global] Invalid JSON:', event.data);
      }
    };

    socket.onclose = (ev) => {
      if (!isMounted.current) return;
      console.log(`[WS Global] Disconnected (code=${ev.code}). Reconnecting in 5s…`);
      setIsConnected(false);
      ws.current = null;
      reconnectTimeout.current = window.setTimeout(() => {
        connect();
      }, 5000);
    };

    socket.onerror = () => {
      // onerror is always followed by onclose – just close and let onclose reconnect
      socket.close();
    };
  }, [buildWsUrl]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnect on intentional close
        ws.current.close();
        ws.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useWebSocket — hook để subscribe vào global WebSocket context.
 * Phải được dùng bên trong <WebSocketProvider>.
 */
export const useWebSocket = (): WebSocketContextValue => {
  return useContext(WebSocketContext);
};
