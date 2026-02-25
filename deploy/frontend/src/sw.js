import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'



cleanupOutdatedCaches()

// Precache resources
precacheAndRoute(self.__WB_MANIFEST)

// Push Notification Listener
self.addEventListener('push', (event) => {
    console.log('[SW] Push Received', event);
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
            console.log('[SW] Push Data:', data);
        } catch (e) {
            console.log('[SW] Push Data (Text):', event.data.text());
        }
    }

    const title = data.title || 'Thông báo mới';
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
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => console.log('[SW] Notification shown'))
            .catch(err => console.error('[SW] Notification Error:', err))
    );
});

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus if already open
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if not open
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data);
            }
        })
    );
});
