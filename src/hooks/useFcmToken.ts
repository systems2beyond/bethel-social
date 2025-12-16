import { useEffect, useState } from 'react';
import { messaging, db } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export function useFcmToken() {
    const { user } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [permission, setPermission] = useState<string>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        try {
            if (!messaging) return; // Not supported or server-side

            const permission = await Notification.requestPermission();
            setPermission(permission);

            if (permission === 'granted' && user) {
                const currentToken = await getToken(messaging, {
                    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY // Ensure this env var exists
                });

                if (currentToken) {
                    setToken(currentToken);
                    // Save to user profile
                    await setDoc(doc(db, 'users', user.uid, 'fcmTokens', currentToken), {
                        token: currentToken,
                        lastSeen: new Date(),
                        device: navigator.userAgent
                    });
                }
            }
        } catch (error) {
            console.error('An error occurred while retrieving token. ', error);
        }
    };

    return { token, permission, requestPermission };
}
