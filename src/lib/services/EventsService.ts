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
import { Event, EventRegistration, SuggestedEvent } from '../../types';

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
            let q = query(collection(db, COLLECTION_NAME), orderBy('startDate', 'desc')); // Order by event date ideally
            const snapshot = await getDocs(q);

            const events = snapshot.docs.map(doc => {
                const data = doc.data();
                // Helper to date fix
                const fixDate = (val: any) => {
                    if (!val) return null;
                    if (val.toDate && typeof val.toDate === 'function') return val;
                    if (typeof val === 'object' && typeof val.seconds === 'number') {
                        return new Timestamp(val.seconds, val.nanoseconds || 0);
                    }
                    if (typeof val === 'string') {
                        try { return Timestamp.fromDate(new Date(val)); } catch (e) { return null; }
                    }
                    return null;
                };

                return {
                    id: doc.id,
                    ...data,
                    startDate: fixDate(data.startDate || data.date),
                    endDate: fixDate(data.endDate),
                    createdAt: fixDate(data.createdAt),
                    updatedAt: fixDate(data.updatedAt)
                } as Event;
            });

            if (includeDrafts) return events;
            return events.filter(e => e.status === 'published');
        } catch (error) {
            console.error('Error fetching all events:', error);
            throw error;
        }
    },

    async registerForEvent(registrationData: Omit<EventRegistration, 'id'>) {
        try {
            const registrationsRef = collection(db, COLLECTION_NAME, registrationData.eventId, 'registrations');
            const docRef = await addDoc(registrationsRef, registrationData);
            return docRef.id;
        } catch (error) {
            console.error('Error registering for event:', error);
            throw error;
        }
    },

    async getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
        try {
            const registrationsRef = collection(db, COLLECTION_NAME, eventId, 'registrations');
            const q = query(registrationsRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as EventRegistration));
        } catch (error) {
            console.error('Error fetching registrations:', error);
            throw error;
        }
    },

    async getSuggestedEvents(): Promise<SuggestedEvent[]> {
        try {
            const q = query(collection(db, 'suggested_events'), where('status', '==', 'pending'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SuggestedEvent));
        } catch (error) {
            console.error('Error getting suggested events:', error);
            return [];
        }
    },

    async rejectSuggestion(id: string) {
        await updateDoc(doc(db, 'suggested_events', id), { status: 'rejected' });
    },

    async approveSuggestion(suggestion: SuggestedEvent): Promise<string> {
        // Create draft event from suggestion
        const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
            title: suggestion.title,
            description: suggestion.description,
            startDate: suggestion.date,
            location: suggestion.location,
            media: suggestion.imageUrl ? [{ type: 'image', url: suggestion.imageUrl }] : [],
            imageUrl: suggestion.imageUrl,
            featuredGuests: [],
            status: 'draft',
            sourcePostId: suggestion.sourcePostId
        };

        const eventId = await this.createEvent(eventData);

        // Mark suggestion as approved
        await updateDoc(doc(db, 'suggested_events', suggestion.id), { status: 'approved' });

        return eventId;
    }
};

