import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    addDoc,
    deleteDoc,
    setDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    increment,
    runTransaction,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';
import {
    Ministry,
    MinistryRole,
    VolunteerProfile,
    ServiceVolunteerSlot,
    PulpitSession,
    FirestoreUser
} from '@/types';

export const VOLUNTEER_COLLECTION = 'volunteers'; // Sub-collection logic or root? 
// Actually, VolunteerProfile is on the User object. 
// Ministry is arguably a root collection 'ministries'.
// Service slots might be sub-collection of 'pulpitSessions' or root 'serviceSlots'. 
// Let's stick to root collections for easier querying for now.

const MINISTRIES_COLLECTION = 'ministries';
const SERVICE_SLOTS_COLLECTION = 'serviceSlots';
const USERS_COLLECTION = 'users';

export class VolunteerService {

    // =========================================
    // Ministry Management
    // =========================================

    /**
     * Fetch all active ministries for a church
     */
    static async getMinistries(churchId: string): Promise<Ministry[]> {
        if (!churchId) return [];

        try {
            const q = query(
                collection(db, MINISTRIES_COLLECTION),
                where('churchId', '==', churchId),
                where('active', '==', true),
                orderBy('name', 'asc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Ministry));
        } catch (error) {
            console.error('Error fetching ministries:', error);
            throw error;
        }
    }

    /**
     * Create a new ministry and a linked Community Group
     */
    static async createMinistry(ministry: Omit<Ministry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        try {
            // 1. Create Linked Group
            const groupRef = await addDoc(collection(db, 'groups'), {
                name: ministry.name,
                description: ministry.description || `Ministry group for ${ministry.name}`,
                type: 'ministry',
                privacy: 'private', // Ministries are usually private/invite-only or request-to-join
                status: 'active',
                churchId: ministry.churchId,
                tags: ['ministry', 'volunteer'],
                memberCount: ministry.leaderId ? 1 : 0,
                createdBy: ministry.leaderId || 'system',
                createdAt: serverTimestamp(),
                lastActivityAt: serverTimestamp(),
                settings: {
                    postingPermission: 'everyone',
                    invitePermission: 'admins_only',
                    joinPolicy: 'request'
                }
            });

            // 2. Create Ministry with link
            const docRef = await addDoc(collection(db, MINISTRIES_COLLECTION), {
                ...ministry,
                linkedGroupId: groupRef.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 3. Add leader as ministry member (if leaderId provided)
            if (ministry.leaderId) {
                await addDoc(collection(db, 'ministryMembers'), {
                    ministryId: docRef.id,
                    userId: ministry.leaderId,
                    name: ministry.leaderName || 'Leader',
                    role: 'Leader',
                    status: 'active',
                    joinedAt: serverTimestamp(),
                    addedBy: ministry.leaderId
                });

                // Also add leader to the linked group (using subcollection pattern)
                const groupMemberRef = doc(db, 'groups', groupRef.id, 'members', ministry.leaderId);
                await setDoc(groupMemberRef, {
                    userId: ministry.leaderId,
                    groupId: groupRef.id,
                    role: 'admin',
                    status: 'active',
                    joinedAt: serverTimestamp()
                });
            }

            return docRef.id;
        } catch (error) {
            console.error('Error creating ministry:', error);
            throw error;
        }
    }

    /**
     * Update a ministry
     */
    static async updateMinistry(ministryId: string, updates: Partial<Ministry>): Promise<void> {
        try {
            const docRef = doc(db, MINISTRIES_COLLECTION, ministryId);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating ministry:', error);
            throw error;
        }
    }

    /**
     * Add a role to a ministry
     */
    static async addMinistryRole(ministryId: string, role: Omit<MinistryRole, 'id'>): Promise<void> {
        try {
            const ministryRef = doc(db, MINISTRIES_COLLECTION, ministryId);
            const newRole: MinistryRole = {
                id: crypto.randomUUID(),
                ...role
            };

            await updateDoc(ministryRef, {
                roles: arrayUnion(newRole),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error adding ministry role:', error);
            throw error;
        }
    }

    // =========================================
    // Ministry Member Management
    // =========================================

    /**
     * Remove a member from a ministry (soft delete with audit trail)
     */
    static async removeMember(
        memberId: string,
        removedByUserId: string,
        removedByName: string
    ): Promise<void> {
        try {
            const memberRef = doc(db, 'ministryMembers', memberId);
            await updateDoc(memberRef, {
                status: 'removed',
                removedBy: removedByUserId,
                removedByName: removedByName,
                removedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error removing ministry member:', error);
            throw error;
        }
    }

    /**
     * Reactivate a removed member
     */
    static async reactivateMember(memberId: string): Promise<void> {
        try {
            const memberRef = doc(db, 'ministryMembers', memberId);
            await updateDoc(memberRef, {
                status: 'active',
                removedBy: null,
                removedByName: null,
                removedAt: null
            });
        } catch (error) {
            console.error('Error reactivating ministry member:', error);
            throw error;
        }
    }

    // =========================================
    // Volunteer Profile Management
    // =========================================

    /**
     * Get a user's volunteer profile
     * (Actually fetches the whole user and returns the profile part)
     */
    static async getVolunteerProfile(userId: string): Promise<VolunteerProfile | undefined> {
        try {
            const userRef = doc(db, USERS_COLLECTION, userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data() as FirestoreUser;
                return userData.volunteerProfile;
            }
            return undefined;
        } catch (error) {
            console.error('Error fetching volunteer profile:', error);
            throw error;
        }
    }

    /**
     * Update (or Create) a volunteer profile
     */
    static async updateVolunteerProfile(userId: string, profile: Partial<VolunteerProfile>): Promise<void> {
        try {
            const userRef = doc(db, USERS_COLLECTION, userId);

            // We need to use dot notation for nested updates to avoid overwriting the whole map
            // BUT, since we want to likely merge, let's construct the update object carefully.
            // Firestore helper for nested fields: 'volunteerProfile.isVolunteer'

            const flattenUpdates: Record<string, any> = {};

            Object.entries(profile).forEach(([key, value]) => {
                flattenUpdates[`volunteerProfile.${key}`] = value;
            });

            // Always update timestamp
            // flattenUpdates['updatedAt'] = serverTimestamp(); // User update time?

            await updateDoc(userRef, flattenUpdates);
        } catch (error) {
            console.error('Error updating volunteer profile:', error);
            throw error;
        }
    }

    /**
     * Search/Filter Volunteers
     * Note: Firestore queries on maps can be tricky. Indices might be required.
     */
    static async searchVolunteers(churchId: string, filters: {
        ministry?: string;
        skill?: string;
        availableDay?: string; // 'sunday', 'wednesday', etc.
    }): Promise<FirestoreUser[]> {
        try {
            let q = query(
                collection(db, USERS_COLLECTION),
                where('churchId', '==', churchId),
                where('volunteerProfile.isVolunteer', '==', true)
            );

            if (filters.ministry) {
                q = query(q, where('volunteerProfile.ministries', 'array-contains', filters.ministry));
            }

            // Note: Cannot do multiple array-contains. 
            // If skill is also requested, we might need to filter client-side or use separate queries.
            // For now, let's prioritize Ministry filter if present.

            const snapshot = await getDocs(q);
            let users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as unknown as FirestoreUser));

            // Client-side filtering for the rest due to Firestore limitations
            if (filters.skill) {
                users = users.filter(u => u.volunteerProfile?.skills?.includes(filters.skill!));
            }

            if (filters.availableDay) {
                users = users.filter(u => {
                    const avail = u.volunteerProfile?.availability as any;
                    return avail && avail[filters.availableDay!] === true;
                });
            }

            return users;
        } catch (error) {
            console.error('Error searching volunteers:', error);
            throw error;
        }
    }

    // =========================================
    // Scheduling (Slots)
    // =========================================

    /**
     * Get slots for a specific session
     */
    static async getSessionSlots(sessionId: string): Promise<ServiceVolunteerSlot[]> {
        try {
            const q = query(
                collection(db, SERVICE_SLOTS_COLLECTION),
                where('sessionId', '==', sessionId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceVolunteerSlot));
        } catch (error) {
            console.error('Error fetching session slots:', error);
            throw error;
        }
    }

    /**
     * Create a slot
     */
    static async createSlot(slot: Omit<ServiceVolunteerSlot, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, SERVICE_SLOTS_COLLECTION), {
                ...slot,
                status: slot.assignedUserId ? 'filled' : 'open',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating slot:', error);
            throw error;
        }
    }

    /**
     * Assign a user to a slot
     */
    static async assignSlot(slotId: string, userId: string, userName: string): Promise<void> {
        try {
            const slotRef = doc(db, SERVICE_SLOTS_COLLECTION, slotId);
            await updateDoc(slotRef, {
                assignedUserId: userId,
                assignedUserName: userName,
                status: 'filled', // Or 'confirmed' if auto-confirm
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error assigning slot:', error);
            throw error;
        }
    }

    /**
     * Remove assignment
     */
    static async unassignSlot(slotId: string): Promise<void> {
        try {
            const slotRef = doc(db, SERVICE_SLOTS_COLLECTION, slotId);
            await updateDoc(slotRef, {
                assignedUserId: null,
                assignedUserName: null,
                status: 'open',
                updatedAt: serverTimestamp()
            }); // Firestore allows setting to null if not strict, or use field deletion
            // Ideally we stick to undefined or null.
        } catch (error) {
            console.error('Error unassigning slot:', error);
            throw error;
        }
    }

    /**
     * Delete a slot
     */
    static async deleteSlot(slotId: string): Promise<void> {
        try {
            const slotRef = doc(db, SERVICE_SLOTS_COLLECTION, slotId);
            await deleteDoc(slotRef);
        } catch (error) {
            console.error('Error deleting slot:', error);
            throw error;
        }
    }

    /**
     * Update a slot
     */
    static async updateSlot(slotId: string, updates: Partial<ServiceVolunteerSlot>): Promise<void> {
        try {
            const slotRef = doc(db, SERVICE_SLOTS_COLLECTION, slotId);
            await updateDoc(slotRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating slot:', error);
            throw error;
        }
    }
}
