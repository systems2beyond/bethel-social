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
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PersonalTask } from '@/types';

const COLLECTION = 'personalTasks';

export class PersonalTaskService {
    /**
     * Create a new personal task
     */
    static async createTask(
        data: Omit<PersonalTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>
    ): Promise<string> {
        const docRef = await addDoc(collection(db, COLLECTION), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    }

    /**
     * Get a single task by ID
     */
    static async getTask(taskId: string): Promise<PersonalTask | null> {
        const docRef = doc(db, COLLECTION, taskId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as PersonalTask;
    }

    /**
     * Get all tasks for a user
     */
    static async getUserTasks(
        userId: string,
        includeArchived: boolean = false
    ): Promise<PersonalTask[]> {
        let q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId),
            where('isArchived', '==', includeArchived),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as PersonalTask[];
    }

    /**
     * Get tasks due soon (within next 7 days)
     */
    static async getTasksDueSoon(userId: string): Promise<PersonalTask[]> {
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId),
            where('isArchived', '==', false),
            where('dueDate', '>=', Timestamp.fromDate(now)),
            where('dueDate', '<=', Timestamp.fromDate(nextWeek)),
            orderBy('dueDate', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as PersonalTask[];
    }

    /**
     * Subscribe to user's tasks (real-time updates)
     */
    static subscribeToUserTasks(
        userId: string,
        callback: (tasks: PersonalTask[]) => void,
        includeArchived: boolean = false
    ): () => void {
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId),
            where('isArchived', '==', includeArchived),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PersonalTask[];
            callback(tasks);
        });
    }

    /**
     * Update a task
     */
    static async updateTask(
        taskId: string,
        updates: Partial<PersonalTask>
    ): Promise<void> {
        const docRef = doc(db, COLLECTION, taskId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Update task status
     */
    static async updateTaskStatus(
        taskId: string,
        status: 'todo' | 'in_progress' | 'done'
    ): Promise<void> {
        const updates: any = {
            status,
            updatedAt: serverTimestamp()
        };

        if (status === 'done') {
            updates.completedAt = serverTimestamp();
        } else {
            updates.completedAt = null;
        }

        const docRef = doc(db, COLLECTION, taskId);
        await updateDoc(docRef, updates);
    }

    /**
     * Delete a task
     */
    static async deleteTask(taskId: string): Promise<void> {
        const docRef = doc(db, COLLECTION, taskId);
        await deleteDoc(docRef);
    }

    /**
     * Archive a task (soft delete)
     */
    static async archiveTask(taskId: string): Promise<void> {
        const docRef = doc(db, COLLECTION, taskId);
        await updateDoc(docRef, {
            isArchived: true,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Unarchive a task
     */
    static async unarchiveTask(taskId: string): Promise<void> {
        const docRef = doc(db, COLLECTION, taskId);
        await updateDoc(docRef, {
            isArchived: false,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Get task counts by status for a user
     */
    static async getTaskCounts(userId: string): Promise<{
        todo: number;
        inProgress: number;
        done: number;
        total: number;
    }> {
        const tasks = await this.getUserTasks(userId, false);
        return {
            todo: tasks.filter(t => t.status === 'todo').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            done: tasks.filter(t => t.status === 'done').length,
            total: tasks.length
        };
    }

    /**
     * Bulk update task status
     */
    static async bulkUpdateStatus(
        taskIds: string[],
        status: 'todo' | 'in_progress' | 'done'
    ): Promise<void> {
        const promises = taskIds.map(id => this.updateTaskStatus(id, status));
        await Promise.all(promises);
    }

    /**
     * Bulk delete tasks
     */
    static async bulkDelete(taskIds: string[]): Promise<void> {
        const promises = taskIds.map(id => this.deleteTask(id));
        await Promise.all(promises);
    }

    /**
     * Get overdue tasks
     */
    static async getOverdueTasks(userId: string): Promise<PersonalTask[]> {
        const now = new Date();

        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId),
            where('isArchived', '==', false),
            where('dueDate', '<', Timestamp.fromDate(now)),
            orderBy('dueDate', 'asc')
        );

        const snapshot = await getDocs(q);
        // Filter out completed tasks in memory since we can't combine inequality with status
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }) as PersonalTask)
            .filter(task => task.status !== 'done');
    }
}
