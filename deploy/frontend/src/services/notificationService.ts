import api from './api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const subscribeToPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported');
        return;
    }

    // 1. Check/Request Permission
    if (Notification.permission === 'denied') {
        alert('Bạn đã chặn thông báo. Vui lòng bật lại trong cài đặt trình duyệt.');
        return;
    }

    if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
    }

    try {
        // 2. Get Service Worker Registration
        const registration = await navigator.serviceWorker.ready;

        // 3. Get VAPID Key from Server (or Env)
        let key = VAPID_PUBLIC_KEY;
        if (!key) {
            try {
                const res = await api.get('/monitoring/vapid-key');
                key = res.data.publicKey;
            } catch (error) {
                console.error('Failed to get VAPID key', error);
                return;
            }
        }

        if (!key) return;

        // 4. Subscribe
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key)
        });

        // 5. Send to Backend
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (!user || !user.id) return;

        await api.post('/monitoring/subscribe', {
            userId: user.id,
            endpoint: subscription.endpoint,
            p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!)))),
            auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!)))),
            userAgent: navigator.userAgent
        });

        console.log('Web Push Subscribed!');
    } catch (error) {
        console.error('Failed to subscribe to push', error);
    }
};
