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
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...eventData,
                status: eventData.status || 'draft',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    },

    async updateEvent(id: string, updates: Partial<Event>) {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
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
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Event));
        } catch (error) {
            console.error('Error fetching events:', error);
            throw error; // Propagate error for UI handling
        }
    }
};
