import { getMessaging, getToken, onMessage, MessagePayload, Messaging } from 'firebase/messaging';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';

// VAPID key for FCM (you'll need to get this from Firebase Console)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export class PushNotificationService {
    private static messaging: Messaging | null = null;
    private static initialized = false;

    /**
     * Initialize the push notification service
     * Should be called once when the app loads
     */
    static async initialize(): Promise<void> {
        if (this.initialized || typeof window === 'undefined') return;

        try {
            // Check if notifications are supported
            if (!('Notification' in window)) {
                console.log('[PushNotificationService] Notifications not supported');
                return;
            }

            // Check if service workers are supported
            if (!('serviceWorker' in navigator)) {
                console.log('[PushNotificationService] Service workers not supported');
                return;
            }

            this.messaging = getMessaging(app);
            this.initialized = true;
            console.log('[PushNotificationService] Initialized');
        } catch (error) {
            console.error('[PushNotificationService] Initialization error:', error);
        }
    }

    /**
     * Check if push notifications are supported
     */
    static isSupported(): boolean {
        return typeof window !== 'undefined' &&
            'Notification' in window &&
            'serviceWorker' in navigator &&
            'PushManager' in window;
    }

    /**
     * Get current permission status
     */
    static getPermissionStatus(): NotificationPermission | 'unsupported' {
        if (!this.isSupported()) return 'unsupported';
        return Notification.permission;
    }

    /**
     * Request notification permission from user
     */
    static async requestPermission(): Promise<boolean> {
        if (!this.isSupported()) {
            console.log('[PushNotificationService] Notifications not supported');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            console.log('[PushNotificationService] Permission result:', permission);
            return permission === 'granted';
        } catch (error) {
            console.error('[PushNotificationService] Permission request error:', error);
            return false;
        }
    }

    /**
     * Get FCM token for this device
     * Requires notification permission to be granted first
     */
    static async getDeviceToken(): Promise<string | null> {
        if (!this.messaging) {
            await this.initialize();
        }

        if (!this.messaging || Notification.permission !== 'granted') {
            console.log('[PushNotificationService] Cannot get token - not initialized or no permission');
            return null;
        }

        try {
            // Register service worker if not already registered
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('[PushNotificationService] Service worker registered:', registration.scope);

            const token = await getToken(this.messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('[PushNotificationService] FCM Token:', token.substring(0, 20) + '...');
                return token;
            } else {
                console.log('[PushNotificationService] No token available');
                return null;
            }
        } catch (error) {
            console.error('[PushNotificationService] Error getting token:', error);
            return null;
        }
    }

    /**
     * Save FCM token to user's Firestore document
     */
    static async saveTokenToUser(userId: string, token: string): Promise<void> {
        if (!token) return;

        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                // Add token to user's fcmTokens array (if not already present)
                await updateDoc(userRef, {
                    fcmTokens: arrayUnion(token),
                    lastTokenUpdate: serverTimestamp(),
                    pushNotificationsEnabled: true
                });
            } else {
                // Create user doc with token
                await setDoc(userRef, {
                    fcmTokens: [token],
                    lastTokenUpdate: serverTimestamp(),
                    pushNotificationsEnabled: true
                }, { merge: true });
            }

            console.log('[PushNotificationService] Token saved for user:', userId);
        } catch (error) {
            console.error('[PushNotificationService] Error saving token:', error);
        }
    }

    /**
     * Remove FCM token from user's document (on logout or disable)
     */
    static async removeTokenFromUser(userId: string, token: string): Promise<void> {
        if (!token) return;

        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                fcmTokens: arrayRemove(token),
                lastTokenUpdate: serverTimestamp()
            });

            console.log('[PushNotificationService] Token removed for user:', userId);
        } catch (error) {
            console.error('[PushNotificationService] Error removing token:', error);
        }
    }

    /**
     * Subscribe to foreground messages
     * Returns unsubscribe function
     */
    static subscribeToForegroundMessages(
        callback: (payload: MessagePayload) => void
    ): (() => void) | null {
        if (!this.messaging) {
            console.log('[PushNotificationService] Cannot subscribe - not initialized');
            return null;
        }

        return onMessage(this.messaging, (payload) => {
            console.log('[PushNotificationService] Foreground message received:', payload);
            callback(payload);
        });
    }

    /**
     * Complete setup flow for a user
     * Requests permission, gets token, and saves to Firestore
     */
    static async setupForUser(userId: string): Promise<{
        success: boolean;
        token: string | null;
        permissionGranted: boolean;
    }> {
        // Check current permission
        let permissionGranted = Notification.permission === 'granted';

        // Request permission if not granted
        if (!permissionGranted) {
            permissionGranted = await this.requestPermission();
        }

        if (!permissionGranted) {
            return { success: false, token: null, permissionGranted: false };
        }

        // Get device token
        const token = await this.getDeviceToken();

        if (!token) {
            return { success: false, token: null, permissionGranted: true };
        }

        // Save token to user's document
        await this.saveTokenToUser(userId, token);

        return { success: true, token, permissionGranted: true };
    }

    /**
     * Disable push notifications for a user
     */
    static async disableForUser(userId: string): Promise<void> {
        const token = await this.getDeviceToken();
        if (token) {
            await this.removeTokenFromUser(userId, token);
        }

        // Update user preferences
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            pushNotificationsEnabled: false,
            lastTokenUpdate: serverTimestamp()
        });
    }

    /**
     * Show a local notification (for testing or fallback)
     */
    static async showLocalNotification(
        title: string,
        options: NotificationOptions = {}
    ): Promise<void> {
        if (!this.isSupported() || Notification.permission !== 'granted') {
            console.log('[PushNotificationService] Cannot show notification');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                icon: '/images/icons/icon-192x192.png',
                badge: '/images/icons/badge-72x72.png',
                vibrate: [100, 50, 100],
                ...options
            } as NotificationOptions & { vibrate: number[] });
        } catch (error) {
            console.error('[PushNotificationService] Error showing notification:', error);
        }
    }
}
