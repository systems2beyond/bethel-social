
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FirestoreUser } from '@/types';

export const UsersService = {
    /**
     * Updates a user's role in Firestore
     */
    updateUserRole: async (uid: string, newRole: string): Promise<void> => {
        try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                role: newRole,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating user role:', error);
            throw error;
        }
    }
};
