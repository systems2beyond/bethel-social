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
    serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MinistryPipelineBoard, MinistryPipelineStage, DEFAULT_MINISTRY_STAGES } from '@/types';

const BOARDS_COLLECTION = 'ministryPipelineBoards';

export const MinistryPipelineBoardService = {
    /**
     * Create a new pipeline board for a ministry
     */
    async createBoard(
        ministryId: string,
        churchId: string,
        name: string,
        stages: Omit<MinistryPipelineStage, 'id'>[] = DEFAULT_MINISTRY_STAGES,
        isDefault: boolean = true
    ): Promise<string> {
        // Assign IDs to stages
        const initializedStages: MinistryPipelineStage[] = stages.map((stage, index) => ({
            ...stage,
            id: crypto.randomUUID(),
            order: index
        }));

        const docRef = await addDoc(collection(db, BOARDS_COLLECTION), {
            ministryId,
            churchId,
            name,
            stages: initializedStages,
            isDefault,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return docRef.id;
    },

    /**
     * Get a pipeline board by ID
     */
    async getBoard(boardId: string): Promise<MinistryPipelineBoard | null> {
        const docRef = doc(db, BOARDS_COLLECTION, boardId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as MinistryPipelineBoard;
    },

    /**
     * Get the default board for a ministry
     */
    async getDefaultBoard(ministryId: string): Promise<MinistryPipelineBoard | null> {
        const q = query(
            collection(db, BOARDS_COLLECTION),
            where('ministryId', '==', ministryId),
            where('isDefault', '==', true)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as MinistryPipelineBoard;
    },

    /**
     * Get all boards for a ministry
     */
    async getMinistryBoards(ministryId: string): Promise<MinistryPipelineBoard[]> {
        const q = query(
            collection(db, BOARDS_COLLECTION),
            where('ministryId', '==', ministryId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as MinistryPipelineBoard[];
    },

    /**
     * Subscribe to boards for a ministry
     */
    subscribeToMinistryBoards(
        ministryId: string,
        callback: (boards: MinistryPipelineBoard[]) => void
    ): () => void {
        const q = query(
            collection(db, BOARDS_COLLECTION),
            where('ministryId', '==', ministryId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const boards = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MinistryPipelineBoard[];
            callback(boards);
        });
    },

    /**
     * Update a board
     */
    async updateBoard(
        boardId: string,
        updates: Partial<Omit<MinistryPipelineBoard, 'id' | 'createdAt' | 'stages'>>
    ): Promise<void> {
        const docRef = doc(db, BOARDS_COLLECTION, boardId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Delete a board
     */
    async deleteBoard(boardId: string): Promise<void> {
        const docRef = doc(db, BOARDS_COLLECTION, boardId);
        await deleteDoc(docRef);
    },

    /**
     * Initialize default board for a ministry (creates if doesn't exist)
     */
    async initializeDefaultBoard(ministryId: string, churchId: string, ministryName: string): Promise<string> {
        const existingBoard = await this.getDefaultBoard(ministryId);
        if (existingBoard) {
            return existingBoard.id;
        }

        return await this.createBoard(
            ministryId,
            churchId,
            `${ministryName} Tasks`,
            DEFAULT_MINISTRY_STAGES,
            true
        );
    },

    // ============== STAGE MANAGEMENT ==============

    /**
     * Add a stage to a board
     */
    async addStage(
        boardId: string,
        stageName: string,
        color: string,
        icon?: string,
        autoNotify: boolean = false
    ): Promise<string> {
        const board = await this.getBoard(boardId);
        if (!board) throw new Error('Board not found');

        const newStage: MinistryPipelineStage = {
            id: crypto.randomUUID(),
            name: stageName,
            color,
            order: board.stages.length,
            icon,
            autoNotify
        };

        await updateDoc(doc(db, BOARDS_COLLECTION, boardId), {
            stages: [...board.stages, newStage],
            updatedAt: serverTimestamp()
        });

        return newStage.id;
    },

    /**
     * Update a specific stage
     */
    async updateStage(
        boardId: string,
        stageId: string,
        updates: Partial<Omit<MinistryPipelineStage, 'id'>>
    ): Promise<void> {
        const board = await this.getBoard(boardId);
        if (!board) throw new Error('Board not found');

        const stages = board.stages.map(stage =>
            stage.id === stageId ? { ...stage, ...updates } : stage
        );

        await updateDoc(doc(db, BOARDS_COLLECTION, boardId), {
            stages,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Delete a stage
     */
    async deleteStage(boardId: string, stageId: string): Promise<void> {
        const board = await this.getBoard(boardId);
        if (!board) throw new Error('Board not found');

        const stages = board.stages.filter(stage => stage.id !== stageId);

        // Reorder remaining stages
        const reorderedStages = stages.map((stage, index) => ({
            ...stage,
            order: index
        }));

        await updateDoc(doc(db, BOARDS_COLLECTION, boardId), {
            stages: reorderedStages,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Reorder stages
     */
    async reorderStages(boardId: string, newOrderStageIds: string[]): Promise<void> {
        const board = await this.getBoard(boardId);
        if (!board) throw new Error('Board not found');

        const reorderedStages = newOrderStageIds.map((id, index) => {
            const stage = board.stages.find(s => s.id === id);
            if (!stage) throw new Error(`Stage with ID ${id} not found`);
            return { ...stage, order: index };
        });

        await updateDoc(doc(db, BOARDS_COLLECTION, boardId), {
            stages: reorderedStages,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Get stage by ID
     */
    async getStage(boardId: string, stageId: string): Promise<MinistryPipelineStage | null> {
        const board = await this.getBoard(boardId);
        if (!board) return null;
        return board.stages.find(s => s.id === stageId) || null;
    },

    /**
     * Get stage by name
     */
    async getStageByName(boardId: string, stageName: string): Promise<MinistryPipelineStage | null> {
        const board = await this.getBoard(boardId);
        if (!board) return null;
        return board.stages.find(s => s.name.toLowerCase() === stageName.toLowerCase()) || null;
    }
};
