import api from './api';

const WS_URL = (() => {
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000')
        .replace(/^http/, 'ws'); // http → ws, https → wss
    return `${base}/api/ws`;
})();

let socketInstance: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000; // Exponential backoff starts at 1s
const MAX_DELAY = 30_000;   // Cap at 30s

type MessageHandler = (data: unknown) => void;
const messageHandlers = new Set<MessageHandler>();

/** Call this to subscribe to incoming WS messages */
export const onWsMessage = (handler: MessageHandler) => {
    messageHandlers.add(handler);
    return () => messageHandlers.delete(handler); // Returns unsubscriber
};

export const connectWebSocket = (): void => {
    if (socketInstance && socketInstance.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('token');
    if (!token) return; // Not logged in

    const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
    console.log('[WS] Connecting:', url);

    socketInstance = new WebSocket(url);

    socketInstance.onopen = () => {
        console.log('[WS] Connected ✓');
        reconnectDelay = 1000; // Reset backoff on successful connection
    };

    socketInstance.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            messageHandlers.forEach(h => h(data));
        } catch (e) {
            console.warn('[WS] Failed to parse message:', e);
        }
    };

    socketInstance.onerror = (err) => {
        console.warn('[WS] Error:', err);
    };

    socketInstance.onclose = (event) => {
        console.log(`[WS] Closed (code ${event.code}). Reconnecting in ${reconnectDelay}ms...`);
        socketInstance = null;

        // Only attempt reconnect if the user is still logged in
        if (localStorage.getItem('token')) {
            reconnectTimer = setTimeout(() => {
                reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
                connectWebSocket();
            }, reconnectDelay);
        }
    };
};

export const disconnectWebSocket = (): void => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (socketInstance) {
        socketInstance.onclose = null; // Prevent auto-reconnect on manual close
        socketInstance.close();
        socketInstance = null;
    }
    console.log('[WS] Disconnected manually.');
};
