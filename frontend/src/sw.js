import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

cleanupOutdatedCaches()

// Precache resources
precacheAndRoute(self.__WB_MANIFEST)

// ──────────────────────────────────────────────────────────────────────────────
// Push Notification Listener
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    let data = {}
    if (event.data) {
        try {
            data = event.data.json()
        } catch (e) {
            console.log('[SW] Push data parse error:', e)
        }
    }

    const title = data.title || 'Thông báo mới'
    const options = {
        body: data.body || 'Bạn có thông báo mới từ hệ thống.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: data.url || '/',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            { action: 'open', title: 'Xem chi tiết' }
        ]
    }

    event.waitUntil(
        // 1. Show native OS notification
        self.registration.showNotification(title, options)
            .then(() => {
                // 2. Signal all open tabs to refresh immediately
                //    NotificationContext listens for this message type.
                return clients.matchAll({ type: 'window', includeUncontrolled: true })
            })
            .then((clientList) => {
                clientList.forEach((client) => {
                    client.postMessage({ type: 'NEW_NOTIFICATION' })
                })
            })
            .catch(err => console.error('[SW] Push handling error:', err))
    )
})

// ──────────────────────────────────────────────────────────────────────────────
// Notification Click Listener
// ──────────────────────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing tab if already open
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus()
                }
            }
            // Otherwise open a new window at the target URL
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data)
            }
        })
    )
})
