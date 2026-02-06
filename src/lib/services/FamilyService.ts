import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    FieldValue
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Family, FirestoreUser } from '@/types';

const FAMILIES_COLLECTION = 'families';
const USERS_COLLECTION = 'users';

export class FamilyService {
    /**
     * Remove undefined values from object (Firestore doesn't accept undefined)
     */
    private static cleanObject(obj: any): any {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => this.cleanObject(item));

        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = this.cleanObject(value);
            }
        }
        return cleaned;
    }

    /**
     * Get all families for a church
     */
    static async getFamilies(churchId: string): Promise<Family[]> {
        const q = query(
            collection(db, FAMILIES_COLLECTION),
            where('churchId', '==', churchId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Family));
    }

    /**
     * Get all families (no church filter - for admin use)
     */
    static async getAllFamilies(): Promise<Family[]> {
        const snapshot = await getDocs(collection(db, FAMILIES_COLLECTION));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Family));
    }

    /**
     * Get a family by ID
     */
    static async getFamily(familyId: string): Promise<Family | null> {
        const docRef = doc(db, FAMILIES_COLLECTION, familyId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Family : null;
    }

    /**
     * Get family members (hydrated user objects)
     */
    static async getFamilyMembers(familyId: string): Promise<FirestoreUser[]> {
        const q = query(
            collection(db, USERS_COLLECTION),
            where('familyId', '==', familyId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as FirestoreUser));
    }

    /**
     * Create a new family
     */
    static async createFamily(
        family: Omit<Family, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { createdBy?: string },
        createdBy: string
    ): Promise<string> {
        // Clean data to remove undefined values before saving
        const cleanedData = this.cleanObject({
            ...family,
            createdBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        const docRef = await addDoc(collection(db, FAMILIES_COLLECTION), cleanedData);
        return docRef.id;
    }

    /**
     * Update family
     */
    static async updateFamily(familyId: string, updates: Partial<Family>): Promise<void> {
        const docRef = doc(db, FAMILIES_COLLECTION, familyId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    /**
     * Link a member to a family
     */
    static async linkMemberToFamily(
        userId: string,
        familyId: string,
        role: 'head' | 'spouse' | 'child' | 'other'
    ): Promise<void> {
        // Update user's familyId
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, { familyId });

        // Update family's member list based on role
        const familyRef = doc(db, FAMILIES_COLLECTION, familyId);
        const familySnap = await getDoc(familyRef);

        if (!familySnap.exists()) throw new Error('Family not found');

        const updates: Record<string, string | FieldValue | null> = { updatedAt: serverTimestamp() };

        switch (role) {
            case 'head':
                updates.headOfHouseholdId = userId;
                break;
            case 'spouse':
                updates.spouseId = userId;
                break;
            case 'child':
                updates.childrenIds = arrayUnion(userId);
                break;
            case 'other':
                updates.otherMemberIds = arrayUnion(userId);
                break;
        }

        await updateDoc(familyRef, updates);
    }

    /**
     * Remove a member from family
     */
    static async unlinkMemberFromFamily(userId: string, familyId: string): Promise<void> {
        // Clear user's familyId
        const userRef = doc(db, USERS_COLLECTION, userId);
        await updateDoc(userRef, { familyId: null });

        // Remove from family arrays
        const familyRef = doc(db, FAMILIES_COLLECTION, familyId);
        const familySnap = await getDoc(familyRef);

        if (!familySnap.exists()) return;

        const familyData = familySnap.data() as Family;
        const updates: Record<string, string | FieldValue | null> = { updatedAt: serverTimestamp() };

        // Check which role and remove accordingly
        if (familyData.headOfHouseholdId === userId) {
            updates.headOfHouseholdId = null;
        }
        if (familyData.spouseId === userId) {
            updates.spouseId = null;
        }
        if (familyData.childrenIds?.includes(userId)) {
            updates.childrenIds = arrayRemove(userId);
        }
        if (familyData.otherMemberIds?.includes(userId)) {
            updates.otherMemberIds = arrayRemove(userId);
        }

        await updateDoc(familyRef, updates);
    }

    /**
     * Get family by member userId
     */
    static async getFamilyByMember(userId: string): Promise<Family | null> {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return null;

        const userData = userSnap.data() as FirestoreUser;
        if (!userData.familyId) return null;

        return this.getFamily(userData.familyId);
    }
}
