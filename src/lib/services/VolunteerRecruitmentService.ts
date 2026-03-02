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
    onSnapshot,
    serverTimestamp,
    Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VolunteerSignup, VolunteerSignupStatus } from '@/types';

const COLLECTION = 'volunteerSignups';

export const VolunteerRecruitmentService = {
    /**
     * Create a new volunteer signup (from public form or manual entry)
     */
    async createSignup(
        signupData: Omit<VolunteerSignup, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        // Filter out undefined values to prevent Firestore errors
        const cleanedData = Object.fromEntries(
            Object.entries(signupData).filter(([_, value]) => value !== undefined)
        );

        const docRef = await addDoc(collection(db, COLLECTION), {
            ...cleanedData,
            status: signupData.status || 'new',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Get a single signup by ID
     */
    async getSignup(signupId: string): Promise<VolunteerSignup | null> {
        const docRef = doc(db, COLLECTION, signupId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as VolunteerSignup;
    },

    /**
     * Get all signups for a church
     */
    async getChurchSignups(
        churchId: string,
        statusFilter?: VolunteerSignupStatus
    ): Promise<VolunteerSignup[]> {
        let q;
        if (statusFilter) {
            q = query(
                collection(db, COLLECTION),
                where('churchId', '==', churchId),
                where('status', '==', statusFilter),
                orderBy('createdAt', 'desc')
            );
        } else {
            q = query(
                collection(db, COLLECTION),
                where('churchId', '==', churchId),
                orderBy('createdAt', 'desc')
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as VolunteerSignup[];
    },

    /**
     * Subscribe to real-time updates for church signups
     */
    subscribeToChurchSignups(
        churchId: string,
        callback: (signups: VolunteerSignup[]) => void
    ): Unsubscribe {
        const q = query(
            collection(db, COLLECTION),
            where('churchId', '==', churchId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const signups = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as VolunteerSignup[];
            callback(signups);
        });
    },

    /**
     * Update signup status (pipeline movement)
     */
    async updateStatus(
        signupId: string,
        newStatus: VolunteerSignupStatus,
        reviewedBy?: string,
        reviewedByName?: string
    ): Promise<void> {
        const docRef = doc(db, COLLECTION, signupId);
        const updates: Record<string, any> = {
            status: newStatus,
            updatedAt: serverTimestamp()
        };

        if (reviewedBy) {
            updates.reviewedBy = reviewedBy;
            updates.reviewedByName = reviewedByName || '';
            updates.reviewedAt = serverTimestamp();
        }

        await updateDoc(docRef, updates);
    },

    /**
     * Update signup details (edit form)
     */
    async updateSignup(
        signupId: string,
        updates: Partial<Omit<VolunteerSignup, 'id' | 'createdAt'>>
    ): Promise<void> {
        const docRef = doc(db, COLLECTION, signupId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Mark as placed in a ministry
     */
    async markAsPlaced(
        signupId: string,
        ministryId: string,
        ministryName: string,
        reviewedBy: string,
        reviewedByName: string
    ): Promise<void> {
        const docRef = doc(db, COLLECTION, signupId);
        await updateDoc(docRef, {
            status: 'placed',
            assignedMinistryId: ministryId,
            assignedMinistryName: ministryName,
            reviewedBy,
            reviewedByName,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Add or update notes on a signup
     */
    async updateNotes(signupId: string, notes: string): Promise<void> {
        const docRef = doc(db, COLLECTION, signupId);
        await updateDoc(docRef, {
            notes,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Update background check status
     */
    async updateBackgroundCheck(
        signupId: string,
        status: 'not_started' | 'pending' | 'approved' | 'expired'
    ): Promise<void> {
        const docRef = doc(db, COLLECTION, signupId);
        const updates: Record<string, any> = {
            backgroundCheckStatus: status,
            updatedAt: serverTimestamp()
        };

        if (status === 'approved') {
            updates.backgroundCheckDate = serverTimestamp();
        }

        await updateDoc(docRef, updates);
    },

    /**
     * Delete a signup (permanent)
     */
    async deleteSignup(signupId: string): Promise<void> {
        const docRef = doc(db, COLLECTION, signupId);
        await deleteDoc(docRef);
    },

    /**
     * Get signup counts by status for a church (for dashboard stats)
     */
    async getStatusCounts(churchId: string): Promise<Record<VolunteerSignupStatus, number>> {
        const signups = await this.getChurchSignups(churchId);
        const counts: Record<VolunteerSignupStatus, number> = {
            new: 0,
            contacted: 0,
            screening: 0,
            approved: 0,
            placed: 0,
            declined: 0
        };

        signups.forEach(signup => {
            if (counts[signup.status] !== undefined) {
                counts[signup.status]++;
            }
        });

        return counts;
    },

    /**
     * Link signup to a user account (when they create one)
     */
    async linkToUser(signupId: string, userId: string): Promise<void> {
        const docRef = doc(db, COLLECTION, signupId);
        await updateDoc(docRef, {
            linkedUserId: userId,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Check if email already has a signup for this church
     */
    async checkExistingSignup(churchId: string, email: string): Promise<VolunteerSignup | null> {
        const q = query(
            collection(db, COLLECTION),
            where('churchId', '==', churchId),
            where('email', '==', email.toLowerCase())
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as VolunteerSignup;
    }
};
