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
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MinistryAssignment, MinistryAssignmentStatus } from '@/types';

const ASSIGNMENTS_COLLECTION = 'ministryAssignments';

export const MinistryAssignmentService = {
    /**
     * Create a new assignment
     */
    async createAssignment(
        assignmentData: Omit<MinistryAssignment, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        const docRef = await addDoc(collection(db, ASSIGNMENTS_COLLECTION), {
            ...assignmentData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Get a single assignment by ID
     */
    async getAssignment(assignmentId: string): Promise<MinistryAssignment | null> {
        const docRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as MinistryAssignment;
    },

    /**
     * Get all assignments for a ministry
     */
    async getMinistryAssignments(
        ministryId: string,
        includeArchived: boolean = false
    ): Promise<MinistryAssignment[]> {
        let q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('ministryId', '==', ministryId),
            orderBy('createdAt', 'desc')
        );

        if (!includeArchived) {
            q = query(
                collection(db, ASSIGNMENTS_COLLECTION),
                where('ministryId', '==', ministryId),
                where('isArchived', '==', false),
                orderBy('createdAt', 'desc')
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as MinistryAssignment[];
    },

    /**
     * Get all assignments for a user (My Tasks)
     */
    async getMyAssignments(userId: string): Promise<MinistryAssignment[]> {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('assignedToId', '==', userId),
            where('isArchived', '==', false),
            orderBy('dueDate', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as MinistryAssignment[];
    },

    /**
     * Subscribe to real-time updates for a ministry's assignments
     */
    subscribeToMinistryAssignments(
        ministryId: string,
        callback: (assignments: MinistryAssignment[]) => void
    ): () => void {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('ministryId', '==', ministryId),
            where('isArchived', '==', false),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const assignments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MinistryAssignment[];
            callback(assignments);
        });
    },

    /**
     * Subscribe to real-time updates for a user's assignments
     */
    subscribeToMyAssignments(
        userId: string,
        callback: (assignments: MinistryAssignment[]) => void
    ): () => void {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('assignedToId', '==', userId),
            where('isArchived', '==', false)
        );

        return onSnapshot(q, (snapshot) => {
            const assignments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MinistryAssignment[];
            callback(assignments);
        });
    },

    /**
     * Update an assignment
     */
    async updateAssignment(
        assignmentId: string,
        updates: Partial<MinistryAssignment>
    ): Promise<void> {
        const docRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Update assignment status (with optional completion tracking)
     */
    async updateAssignmentStatus(
        assignmentId: string,
        newStatus: MinistryAssignmentStatus,
        userId: string
    ): Promise<void> {
        const updates: Partial<MinistryAssignment> = {
            status: newStatus,
            updatedAt: serverTimestamp() as any
        };

        // Track completion
        if (newStatus === 'completed') {
            updates.completedAt = serverTimestamp() as any;
            updates.completedBy = userId;
        }

        const docRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentId);
        await updateDoc(docRef, updates);
    },

    /**
     * Delete (archive) an assignment
     */
    async deleteAssignment(assignmentId: string): Promise<void> {
        const docRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentId);
        await updateDoc(docRef, {
            isArchived: true,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Permanently delete an assignment
     */
    async permanentlyDeleteAssignment(assignmentId: string): Promise<void> {
        const docRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentId);
        await deleteDoc(docRef);
    },

    /**
     * Send notification to assignee
     */
    async notifyAssignee(
        assignment: MinistryAssignment,
        actionType: 'assigned' | 'status_changed' | 'due_soon',
        fromUser: { uid: string; displayName: string; photoURL?: string }
    ): Promise<void> {
        if (!assignment.assignedToId) return;

        const messageMap = {
            'assigned': `${fromUser.displayName} assigned you: ${assignment.title}`,
            'status_changed': `Task "${assignment.title}" status updated to ${assignment.status}`,
            'due_soon': `Task "${assignment.title}" is due soon`
        };

        const titleMap = {
            'assigned': 'New Task Assigned',
            'status_changed': 'Task Updated',
            'due_soon': 'Task Due Soon'
        };

        await addDoc(collection(db, 'notifications'), {
            toUserId: assignment.assignedToId,
            fromUser: {
                uid: fromUser.uid,
                displayName: fromUser.displayName,
                photoURL: fromUser.photoURL || null
            },
            type: 'ministry_assignment',
            title: titleMap[actionType],
            message: messageMap[actionType],
            resourceType: 'assignment',
            resourceId: assignment.id,
            ministryId: assignment.ministryId,
            read: false,
            viewed: false,
            createdAt: serverTimestamp()
        });
    },

    /**
     * Post assignment to ministry group
     */
    async postToMinistryGroup(
        assignment: MinistryAssignment,
        groupId: string,
        author: { name: string; avatarUrl?: string; uid: string }
    ): Promise<string> {
        const content = `**New Assignment**: ${assignment.title}${assignment.description ? `\n\n${assignment.description}` : ''}`;

        const postRef = await addDoc(collection(db, 'groups', groupId, 'posts'), {
            content,
            author: {
                ...author,
                avatarUrl: author.avatarUrl || null
            },
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
            isPinned: false,
            metadata: {
                type: 'ministry_assignment',
                assignmentId: assignment.id,
                assignedToId: assignment.assignedToId,
                assignedToName: assignment.assignedToName,
                dueDate: assignment.dueDate,
                priority: assignment.priority,
                status: assignment.status
            }
        });

        // Update assignment with linked post ID
        await this.updateAssignment(assignment.id, {
            linkedGroupPostId: postRef.id
        });

        return postRef.id;
    },

    /**
     * Create DM conversation for assignment
     */
    async createDMThread(
        assignment: MinistryAssignment,
        fromUser: { uid: string; displayName: string; photoURL?: string }
    ): Promise<string> {
        if (!assignment.assignedToId) {
            throw new Error('Assignment has no assignee');
        }

        // Check for existing conversation
        const q = query(
            collection(db, 'direct_messages'),
            where('participants', 'array-contains', fromUser.uid)
        );
        const snapshot = await getDocs(q);
        const existingConv = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.participants.includes(assignment.assignedToId);
        });

        let conversationId: string;

        if (existingConv) {
            conversationId = existingConv.id;
        } else {
            // Create new conversation
            const newConv = await addDoc(collection(db, 'direct_messages'), {
                participants: [fromUser.uid, assignment.assignedToId],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessageTimestamp: serverTimestamp(),
                lastMessageAuthorId: fromUser.uid,
                lastMessage: 'Started a conversation'
            });
            conversationId = newConv.id;
        }

        // Add message about the assignment
        await addDoc(collection(db, 'direct_messages', conversationId, 'messages'), {
            conversationId,
            author: {
                id: fromUser.uid,
                name: fromUser.displayName,
                avatarUrl: fromUser.photoURL || null
            },
            content: `**Task Assigned**: ${assignment.title}${assignment.description ? `\n\n${assignment.description}` : ''}${assignment.dueDate ? `\n\nDue: ${new Date(assignment.dueDate.seconds * 1000).toLocaleDateString()}` : ''}`,
            type: 'task_assignment',
            metadata: {
                assignmentId: assignment.id,
                ministryId: assignment.ministryId
            },
            timestamp: Date.now()
        });

        // Update conversation meta
        await updateDoc(doc(db, 'direct_messages', conversationId), {
            lastMessage: `Task: ${assignment.title}`,
            lastMessageTimestamp: Date.now(),
            lastMessageAuthorId: fromUser.uid,
            updatedAt: serverTimestamp(),
            readBy: [fromUser.uid]
        });

        // Update assignment with DM conversation ID
        await this.updateAssignment(assignment.id, {
            dmConversationId: conversationId
        });

        return conversationId;
    },

    /**
     * Get assignments for a specific service session
     */
    async getAssignmentsByService(serviceId: string): Promise<MinistryAssignment[]> {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('serviceSessionId', '==', serviceId),
            where('isArchived', '==', false)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as MinistryAssignment[];
    },

    /**
     * Get assignments by status
     */
    async getAssignmentsByStatus(
        ministryId: string,
        status: MinistryAssignmentStatus
    ): Promise<MinistryAssignment[]> {
        const q = query(
            collection(db, ASSIGNMENTS_COLLECTION),
            where('ministryId', '==', ministryId),
            where('status', '==', status),
            where('isArchived', '==', false)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as MinistryAssignment[];
    },

    /**
     * Get overdue assignments
     */
    async getOverdueAssignments(ministryId?: string): Promise<MinistryAssignment[]> {
        const now = Timestamp.now();
        let q;

        if (ministryId) {
            q = query(
                collection(db, ASSIGNMENTS_COLLECTION),
                where('ministryId', '==', ministryId),
                where('dueDate', '<', now),
                where('status', '!=', 'completed'),
                where('isArchived', '==', false)
            );
        } else {
            q = query(
                collection(db, ASSIGNMENTS_COLLECTION),
                where('dueDate', '<', now),
                where('status', '!=', 'completed'),
                where('isArchived', '==', false)
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as MinistryAssignment[];
    },

    /**
     * Bulk update assignments (for drag-drop reordering or batch status changes)
     */
    async bulkUpdateStatus(
        assignmentIds: string[],
        newStatus: MinistryAssignmentStatus,
        userId: string
    ): Promise<void> {
        const batch = writeBatch(db);

        for (const id of assignmentIds) {
            const docRef = doc(db, ASSIGNMENTS_COLLECTION, id);
            const updates: any = {
                status: newStatus,
                updatedAt: serverTimestamp()
            };

            if (newStatus === 'completed') {
                updates.completedAt = serverTimestamp();
                updates.completedBy = userId;
            }

            batch.update(docRef, updates);
        }

        await batch.commit();
    }
};
