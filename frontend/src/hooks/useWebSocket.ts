import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
    event: string;
    [key: string]: any;
}

interface UseWebSocketReturn {
    isConnected: boolean;
    lastMessage: WebSocketMessage | null;
}

export const useWebSocket = (): UseWebSocketReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<number | null>(null);

    const connect = useCallback(() => {
        const token = sessionStorage.getItem('token');
        if (!token) return;

        // Xây dựng URL WS từ baseUrl của API
        const baseUrl = import.meta.env.VITE_API_URL || '';
        // Chuyển http:// -> ws://, https:// -> wss://
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let wsUrl = '';
        
        if (baseUrl.startsWith('http')) {
            wsUrl = baseUrl.replace(/^http/, 'ws') + `/ws?token=${token}`;
        } else {
            // Relative URL fallback (lấy domain hiện tại)
            wsUrl = `${wsProtocol}//${window.location.host}${baseUrl}/ws?token=${token}`;
        }

        ws.current = new window.WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('[WebSocket] Connected');
            setIsConnected(true);
            if (reconnectTimeout.current) {
                window.clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
            } catch (err) {
                console.warn('[WebSocket] Invalid JSON message:', event.data);
            }
        };

        ws.current.onclose = () => {
            console.log('[WebSocket] Disconnected. Reconnecting in 5s...');
            setIsConnected(false);
            // Auto reconnect sau 5s nếu bị rớt
            reconnectTimeout.current = window.setTimeout(() => {
                connect();
            }, 5000);
        };

        ws.current.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
            ws.current?.close(); // Force close to trigger Reconnect
        };
    }, []);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeout.current) {
                window.clearTimeout(reconnectTimeout.current);
            }
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [connect]);

    return { isConnected, lastMessage };
};
