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
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { District, ChurchDistrictSettings } from '@/types';

const DISTRICTS_COLLECTION = 'districts';

export const DistrictService = {
    /**
     * Get all districts for a church
     */
    async getDistricts(churchId: string): Promise<District[]> {
        const q = query(
            collection(db, DISTRICTS_COLLECTION),
            where('churchId', '==', churchId),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as District[];
    },

    /**
     * Get a single district by ID
     */
    async getDistrict(districtId: string): Promise<District | null> {
        const docRef = doc(db, DISTRICTS_COLLECTION, districtId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as District;
    },

    /**
     * Get district by leader ID
     */
    async getDistrictByLeader(leaderId: string): Promise<District | null> {
        const q = query(
            collection(db, DISTRICTS_COLLECTION),
            where('leaderId', '==', leaderId),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docData = snapshot.docs[0];
        return { id: docData.id, ...docData.data() } as District;
    },

    /**
     * Create a new district
     */
    async createDistrict(
        districtData: Omit<District, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
        createdBy: string
    ): Promise<District> {
        const docRef = await addDoc(collection(db, DISTRICTS_COLLECTION), {
            ...districtData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy
        });

        // Update all members' districtId
        if (districtData.memberIds && districtData.memberIds.length > 0) {
            const batch = writeBatch(db);
            for (const memberId of districtData.memberIds) {
                const userRef = doc(db, 'users', memberId);
                batch.update(userRef, {
                    districtId: docRef.id,
                    districtRole: memberId === districtData.leaderId ? 'leader' :
                        (districtData.coLeaderIds?.includes(memberId) ? 'co_leader' : 'member')
                });
            }
            await batch.commit();
        }

        return {
            id: docRef.id,
            ...districtData,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy
        } as District;
    },

    /**
     * Update a district
     */
    async updateDistrict(districtId: string, updates: Partial<District>): Promise<void> {
        const docRef = doc(db, DISTRICTS_COLLECTION, districtId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    },

    /**
     * Add a member to a district
     */
    async addMemberToDistrict(districtId: string, memberId: string, role: 'member' | 'co_leader' = 'member'): Promise<void> {
        const district = await this.getDistrict(districtId);
        if (!district) throw new Error('District not found');

        const batch = writeBatch(db);

        // Update district memberIds
        const updatedMemberIds = [...(district.memberIds || [])];
        if (!updatedMemberIds.includes(memberId)) {
            updatedMemberIds.push(memberId);
        }

        const districtRef = doc(db, DISTRICTS_COLLECTION, districtId);
        batch.update(districtRef, {
            memberIds: updatedMemberIds,
            ...(role === 'co_leader' && {
                coLeaderIds: [...(district.coLeaderIds || []), memberId]
            }),
            updatedAt: serverTimestamp()
        });

        // Update user's districtId
        const userRef = doc(db, 'users', memberId);
        batch.update(userRef, {
            districtId,
            districtRole: role
        });

        await batch.commit();
    },

    /**
     * Remove a member from a district
     */
    async removeMemberFromDistrict(districtId: string, memberId: string): Promise<void> {
        const district = await this.getDistrict(districtId);
        if (!district) throw new Error('District not found');

        // Don't allow removing the leader
        if (district.leaderId === memberId) {
            throw new Error('Cannot remove the district leader. Assign a new leader first.');
        }

        const batch = writeBatch(db);

        // Update district
        const updatedMemberIds = (district.memberIds || []).filter(id => id !== memberId);
        const updatedCoLeaderIds = (district.coLeaderIds || []).filter(id => id !== memberId);

        const districtRef = doc(db, DISTRICTS_COLLECTION, districtId);
        batch.update(districtRef, {
            memberIds: updatedMemberIds,
            coLeaderIds: updatedCoLeaderIds,
            updatedAt: serverTimestamp()
        });

        // Clear user's districtId
        const userRef = doc(db, 'users', memberId);
        batch.update(userRef, {
            districtId: null,
            districtRole: null
        });

        await batch.commit();
    },

    /**
     * Get members of a district
     */
    async getDistrictMembers(districtId: string): Promise<string[]> {
        const district = await this.getDistrict(districtId);
        return district?.memberIds || [];
    },

    /**
     * Delete (deactivate) a district
     */
    async deleteDistrict(districtId: string): Promise<void> {
        const district = await this.getDistrict(districtId);
        if (!district) throw new Error('District not found');

        const batch = writeBatch(db);

        // Clear all members' districtId
        for (const memberId of district.memberIds || []) {
            const userRef = doc(db, 'users', memberId);
            batch.update(userRef, {
                districtId: null,
                districtRole: null
            });
        }

        // Mark district as inactive (soft delete)
        const districtRef = doc(db, DISTRICTS_COLLECTION, districtId);
        batch.update(districtRef, {
            isActive: false,
            updatedAt: serverTimestamp()
        });

        await batch.commit();
    },

    /**
     * Get district settings for a church
     */
    async getDistrictSettings(churchId: string): Promise<ChurchDistrictSettings | null> {
        const docRef = doc(db, 'churches', churchId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return docSnap.data()?.districtSettings || null;
    },

    /**
     * Update district settings for a church
     */
    async updateDistrictSettings(churchId: string, settings: ChurchDistrictSettings): Promise<void> {
        const docRef = doc(db, 'churches', churchId);
        await updateDoc(docRef, {
            districtSettings: settings,
            updatedAt: serverTimestamp()
        });
    }
};
