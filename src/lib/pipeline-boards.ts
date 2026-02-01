import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDoc,
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { PipelineBoard, PipelineStage } from '@/types';

// Default Stages Template
export const DEFAULT_STAGES: Omit<PipelineStage, 'id'>[] = [
    { name: 'New Guest', order: 0, color: '#3B82F6' },     // Blue
    { name: 'Contacted', order: 1, color: '#F59E0B' },     // Amber
    { name: 'Second Visit', order: 2, color: '#8B5CF6' },  // Purple
    { name: 'Ready for Member', order: 3, color: '#EC4899' }, // Pink
    { name: 'Member', order: 4, color: '#10B981' }         // Green
];

// ============== BOARD MANAGEMENT ==============

/**
 * Create a new pipeline board
 */
export async function createPipelineBoard(
    name: string,
    type: 'sunday_service' | 'event' | 'custom',
    stages: Omit<PipelineStage, 'id' | 'automations'>[] = DEFAULT_STAGES,
    createdBy: string,
    linkedEventId?: string
): Promise<string> {

    // Assign IDs to stages
    const initializedStages: PipelineStage[] = stages.map((stage, index) => ({
        ...stage,
        id: crypto.randomUUID(),
        order: index
    }));

    const boardRef = await addDoc(collection(db, 'pipeline_boards'), {
        name,
        type,
        linkedEventId: linkedEventId || null,
        stages: initializedStages,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        archived: false
    });

    return boardRef.id;
}

/**
 * Update a pipeline board
 */
export async function updatePipelineBoard(
    boardId: string,
    updates: Partial<Omit<PipelineBoard, 'id' | 'createdAt' | 'stages'>>
): Promise<void> {
    const boardRef = doc(db, 'pipeline_boards', boardId);
    await updateDoc(boardRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
}

/**
 * Archive/Delete a pipeline board
 */
export async function deletePipelineBoard(boardId: string): Promise<void> {
    // Soft delete (archive) logic preferred
    const boardRef = doc(db, 'pipeline_boards', boardId);
    await updateDoc(boardRef, {
        archived: true,
        updatedAt: serverTimestamp()
    });
}

/**
 * Subscribe to all active pipeline boards
 */
export function subscribeToPipelineBoards(callback: (boards: PipelineBoard[]) => void): () => void {
    const q = query(
        collection(db, 'pipeline_boards'),
        where('archived', '==', false),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const boards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as PipelineBoard[];
        callback(boards);
    });
}

// ============== STAGE MANAGEMENT ==============

/**
 * Add a stage to a board
 */
export async function addStageToBoard(
    boardId: string,
    stageName: string,
    color: string
): Promise<string> {
    const boardRef = doc(db, 'pipeline_boards', boardId);
    const boardDoc = await getDoc(boardRef);

    if (!boardDoc.exists()) throw new Error('Board not found');

    const boardData = boardDoc.data() as PipelineBoard;
    const currentStages = boardData.stages || [];

    const newStage: PipelineStage = {
        id: crypto.randomUUID(),
        name: stageName,
        color,
        order: currentStages.length
    };

    await updateDoc(boardRef, {
        stages: [...currentStages, newStage],
        updatedAt: serverTimestamp()
    });

    return newStage.id;
}

/**
 * Update a specific stage
 */
export async function updateStage(
    boardId: string,
    stageId: string,
    updates: Partial<Omit<PipelineStage, 'id' | 'automations'>>
): Promise<void> {
    const boardRef = doc(db, 'pipeline_boards', boardId);
    const boardDoc = await getDoc(boardRef);

    if (!boardDoc.exists()) throw new Error('Board not found');

    const boardData = boardDoc.data() as PipelineBoard;
    const stages = boardData.stages.map(stage =>
        stage.id === stageId ? { ...stage, ...updates } : stage
    );

    await updateDoc(boardRef, {
        stages,
        updatedAt: serverTimestamp()
    });
}

/**
 * Delete a stage
 */
export async function deleteStage(boardId: string, stageId: string): Promise<void> {
    const boardRef = doc(db, 'pipeline_boards', boardId);
    const boardDoc = await getDoc(boardRef);

    if (!boardDoc.exists()) throw new Error('Board not found');

    const boardData = boardDoc.data() as PipelineBoard;
    const stages = boardData.stages.filter(stage => stage.id !== stageId);

    // Reorder remaining stages
    const reorderedStages = stages.map((stage, index) => ({
        ...stage,
        order: index
    }));

    await updateDoc(boardRef, {
        stages: reorderedStages,
        updatedAt: serverTimestamp()
    });
}

/**
 * Reorder stages
 */
export async function reorderStages(boardId: string, newOrderStageIds: string[]): Promise<void> {
    const boardRef = doc(db, 'pipeline_boards', boardId);
    const boardDoc = await getDoc(boardRef);

    if (!boardDoc.exists()) throw new Error('Board not found');

    const boardData = boardDoc.data() as PipelineBoard;

    // Sort stages based on the new ID order
    const reorderedStages = newOrderStageIds.map((id, index) => {
        const stage = boardData.stages.find(s => s.id === id);
        if (!stage) throw new Error(`Stage with ID ${id} not found`);
        return { ...stage, order: index };
    });

    await updateDoc(boardRef, {
        stages: reorderedStages,
        updatedAt: serverTimestamp()
    });
}

// ============== INITIALIZATION ==============

/**
 * Initialize Default "Sunday Service" Board
 * Checks if it exists, creates it if not.
 */
export async function initializeDefaultBoard(userId: string): Promise<string> {
    const q = query(
        collection(db, 'pipeline_boards'),
        where('type', '==', 'sunday_service'),
        where('archived', '==', false)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        return snapshot.docs[0].id;
    }

    // Create default board
    return await createPipelineBoard(
        'Sunday Service Visitors',
        'sunday_service',
        DEFAULT_STAGES,
        userId
    );
}
