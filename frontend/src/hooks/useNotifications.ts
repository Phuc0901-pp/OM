/**
 * useNotifications
 * ─────────────────────────────────────────────────────────────────────────────
 * Backward-compatible adapter hook.
 * All logic now lives inside NotificationContext (Singleton).
 * Import this hook exactly as before — nothing else changes for consumers.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type { Notification } from '../context/NotificationContext';
export { useNotificationContext as useNotifications } from '../context/NotificationContext';
