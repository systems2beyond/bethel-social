/**
 * CRM Service Layer
 * Reusable services for managing people (visitors & members)
 * Handles tags, activities, workflows, and custom fields
 */

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
    getDocs,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { PersonTag, PersonActivity, Workflow, WorkflowEnrollment, Visitor, PipelineBoard } from '@/types';

// ============== TAG MANAGEMENT ==============

/**
 * Create a new tag
 */
export async function createTag(
    name: string,
    color: string,
    category: 'visitor' | 'member' | 'volunteer' | 'custom',
    createdBy: string
): Promise<string> {
    const tagRef = await addDoc(collection(db, 'tags'), {
        name,
        color,
        category,
        createdBy,
        createdAt: serverTimestamp()
    });
    return tagRef.id;
}

/**
 * Subscribe to all tags
 */
export function subscribeToTags(callback: (tags: PersonTag[]) => void): () => void {
    const q = query(collection(db, 'tags'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const tags = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as PersonTag[];
        callback(tags);
    });
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string): Promise<void> {
    await deleteDoc(doc(db, 'tags', tagId));
}

/**
 * Apply tag to a person (visitor or member)
 */
export async function applyTagToPerson(
    personId: string,
    personType: 'visitor' | 'member',
    tagName: string,
    userId?: string
): Promise<void> {
    const collectionName = personType === 'visitor' ? 'visitors' : 'users';
    const personRef = doc(db, collectionName, personId);

    // Add tag to person's tags array
    const personDoc = await getDocs(query(collection(db, collectionName), where('__name__', '==', personId)));
    const currentTags = personDoc.docs[0]?.data()?.tags || [];

    if (!currentTags.includes(tagName)) {
        await updateDoc(personRef, {
            tags: [...currentTags, tagName],
            lastActivityAt: serverTimestamp()
        });

        // Log activity
        await logActivity(personId, personType, 'tag_added', `Tag "${tagName}" applied`, { tagName }, userId);
    }
}

/**
 * Remove tag from a person
 */
export async function removeTagFromPerson(
    personId: string,
    personType: 'visitor' | 'member',
    tagName: string,
    userId?: string
): Promise<void> {
    const collectionName = personType === 'visitor' ? 'visitors' : 'users';
    const personRef = doc(db, collectionName, personId);

    const personDoc = await getDocs(query(collection(db, collectionName), where('__name__', '==', personId)));
    const currentTags = personDoc.docs[0]?.data()?.tags || [];

    await updateDoc(personRef, {
        tags: currentTags.filter((t: string) => t !== tagName),
        lastActivityAt: serverTimestamp()
    });

    // Log activity
    await logActivity(personId, personType, 'tag_removed', `Tag "${tagName}" removed`, { tagName }, userId);
}

// ============== ACTIVITY LOG ==============

/**
 * Log an activity for a person
 */
export async function logActivity(
    personId: string,
    personType: 'visitor' | 'member',
    activityType: PersonActivity['activityType'],
    description: string,
    metadata?: Record<string, any>,
    createdBy?: string,
    automated: boolean = false
): Promise<string> {
    const activityRef = await addDoc(collection(db, 'activities'), {
        personId,
        personType,
        activityType,
        description,
        metadata: metadata || {},
        createdBy: createdBy || null,
        automated,
        createdAt: serverTimestamp()
    });

    // Update lastActivityAt on person
    const collectionName = personType === 'visitor' ? 'visitors' : 'users';
    await updateDoc(doc(db, collectionName, personId), {
        lastActivityAt: serverTimestamp()
    });

    return activityRef.id;
}

/**
 * Subscribe to activities for a specific person
 */
export function subscribeToPersonActivities(
    personId: string,
    callback: (activities: PersonActivity[]) => void
): () => void {
    const q = query(
        collection(db, 'activities'),
        where('personId', '==', personId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as PersonActivity[];
        callback(activities);
    });
}

// ============== CUSTOM FIELDS ==============

/**
 * Update custom fields for a person
 */
export async function updateCustomFields(
    personId: string,
    personType: 'visitor' | 'member',
    fields: Record<string, any>,
    userId?: string
): Promise<void> {
    const collectionName = personType === 'visitor' ? 'visitors' : 'users';
    const personRef = doc(db, collectionName, personId);

    await updateDoc(personRef, {
        customFields: fields,
        lastActivityAt: serverTimestamp()
    });

    // Log activity
    await logActivity(
        personId,
        personType,
        'custom',
        'Custom fields updated',
        { fields },
        userId
    );
}

// ============== PIPELINE MANAGEMENT ==============

/**
 * Move visitor to a different pipeline stage
 */
export async function updatePipelineStage(
    visitorId: string,
    newStage: 'new_guest' | 'contacted' | 'second_visit' | 'ready_for_membership' | 'converted',
    userId?: string,
    notes?: string
): Promise<void> {
    const visitorRef = doc(db, 'visitors', visitorId);

    await updateDoc(visitorRef, {
        pipelineStage: newStage,
        lastActivityAt: serverTimestamp()
    });

    // Log activity
    await logActivity(
        visitorId,
        'visitor',
        'status_change',
        `Moved to stage: ${newStage.replace('_', ' ')}${notes ? ` - ${notes}` : ''}`,
        { newStage, oldStage: 'previous', notes },
        userId
    );
}

// ============== BULK OPERATIONS ==============

/**
 * Apply tag to multiple people
 */
export async function bulkApplyTag(
    personIds: string[],
    personType: 'visitor' | 'member',
    tagName: string,
    userId?: string
): Promise<void> {
    const batch = writeBatch(db);
    const collectionName = personType === 'visitor' ? 'visitors' : 'users';

    for (const personId of personIds) {
        const personRef = doc(db, collectionName, personId);
        const personDoc = await getDocs(query(collection(db, collectionName), where('__name__', '==', personId)));
        const currentTags = personDoc.docs[0]?.data()?.tags || [];

        if (!currentTags.includes(tagName)) {
            batch.update(personRef, {
                tags: [...currentTags, tagName],
                lastActivityAt: serverTimestamp()
            });
        }
    }

    await batch.commit();

    // Log activities for each person
    for (const personId of personIds) {
        await logActivity(personId, personType, 'tag_added', `Tag "${tagName}" applied (bulk)`, { tagName }, userId);
    }
}

/**
 * Update pipeline stage for multiple visitors
 */
export async function bulkUpdatePipelineStage(
    visitorIds: string[],
    newStage: 'new_guest' | 'contacted' | 'second_visit' | 'ready_for_membership' | 'converted',
    userId?: string
): Promise<void> {
    const batch = writeBatch(db);

    for (const visitorId of visitorIds) {
        const visitorRef = doc(db, 'visitors', visitorId);
        batch.update(visitorRef, {
            pipelineStage: newStage,
            lastActivityAt: serverTimestamp()
        });
    }

    await batch.commit();

    // Log activities
    for (const visitorId of visitorIds) {
        await logActivity(
            visitorId,
            'visitor',
            'status_change',
            `Moved to stage: ${newStage.replace('_', ' ')} (bulk)`,
            { newStage },
            userId
        );
    }
}

// ============== WORKFLOW MANAGEMENT (Placeholder for future expansion) ==============

/**
 * Create a new workflow
 */
export async function createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const workflowRef = await addDoc(collection(db, 'workflows'), {
        ...workflow,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return workflowRef.id;
}

/**
 * Subscribe to active workflows
 */
export function subscribeToWorkflows(callback: (workflows: Workflow[]) => void): () => void {
    const q = query(
        collection(db, 'workflows'),
        where('status', 'in', ['active', 'draft']),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const workflows = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Workflow[];
        callback(workflows);
    });
}

/**
 * Enroll a person in a workflow
 */
export async function enrollInWorkflow(
    workflowId: string,
    personId: string,
    personType: 'visitor' | 'member'
): Promise<string> {
    const enrollmentRef = await addDoc(collection(db, 'workflow_enrollments'), {
        workflowId,
        personId,
        personType,
        status: 'active',
        currentActionIndex: 0,
        enrolledAt: serverTimestamp(),
        nextActionAt: serverTimestamp() // Execute first action immediately
    });

    await logActivity(
        personId,
        personType,
        'workflow_enrolled',
        `Enrolled in workflow`,
        { workflowId },
        undefined,
        true
    );

    return enrollmentRef.id;
}

// ============== VISITOR MANAGEMENT ==============

/**
 * Create a new visitor
 */
export async function createVisitor(visitorData: Omit<Visitor, 'id' | 'createdAt'>): Promise<string> {
    const visitorRef = await addDoc(collection(db, 'visitors'), {
        ...visitorData,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp()
    });
    return visitorRef.id;
}

/**
 * Find a pipeline board linked to a specific event
 */
export async function findBoardByEventId(eventId: string): Promise<PipelineBoard | null> {
    const q = query(
        collection(db, 'pipeline_boards'),
        where('linkedEventId', '==', eventId),
        where('archived', '==', false)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PipelineBoard;
    }
    return null;
}
