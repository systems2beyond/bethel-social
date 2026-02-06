import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    arrayUnion
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LifeEvent, FirestoreUser } from '@/types';

const LIFE_EVENTS_COLLECTION = 'lifeEvents';
const USERS_COLLECTION = 'users';

export class LifeEventService {
    /**
     * Get all life events for a church (active only by default)
     */
    static async getLifeEvents(churchId?: string, activeOnly: boolean = true): Promise<LifeEvent[]> {
        let q;
        if (churchId) {
            q = activeOnly
                ? query(
                    collection(db, LIFE_EVENTS_COLLECTION),
                    where('churchId', '==', churchId),
                    where('isActive', '==', true),
                    orderBy('createdAt', 'desc')
                )
                : query(
                    collection(db, LIFE_EVENTS_COLLECTION),
                    where('churchId', '==', churchId),
                    orderBy('createdAt', 'desc')
                );
        } else {
            q = activeOnly
                ? query(
                    collection(db, LIFE_EVENTS_COLLECTION),
                    where('isActive', '==', true),
                    orderBy('createdAt', 'desc')
                )
                : query(
                    collection(db, LIFE_EVENTS_COLLECTION),
                    orderBy('createdAt', 'desc')
                );
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeEvent));
    }

    /**
     * Get life events for a specific member
     */
    static async getMemberLifeEvents(memberId: string): Promise<LifeEvent[]> {
        const q = query(
            collection(db, LIFE_EVENTS_COLLECTION),
            where('memberId', '==', memberId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeEvent));
    }

    /**
     * Get a single life event
     */
    static async getLifeEvent(eventId: string): Promise<LifeEvent | null> {
        const docRef = doc(db, LIFE_EVENTS_COLLECTION, eventId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as LifeEvent : null;
    }

    /**
     * Create a new life event
     */
    static async createLifeEvent(
        event: Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
        createdBy: string
    ): Promise<string> {
        // Build the document data, excluding undefined fields
        const eventData: Record<string, unknown> = {
            memberId: event.memberId,
            memberName: event.memberName,
            eventType: event.eventType,
            eventDate: event.eventDate,
            description: event.description || '',
            priority: event.priority || 'normal',
            requiresFollowUp: event.requiresFollowUp ?? false,
            status: event.status || 'new',
            isActive: event.isActive ?? true,
            createdBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Only add optional fields if they have values
        if (event.assignedTo) {
            eventData.assignedTo = event.assignedTo;
        }
        if (event.actions && event.actions.length > 0) {
            eventData.actions = event.actions;
        }

        // Create the life event document
        const docRef = await addDoc(collection(db, LIFE_EVENTS_COLLECTION), eventData);

        // Update user's lifeEvents array for quick access in table
        try {
            const userRef = doc(db, USERS_COLLECTION, event.memberId);
            await updateDoc(userRef, {
                lifeEvents: arrayUnion({
                    eventId: docRef.id,
                    eventType: event.eventType,
                    isActive: true,
                    priority: event.priority
                })
            });
        } catch (error) {
            console.error('Failed to update user lifeEvents array:', error);
            // Don't throw - the life event was still created
        }

        return docRef.id;
    }

    /**
     * Update a life event
     */
    static async updateLifeEvent(eventId: string, updates: Partial<LifeEvent>): Promise<void> {
        const docRef = doc(db, LIFE_EVENTS_COLLECTION, eventId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Resolve/close a life event
     */
    static async resolveLifeEvent(eventId: string, memberId: string): Promise<void> {
        // Update the life event
        const eventRef = doc(db, LIFE_EVENTS_COLLECTION, eventId);
        await updateDoc(eventRef, {
            isActive: false,
            status: 'resolved',
            updatedAt: serverTimestamp()
        });

        // Update user's lifeEvents array - need to read, modify, write back
        try {
            const userRef = doc(db, USERS_COLLECTION, memberId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data() as FirestoreUser;
                const updatedLifeEvents = (userData.lifeEvents || []).map(le =>
                    le.eventId === eventId ? { ...le, isActive: false } : le
                );
                await updateDoc(userRef, { lifeEvents: updatedLifeEvents });
            }
        } catch (error) {
            console.error('Failed to update user lifeEvents array:', error);
        }
    }

    /**
     * Add a care action to a life event
     */
    static async addCareAction(
        eventId: string,
        action: {
            actionType: 'phone_call' | 'visit' | 'card_sent' | 'meal_delivered' | 'prayer';
            performedBy: string;
            notes: string;
        }
    ): Promise<void> {
        const eventRef = doc(db, LIFE_EVENTS_COLLECTION, eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) throw new Error('Life event not found');

        const eventData = eventSnap.data() as LifeEvent;
        const actions = eventData.actions || [];

        await updateDoc(eventRef, {
            actions: [...actions, { ...action, date: serverTimestamp() }],
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Get urgent/high priority life events
     */
    static async getUrgentLifeEvents(): Promise<LifeEvent[]> {
        const q = query(
            collection(db, LIFE_EVENTS_COLLECTION),
            where('isActive', '==', true),
            where('priority', 'in', ['urgent', 'high']),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeEvent));
    }
}
