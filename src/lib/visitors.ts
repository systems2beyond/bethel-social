import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Visitor } from '@/types';

export const VisitorsService = {
    /**
     * Creates a new visitor record in the /visitors collection.
     * Used by the public "Digital Connection Card".
     */
    createVisitor: async (data: Omit<Visitor, 'id' | 'createdAt' | 'status' | 'source'>) => {
        const visitorsRef = collection(db, 'visitors');

        const newVisitor = {
            ...data,
            status: 'new',
            pipelineStage: 'new_guest',
            source: 'qr-code', // Default to QR code for the public form
            createdAt: serverTimestamp(),
            auditLog: [] // Initialize empty audit log
        };

        const docRef = await addDoc(visitorsRef, newVisitor);
        return docRef.id;
    },

    /**
     * Real-time listener for the Pulpit Dashboard (Future).
     * Listens for the most recent visitors created today.
     */
    subscribeToRecentVisitors: (callback: (visitors: Visitor[]) => void) => {
        const visitorsRef = collection(db, 'visitors');
        // Simple query: Last 20 visitors, ordered by creation time.
        // In prod, we'd filter by "createdAt > today".
        const q = query(visitorsRef, orderBy('createdAt', 'desc'), limit(20));

        return onSnapshot(q, (snapshot) => {
            const visitors: Visitor[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Visitor));
            callback(visitors);
        });
    }
};
