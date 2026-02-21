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
    writeBatch,
    Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MinistryRoadmap, RoadmapMilestone, MilestoneProgress, MinistryAssignment } from '@/types';

const ROADMAPS_COLLECTION = 'ministryRoadmaps';
const MILESTONES_COLLECTION = 'roadmapMilestones';
const ASSIGNMENTS_COLLECTION = 'ministryAssignments';

export const RoadmapService = {
    // ==========================================
    // ROADMAPS
    // ==========================================

    /**
     * Create a new roadmap for a ministry
     */
    async createRoadmap(
        roadmapData: Omit<MinistryRoadmap, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        const docRef = await addDoc(collection(db, ROADMAPS_COLLECTION), {
            ...roadmapData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Get a single roadmap by ID
     */
    async getRoadmap(roadmapId: string): Promise<MinistryRoadmap | null> {
        const docRef = doc(db, ROADMAPS_COLLECTION, roadmapId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as MinistryRoadmap;
    },

    /**
     * Get the active roadmap for a ministry (there should typically be one active)
     */
    async getActiveRoadmap(ministryId: string): Promise<MinistryRoadmap | null> {
        const q = query(
            collection(db, ROADMAPS_COLLECTION),
            where('ministryId', '==', ministryId),
            where('status', '==', 'active')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docSnap = snapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as MinistryRoadmap;
    },

    /**
     * Get all roadmaps for a ministry
     */
    async getMinistryRoadmaps(ministryId: string): Promise<MinistryRoadmap[]> {
        const q = query(
            collection(db, ROADMAPS_COLLECTION),
            where('ministryId', '==', ministryId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MinistryRoadmap));
    },

    /**
     * Subscribe to the active roadmap for a ministry
     */
    subscribeToActiveRoadmap(
        ministryId: string,
        callback: (roadmap: MinistryRoadmap | null) => void
    ): Unsubscribe {
        const q = query(
            collection(db, ROADMAPS_COLLECTION),
            where('ministryId', '==', ministryId),
            where('status', '==', 'active')
        );
        return onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                callback(null);
            } else {
                const docSnap = snapshot.docs[0];
                callback({ id: docSnap.id, ...docSnap.data() } as MinistryRoadmap);
            }
        });
    },

    /**
     * Update an existing roadmap
     */
    async updateRoadmap(
        roadmapId: string,
        updates: Partial<MinistryRoadmap>
    ): Promise<void> {
        const docRef = doc(db, ROADMAPS_COLLECTION, roadmapId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Delete a roadmap and all its milestones
     */
    async deleteRoadmap(roadmapId: string): Promise<void> {
        // First delete all milestones
        const milestones = await this.getRoadmapMilestones(roadmapId);
        const batch = writeBatch(db);

        milestones.forEach(milestone => {
            const milestoneRef = doc(db, MILESTONES_COLLECTION, milestone.id);
            batch.delete(milestoneRef);
        });

        // Delete the roadmap
        const roadmapRef = doc(db, ROADMAPS_COLLECTION, roadmapId);
        batch.delete(roadmapRef);

        await batch.commit();
    },

    // ==========================================
    // MILESTONES
    // ==========================================

    /**
     * Create a new milestone within a roadmap
     */
    async createMilestone(
        milestoneData: Omit<RoadmapMilestone, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        const docRef = await addDoc(collection(db, MILESTONES_COLLECTION), {
            ...milestoneData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Get a single milestone by ID
     */
    async getMilestone(milestoneId: string): Promise<RoadmapMilestone | null> {
        const docRef = doc(db, MILESTONES_COLLECTION, milestoneId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as RoadmapMilestone;
    },

    /**
     * Get all milestones for a roadmap
     */
    async getRoadmapMilestones(roadmapId: string): Promise<RoadmapMilestone[]> {
        const q = query(
            collection(db, MILESTONES_COLLECTION),
            where('roadmapId', '==', roadmapId),
            orderBy('order', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoadmapMilestone));
    },

    /**
     * Subscribe to milestones for a roadmap (real-time)
     */
    subscribeToMilestones(
        roadmapId: string,
        callback: (milestones: RoadmapMilestone[]) => void
    ): Unsubscribe {
        const q = query(
            collection(db, MILESTONES_COLLECTION),
            where('roadmapId', '==', roadmapId),
            orderBy('order', 'asc')
        );
        return onSnapshot(q, (snapshot) => {
            const milestones = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as RoadmapMilestone));
            callback(milestones);
        });
    },

    /**
     * Update an existing milestone
     */
    async updateMilestone(
        milestoneId: string,
        updates: Partial<RoadmapMilestone>
    ): Promise<void> {
        const docRef = doc(db, MILESTONES_COLLECTION, milestoneId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Delete a milestone
     */
    async deleteMilestone(milestoneId: string): Promise<void> {
        // Note: Tasks linked to this milestone will retain milestoneId but orphaned
        // Could optionally clear milestoneId from linked tasks here
        const docRef = doc(db, MILESTONES_COLLECTION, milestoneId);
        await deleteDoc(docRef);
    },

    /**
     * Reorder milestones (update order field for each)
     */
    async reorderMilestones(milestoneIds: string[]): Promise<void> {
        const batch = writeBatch(db);
        milestoneIds.forEach((id, index) => {
            const milestoneRef = doc(db, MILESTONES_COLLECTION, id);
            batch.update(milestoneRef, {
                order: index,
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
    },

    // ==========================================
    // PROGRESS CALCULATION
    // ==========================================

    /**
     * Get progress for a single milestone (tasks linked to it)
     */
    async getMilestoneProgress(milestoneId: string): Promise<MilestoneProgress> {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('milestoneId', '==', milestoneId),
            where('isArchived', '==', false)
        );
        const snapshot = await getDocs(q);

        const tasks = snapshot.docs.map(doc => doc.data() as MinistryAssignment);
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
            milestoneId,
            totalTasks,
            completedTasks,
            percent
        };
    },

    /**
     * Get progress for all milestones in a roadmap
     */
    async getRoadmapProgress(roadmapId: string): Promise<MilestoneProgress[]> {
        const milestones = await this.getRoadmapMilestones(roadmapId);
        const progressPromises = milestones.map(m => this.getMilestoneProgress(m.id));
        return Promise.all(progressPromises);
    },

    /**
     * Get tasks linked to a milestone
     */
    async getMilestoneTasks(milestoneId: string): Promise<MinistryAssignment[]> {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('milestoneId', '==', milestoneId),
            where('isArchived', '==', false),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MinistryAssignment));
    },

    /**
     * Link a task to a milestone
     */
    async linkTaskToMilestone(taskId: string, milestoneId: string): Promise<void> {
        const taskRef = doc(db, ASSIGNMENTS_COLLECTION, taskId);
        await updateDoc(taskRef, {
            milestoneId,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Unlink a task from its milestone
     */
    async unlinkTaskFromMilestone(taskId: string): Promise<void> {
        const taskRef = doc(db, ASSIGNMENTS_COLLECTION, taskId);
        await updateDoc(taskRef, {
            milestoneId: null,
            updatedAt: serverTimestamp()
        });
    }
};
