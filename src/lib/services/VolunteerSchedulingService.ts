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
    writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MinistryService, VolunteerSchedule } from '@/types';

const SERVICES_COLLECTION = 'ministryServices';
const SCHEDULES_COLLECTION = 'volunteerSchedules';

export const VolunteerSchedulingService = {
    // ==========================================
    // SERVICES (Events requiring volunteers)
    // ==========================================

    /**
     * Create a new service event for a ministry
     */
    async createService(
        serviceData: Omit<MinistryService, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        const docRef = await addDoc(collection(db, SERVICES_COLLECTION), {
            ...serviceData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Get a single service by ID
     */
    async getService(serviceId: string): Promise<MinistryService | null> {
        const docRef = doc(db, SERVICES_COLLECTION, serviceId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as MinistryService;
    },

    /**
     * Update an existing service
     */
    async updateService(
        serviceId: string,
        updates: Partial<MinistryService>
    ): Promise<void> {
        const docRef = doc(db, SERVICES_COLLECTION, serviceId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Delete a service and all its associated volunteer schedules
     */
    async deleteService(serviceId: string): Promise<void> {
        // First delete schedules
        const schedules = await this.getServiceSchedules(serviceId);
        const batch = writeBatch(db);

        schedules.forEach(schedule => {
            const scheduleRef = doc(db, SCHEDULES_COLLECTION, schedule.id);
            batch.delete(scheduleRef);
        });

        // Delete the service itself
        const serviceRef = doc(db, SERVICES_COLLECTION, serviceId);
        batch.delete(serviceRef);

        await batch.commit();
    },

    /**
     * Subscribe to real-time updates for a ministry's services
     */
    subscribeToMinistryServices(
        ministryId: string,
        callback: (services: MinistryService[]) => void
    ): () => void {
        const q = query(
            collection(db, SERVICES_COLLECTION),
            where('ministryId', '==', ministryId),
            orderBy('date', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const services = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MinistryService[];
            callback(services);
        });
    },

    // ==========================================
    // VOLUNTEER SCHEDULES (Individual Assignments)
    // ==========================================

    /**
     * Assign a volunteer to a service role
     */
    async createSchedule(
        scheduleData: Omit<VolunteerSchedule, 'id' | 'createdAt' | 'statusUpdatedAt'>
    ): Promise<string> {
        const docRef = await addDoc(collection(db, SCHEDULES_COLLECTION), {
            ...scheduleData,
            status: scheduleData.status || 'pending',
            createdAt: serverTimestamp(),
            statusUpdatedAt: null
        });
        return docRef.id;
    },

    /**
     * Update a volunteer's schedule status (accept/decline)
     */
    async updateScheduleStatus(
        scheduleId: string,
        newStatus: 'pending' | 'accepted' | 'declined',
        notes?: string
    ): Promise<void> {
        const docRef = doc(db, SCHEDULES_COLLECTION, scheduleId);
        const updates: any = {
            status: newStatus,
            statusUpdatedAt: serverTimestamp()
        };
        if (notes !== undefined) {
            updates.notes = notes;
        }

        await updateDoc(docRef, updates);
    },

    /**
     * Remove a volunteer from a schedule entirely
     */
    async deleteSchedule(scheduleId: string): Promise<void> {
        const docRef = doc(db, SCHEDULES_COLLECTION, scheduleId);
        await deleteDoc(docRef);
    },

    /**
     * Subscribe to all scheduled volunteers for a specific service
     */
    subscribeToServiceSchedules(
        serviceId: string,
        callback: (schedules: VolunteerSchedule[]) => void
    ): () => void {
        const q = query(
            collection(db, SCHEDULES_COLLECTION),
            where('serviceId', '==', serviceId)
        );

        return onSnapshot(q, (snapshot) => {
            const schedules = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as VolunteerSchedule[];
            callback(schedules);
        });
    },

    /**
     * Get all schedules for a specific service (one-time fetch)
     */
    async getServiceSchedules(serviceId: string): Promise<VolunteerSchedule[]> {
        const q = query(
            collection(db, SCHEDULES_COLLECTION),
            where('serviceId', '==', serviceId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as VolunteerSchedule[];
    },

    /**
     * Subscribe to a user's upcoming schedules (across all ministries)
     */
    subscribeToMySchedules(
        userId: string,
        callback: (schedules: VolunteerSchedule[]) => void
    ): () => void {
        // Note: we might want to filter out past dates in the UI or via complex querying if we add a denormalized date field here.
        // For now, getting all of theirs and filtering/sorting locally is okay for moderate lists.
        const q = query(
            collection(db, SCHEDULES_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const schedules = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as VolunteerSchedule[];
            callback(schedules);
        });
    }
};
