// Firebase Messaging Service Worker
// Handles push notifications for Bethel Social

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Note: In production, these values should be injected at build time
firebase.initializeApp({
    apiKey: "AIzaSyCJY1tZPXM7BEAHPfYsFLp9grad89nar8g",
    authDomain: "bethel-metro-social.firebaseapp.com",
    projectId: "bethel-metro-social",
    storageBucket: "bethel-metro-social.firebasestorage.app",
    messagingSenderId: "503876827928",
    appId: "1:503876827928:web:5ca90929f9c1eff6983c6d"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'Bethel Social';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/images/icons/icon-192x192.png',
        badge: '/images/icons/badge-72x72.png',
        tag: payload.data?.tag || `notification-${Date.now()}`,
        data: payload.data || {},
        vibrate: [100, 50, 100],
        actions: getActionsForType(payload.data?.type),
        requireInteraction: payload.data?.type === 'ministry_assignment' // Keep task notifications visible
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Get notification actions based on type
function getActionsForType(type) {
    switch (type) {
        case 'ministry_assignment':
            return [
                { action: 'mark_done', title: 'Mark Done', icon: '/images/icons/check.png' },
                { action: 'view', title: 'View Task', icon: '/images/icons/view.png' }
            ];
        case 'direct_message':
        case 'message':
            return [
                { action: 'reply', title: 'Reply', icon: '/images/icons/reply.png' },
                { action: 'view', title: 'View', icon: '/images/icons/view.png' }
            ];
        case 'group_post':
        case 'group_comment':
            return [
                { action: 'like', title: 'Like', icon: '/images/icons/heart.png' },
                { action: 'view', title: 'View', icon: '/images/icons/view.png' }
            ];
        case 'invitation':
            return [
                { action: 'accept', title: 'Accept', icon: '/images/icons/check.png' },
                { action: 'view', title: 'View', icon: '/images/icons/view.png' }
            ];
        case 'event_reminder':
            return [
                { action: 'view', title: 'View Event', icon: '/images/icons/calendar.png' }
            ];
        default:
            return [
                { action: 'view', title: 'View', icon: '/images/icons/view.png' }
            ];
    }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);

    event.notification.close();

    const data = event.notification.data || {};
    const action = event.action;
    let targetUrl = '/';

    // Determine URL based on notification type and action
    switch (data.type) {
        case 'ministry_assignment':
            if (action === 'mark_done') {
                // Special handling for mark done - will communicate with client
                targetUrl = `/fellowship?tab=tasks&markDone=${data.resourceId}`;
            } else {
                targetUrl = `/fellowship?tab=tasks`;
            }
            break;
        case 'direct_message':
        case 'message':
            if (action === 'reply') {
                targetUrl = `/fellowship?tab=community&reply=${data.conversationId || data.resourceId}`;
            } else {
                targetUrl = `/fellowship?tab=community`;
            }
            break;
        case 'group_post':
        case 'group_comment':
            if (data.groupId) {
                targetUrl = `/groups/${data.groupId}?postId=${data.resourceId}`;
            } else {
                targetUrl = '/groups';
            }
            break;
        case 'invitation':
            targetUrl = `/fellowship?tab=studies`;
            break;
        case 'event_reminder':
            if (data.eventId) {
                targetUrl = `/events/${data.eventId}`;
            } else {
                targetUrl = '/events';
            }
            break;
        default:
            targetUrl = '/notifications';
    }

    // Handle window focus/open
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Try to find an existing window and focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus().then(() => {
                        // Navigate to the target URL
                        return client.navigate(targetUrl);
                    });
                }
            }
            // Open new window if none exist
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[firebase-messaging-sw.js] Notification closed:', event.notification.tag);
    // Could track analytics here
});

// Handle push subscription change (for re-subscribing)
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[firebase-messaging-sw.js] Push subscription changed');

    event.waitUntil(
        self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: null // Will use default from manifest
        }).then((subscription) => {
            console.log('[firebase-messaging-sw.js] Re-subscribed:', subscription.endpoint);
            // Would need to send new subscription to server here
        }).catch((error) => {
            console.error('[firebase-messaging-sw.js] Re-subscribe failed:', error);
        })
    );
});

// Periodic sync for checking missed notifications (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notifications') {
        console.log('[firebase-messaging-sw.js] Checking for missed notifications');
        // Could fetch missed notifications from server
    }
});

console.log('[firebase-messaging-sw.js] Service worker loaded');
