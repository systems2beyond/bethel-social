import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PulpitSession, PulpitAlert, PulpitCheckIn } from '@/types';

export const PulpitService = {
    // ---------------------------------------------------------
    // Session Management
    // ---------------------------------------------------------

    async getActiveSession(churchId: string): Promise<PulpitSession | null> {
        try {
            console.log('[PulpitService] getActiveSession called with churchId:', churchId);

            // Simple query: Get most recent session with status 'live' or 'scheduled'
            // No date filter - if a session exists and is active, we want to find it
            const q = query(
                collection(db, 'pulpit_sessions'),
                where('churchId', '==', churchId),
                where('status', 'in', ['live', 'scheduled']),
                orderBy('createdAt', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(q);
            console.log('[PulpitService] Active sessions found:', snapshot.size);

            if (!snapshot.empty) {
                const session = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PulpitSession;
                console.log('[PulpitService] Returning session:', session.id, 'status:', session.status);
                return session;
            }

            console.log('[PulpitService] No active session found for churchId:', churchId);
            return null;
        } catch (error) {
            console.error('[PulpitService] Error fetching active pulpit session:', error);
            return null;
        }
    },

    async createSession(sessionData: Omit<PulpitSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = await addDoc(collection(db, 'pulpit_sessions'), {
            ...sessionData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    async updateSessionStatus(sessionId: string, status: 'live' | 'completed' | 'scheduled') {
        const docRef = doc(db, 'pulpit_sessions', sessionId);
        const updateData: Record<string, unknown> = {
            status,
            updatedAt: serverTimestamp()
        };
        // Set startedAt when going live (for timer)
        if (status === 'live') {
            updateData.startedAt = serverTimestamp();
        }
        await updateDoc(docRef, updateData);
    },

    async startSession(sessionId: string) {
        const docRef = doc(db, 'pulpit_sessions', sessionId);
        await updateDoc(docRef, {
            status: 'live',
            startedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    },

    async updateTeleprompter(sessionId: string, notes: string) {
        const docRef = doc(db, 'pulpit_sessions', sessionId);
        await updateDoc(docRef, {
            sermonNotes: notes,
            updatedAt: serverTimestamp()
        });
    },

    // ---------------------------------------------------------
    // Real-time Streams
    // ---------------------------------------------------------

    streamAlerts(churchId: string, callback: (alerts: PulpitAlert[]) => void) {
        // Show alerts created in the last 24 hours that are not resolved
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const q = query(
            collection(db, 'pulpit_alerts'),
            where('churchId', '==', churchId),
            where('resolved', '==', false),
            where('createdAt', '>=', yesterday), // Limit to recent
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const alerts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PulpitAlert[];
            callback(alerts);
        });
    },

    streamCheckins(churchId: string, sessionId: string, callback: (checkins: PulpitCheckIn[]) => void) {
        const q = query(
            collection(db, 'pulpit_checkins'),
            where('churchId', '==', churchId),
            where('sessionId', '==', sessionId),
            orderBy('checkInTime', 'desc'),
            limit(50)
        );

        return onSnapshot(q, (snapshot) => {
            const checkins = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PulpitCheckIn[];
            callback(checkins);
        });
    },

    // ---------------------------------------------------------
    // Actions
    // ---------------------------------------------------------

    async createAlert(alert: Omit<PulpitAlert, 'id' | 'createdAt'>) {
        await addDoc(collection(db, 'pulpit_alerts'), {
            ...alert,
            createdAt: serverTimestamp()
        });
    },

    async resolveAlert(alertId: string) {
        await updateDoc(doc(db, 'pulpit_alerts', alertId), {
            resolved: true,
            resolvedAt: serverTimestamp()
        });
    },

    async acknowledgeAlert(alertId: string, userId: string) {
        await updateDoc(doc(db, 'pulpit_alerts', alertId), {
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: serverTimestamp()
        });
    },

    async acknowledgeCheckin(checkinId: string, userId: string) {
        await updateDoc(doc(db, 'pulpit_checkins', checkinId), {
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: serverTimestamp()
        });
    },

    /**
     * Creates a check-in record for the Pulpit dashboard.
     * Called when a visitor submits the public connect form while a session is active.
     */
    async createCheckin(checkin: Omit<PulpitCheckIn, 'id' | 'checkInTime' | 'acknowledged'>): Promise<string> {
        const docRef = await addDoc(collection(db, 'pulpit_checkins'), {
            ...checkin,
            checkInTime: serverTimestamp(),
            acknowledged: false
        });
        return docRef.id;
    },

    /**
     * Creates a new sermon note for a user.
     * Used when importing manuscripts.
     */
    async createNote(userId: string, title: string, content: string): Promise<string> {
        const docRef = await addDoc(collection(db, 'users', userId, 'notes'), {
            title,
            content,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });
        return docRef.id;
    }
};
