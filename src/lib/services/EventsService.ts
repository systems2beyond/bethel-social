import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase'; // Adjust import path if needed
import { Event } from '../../types';

const COLLECTION_NAME = 'events';

export const EventsService = {
    async createEvent(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) {
        try {
            const auth = (await import('../../lib/firebase')).auth;
            const token = await auth.currentUser?.getIdToken();

            if (!token) throw new Error('User not authenticated');

            const response = await fetch('/api/saveEvent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ event: eventData })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create event');
            }

            const result = await response.json();
            return result.id;
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    },

    async updateEvent(id: string, updates: Partial<Event>) {
        try {
            const auth = (await import('../../lib/firebase')).auth;
            const token = await auth.currentUser?.getIdToken();

            if (!token) throw new Error('User not authenticated');

            const response = await fetch('/api/saveEvent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ eventId: id, event: updates })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update event');
            }
        } catch (error) {
            console.error('Error updating event:', error);
            throw error;
        }
    },

    async deleteEvent(id: string) {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    },

    async getEvent(id: string): Promise<Event | null> {
        try {
            const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
            if (docSnap.exists()) {
                const data = docSnap.data();
                return { id: docSnap.id, ...data } as Event;
            }
            return null;
        } catch (error) {
            console.error('Error fetching event:', error);
            throw error;
        }
    },

    async getAllEvents(includeDrafts = false): Promise<Event[]> {
        try {
            let q = query(
                collection(db, COLLECTION_NAME),
                orderBy('startDate', 'asc')
            );

            if (!includeDrafts) {
                q = query(q, where('status', 'in', ['published']));
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => {
                const data = doc.data();
                const fixDate = (val: any) => {
                    if (!val) return null;
                    if (val.toDate && typeof val.toDate === 'function') return val;
                    if (typeof val === 'object' && typeof val.seconds === 'number') {
                        return new Timestamp(val.seconds, val.nanoseconds || 0);
                    }
                    if (typeof val === 'string') {
                        try { return Timestamp.fromDate(new Date(val)); } catch (e) { return null; }
                    }
                    return val;
                };

                const startDate = fixDate(data.startDate);
                const endDate = fixDate(data.endDate);

                return {
                    id: doc.id,
                    ...data,
                    startDate,
                    endDate,
                } as Event;
            });
        } catch (error) {
            console.error('Error fetching events:', error);
            throw error; // Propagate error for UI handling
        }
    }
};
