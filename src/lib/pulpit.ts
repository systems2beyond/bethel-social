import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import {
    PulpitSession,
    PulpitCheckIn,
    PulpitAlert,
    ServiceVolunteerSlot,
    Ministry
} from '@/types';

// Collection references
const PULPIT_SESSIONS = 'pulpit_sessions';
const PULPIT_CHECKINS = 'pulpit_checkins';
const PULPIT_ALERTS = 'pulpit_alerts';
const VOLUNTEER_SLOTS = 'volunteer_slots';
const MINISTRIES = 'ministries';

export const PulpitService = {
    // =========================================
    // PULPIT SESSIONS
    // =========================================

    /**
     * Create a new pulpit session (service/event with teleprompter)
     */
    createSession: async (
        churchId: string,
        data: Omit<PulpitSession, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
        userId: string
    ): Promise<string> => {
        const sessionsRef = collection(db, PULPIT_SESSIONS);
        const newSession = {
            ...data,
            churchId,
            createdBy: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(sessionsRef, newSession);
        return docRef.id;
    },

    /**
     * Get a single session by ID
     */
    getSession: async (sessionId: string): Promise<PulpitSession | null> => {
        const docRef = doc(db, PULPIT_SESSIONS, sessionId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as PulpitSession;
    },

    /**
     * Update session (sermon notes, status, settings)
     */
    updateSession: async (
        sessionId: string,
        updates: Partial<PulpitSession>
    ): Promise<void> => {
        const docRef = doc(db, PULPIT_SESSIONS, sessionId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Set session status (scheduled -> live -> completed)
     */
    setSessionStatus: async (
        sessionId: string,
        status: 'scheduled' | 'live' | 'completed'
    ): Promise<void> => {
        await PulpitService.updateSession(sessionId, { status });
    },

    /**
     * Get all sessions for a church
     */
    getSessionsByChurch: async (churchId: string): Promise<PulpitSession[]> => {
        const sessionsRef = collection(db, PULPIT_SESSIONS);
        const q = query(
            sessionsRef,
            where('churchId', '==', churchId),
            orderBy('date', 'desc'),
            limit(50)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PulpitSession));
    },

    /**
     * Subscribe to the current live session (real-time)
     */
    subscribeToLiveSession: (
        churchId: string,
        callback: (session: PulpitSession | null) => void
    ) => {
        const sessionsRef = collection(db, PULPIT_SESSIONS);
        const q = query(
            sessionsRef,
            where('churchId', '==', churchId),
            where('status', '==', 'live'),
            limit(1)
        );
        return onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                callback(null);
            } else {
                const doc = snapshot.docs[0];
                callback({ id: doc.id, ...doc.data() } as PulpitSession);
            }
        });
    },

    // =========================================
    // CHECK-INS (Real-time visitor feed)
    // =========================================

    /**
     * Record a check-in for the Pulpit Dashboard
     */
    createCheckIn: async (
        data: Omit<PulpitCheckIn, 'id' | 'checkInTime' | 'acknowledged'>
    ): Promise<string> => {
        const checkInsRef = collection(db, PULPIT_CHECKINS);
        const newCheckIn = {
            ...data,
            checkInTime: serverTimestamp(),
            acknowledged: false
        };
        const docRef = await addDoc(checkInsRef, newCheckIn);
        return docRef.id;
    },

    /**
     * Acknowledge a check-in (pastor has seen it)
     */
    acknowledgeCheckIn: async (
        checkInId: string,
        userId: string
    ): Promise<void> => {
        const docRef = doc(db, PULPIT_CHECKINS, checkInId);
        await updateDoc(docRef, {
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: serverTimestamp()
        });
    },

    /**
     * Subscribe to real-time check-ins for a session
     */
    subscribeToCheckIns: (
        sessionId: string,
        callback: (checkIns: PulpitCheckIn[]) => void
    ) => {
        const checkInsRef = collection(db, PULPIT_CHECKINS);
        const q = query(
            checkInsRef,
            where('sessionId', '==', sessionId),
            orderBy('checkInTime', 'desc'),
            limit(50)
        );
        return onSnapshot(q, (snapshot) => {
            const checkIns = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as PulpitCheckIn));
            callback(checkIns);
        });
    },

    /**
     * Get today's check-ins for a church (for dashboard stats)
     */
    getTodaysCheckIns: async (churchId: string): Promise<PulpitCheckIn[]> => {
        const checkInsRef = collection(db, PULPIT_CHECKINS);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        const q = query(
            checkInsRef,
            where('churchId', '==', churchId),
            where('checkInTime', '>=', todayTimestamp),
            orderBy('checkInTime', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PulpitCheckIn));
    },

    // =========================================
    // ALERTS (Pastor/Media team communication)
    // =========================================

    /**
     * Send an alert to the Pulpit Dashboard
     */
    createAlert: async (
        data: Omit<PulpitAlert, 'id' | 'createdAt' | 'acknowledged' | 'resolved'>
    ): Promise<string> => {
        const alertsRef = collection(db, PULPIT_ALERTS);
        const newAlert = {
            ...data,
            createdAt: serverTimestamp(),
            acknowledged: false,
            resolved: false
        };
        const docRef = await addDoc(alertsRef, newAlert);
        return docRef.id;
    },

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert: async (
        alertId: string,
        userId: string
    ): Promise<void> => {
        const docRef = doc(db, PULPIT_ALERTS, alertId);
        await updateDoc(docRef, {
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: serverTimestamp()
        });
    },

    /**
     * Resolve an alert
     */
    resolveAlert: async (alertId: string): Promise<void> => {
        const docRef = doc(db, PULPIT_ALERTS, alertId);
        await updateDoc(docRef, {
            resolved: true,
            resolvedAt: serverTimestamp()
        });
    },

    /**
     * Subscribe to real-time alerts for a session
     */
    subscribeToAlerts: (
        sessionId: string,
        callback: (alerts: PulpitAlert[]) => void
    ) => {
        const alertsRef = collection(db, PULPIT_ALERTS);
        const q = query(
            alertsRef,
            where('sessionId', '==', sessionId),
            where('resolved', '==', false),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        return onSnapshot(q, (snapshot) => {
            const alerts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as PulpitAlert));
            callback(alerts);
        });
    },

    // =========================================
    // VOLUNTEER SLOTS
    // =========================================

    /**
     * Create volunteer slots for a session
     */
    createVolunteerSlot: async (
        data: Omit<ServiceVolunteerSlot, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const slotsRef = collection(db, VOLUNTEER_SLOTS);
        const newSlot = {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(slotsRef, newSlot);
        return docRef.id;
    },

    /**
     * Assign a volunteer to a slot
     */
    assignVolunteer: async (
        slotId: string,
        userId: string,
        userName: string
    ): Promise<void> => {
        const docRef = doc(db, VOLUNTEER_SLOTS, slotId);
        await updateDoc(docRef, {
            assignedUserId: userId,
            assignedUserName: userName,
            status: 'filled',
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Update slot status (confirmed, no_show)
     */
    updateSlotStatus: async (
        slotId: string,
        status: 'open' | 'filled' | 'confirmed' | 'no_show'
    ): Promise<void> => {
        const docRef = doc(db, VOLUNTEER_SLOTS, slotId);
        await updateDoc(docRef, {
            status,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Get volunteer slots for a session
     */
    getSlotsBySession: async (sessionId: string): Promise<ServiceVolunteerSlot[]> => {
        const slotsRef = collection(db, VOLUNTEER_SLOTS);
        const q = query(
            slotsRef,
            where('sessionId', '==', sessionId),
            orderBy('ministry')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceVolunteerSlot));
    },

    // =========================================
    // MINISTRIES
    // =========================================

    /**
     * Create a new ministry
     */
    createMinistry: async (
        data: Omit<Ministry, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
        const ministriesRef = collection(db, MINISTRIES);
        const newMinistry = {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(ministriesRef, newMinistry);
        return docRef.id;
    },

    /**
     * Update a ministry
     */
    updateMinistry: async (
        ministryId: string,
        updates: Partial<Ministry>
    ): Promise<void> => {
        const docRef = doc(db, MINISTRIES, ministryId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Get all ministries for a church
     */
    getMinistriesByChurch: async (churchId: string): Promise<Ministry[]> => {
        const ministriesRef = collection(db, MINISTRIES);
        const q = query(
            ministriesRef,
            where('churchId', '==', churchId),
            where('active', '==', true),
            orderBy('name')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ministry));
    },

    /**
     * Subscribe to ministries (real-time)
     */
    subscribeToMinistries: (
        churchId: string,
        callback: (ministries: Ministry[]) => void
    ) => {
        const ministriesRef = collection(db, MINISTRIES);
        const q = query(
            ministriesRef,
            where('churchId', '==', churchId),
            where('active', '==', true),
            orderBy('name')
        );
        return onSnapshot(q, (snapshot) => {
            const ministries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Ministry));
            callback(ministries);
        });
    },

    // =========================================
    // UTILITY FUNCTIONS
    // =========================================

    /**
     * Initialize default ministries for a new church
     */
    initializeDefaultMinistries: async (churchId: string): Promise<void> => {
        const defaultMinistries = [
            { name: 'Worship Team', icon: 'Music', color: '#8B5CF6', roles: [
                { id: 'vocalist', name: 'Vocalist', requiresBackgroundCheck: false },
                { id: 'musician', name: 'Musician', requiresBackgroundCheck: false },
                { id: 'sound_tech', name: 'Sound Tech', requiresBackgroundCheck: false }
            ]},
            { name: 'Children\'s Ministry', icon: 'Baby', color: '#F59E0B', roles: [
                { id: 'teacher', name: 'Teacher', requiresBackgroundCheck: true, requiredTraining: ['child_safety'] },
                { id: 'helper', name: 'Helper', requiresBackgroundCheck: true, requiredTraining: ['child_safety'] }
            ]},
            { name: 'Hospitality', icon: 'Coffee', color: '#10B981', roles: [
                { id: 'greeter', name: 'Greeter', requiresBackgroundCheck: false },
                { id: 'usher', name: 'Usher', requiresBackgroundCheck: false },
                { id: 'refreshments', name: 'Refreshments', requiresBackgroundCheck: false }
            ]},
            { name: 'Media Team', icon: 'Video', color: '#3B82F6', roles: [
                { id: 'camera', name: 'Camera Operator', requiresBackgroundCheck: false },
                { id: 'slides', name: 'Slides/Lyrics', requiresBackgroundCheck: false },
                { id: 'livestream', name: 'Livestream', requiresBackgroundCheck: false }
            ]},
            { name: 'Security', icon: 'Shield', color: '#EF4444', roles: [
                { id: 'door_monitor', name: 'Door Monitor', requiresBackgroundCheck: true },
                { id: 'parking', name: 'Parking Lot', requiresBackgroundCheck: false }
            ]}
        ];

        for (const ministry of defaultMinistries) {
            await PulpitService.createMinistry({
                churchId,
                name: ministry.name,
                icon: ministry.icon,
                color: ministry.color,
                roles: ministry.roles as any,
                active: true
            });
        }
    }
};
