
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env vars from .env.local
config({ path: resolve(__dirname, '../.env.local') });

// Mock window for firebase.ts if it uses it (lines 25-31 of firebase.ts check typeof window)
// It checks 'if (typeof window !== "undefined")', so in node it should be fine.

// Manually set env vars from .env.local to ensure they are available before firebase init
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'AIzaSyCJY1tZPXM7BEAHPfYsFLp9grad89nar8g';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'bethel-metro-social.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'bethel-metro-social';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'bethel-metro-social.firebasestorage.app';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '503876827928';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:503876827928:web:5ca90929f9c1eff6983c6d';

import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where, updateDoc, doc, Timestamp, addDoc } from 'firebase/firestore';
import { randomUUID } from 'crypto';

async function main() {
    console.log('Restoring Outreach Pipeline...');
    console.log('Database Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

    // Allow time for emulator connection if needed
    await new Promise(resolve => setTimeout(resolve, 1000));

    const boardsRef = collection(db, 'pipeline_boards');
    const q = query(boardsRef, where('name', '==', 'Outreach Pipeline'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log('Board "Outreach Pipeline" not found. Creating new board...');
        const stages = [
            { name: 'New Outreach', order: 0, color: '#3B82F6', id: randomUUID() },
            { name: 'Attempted Contact 1', order: 1, color: '#F59E0B', id: randomUUID() },
            { name: 'Attempted Contact 2', order: 2, color: '#F97316', id: randomUUID() },
            { name: 'Connected', order: 3, color: '#10B981', id: randomUUID() },
            { name: 'Ready for Membership', order: 4, color: '#8B5CF6', id: randomUUID() },
            { name: 'Archived', order: 5, color: '#6B7280', id: randomUUID() }
        ];

        // @ts-ignore
        await addDoc(collection(db, 'pipeline_boards'), {
            name: "Outreach Pipeline",
            type: 'custom',
            stages,
            linkedEventId: null,
            createdBy: "admin_restore_script",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            archived: false
        });
        console.log('Success: Created generic Outreach Pipeline board.');
        process.exit(0);
    }

    const boardDoc = snapshot.docs[0];
    console.log(`Found board: ${boardDoc.id} (${boardDoc.data().name})`);

    const newStages = [
        { name: 'New Outreach', order: 0, color: '#3B82F6', id: randomUUID() },
        { name: 'Attempted Contact 1', order: 1, color: '#F59E0B', id: randomUUID() },
        { name: 'Attempted Contact 2', order: 2, color: '#F97316', id: randomUUID() },
        { name: 'Connected', order: 3, color: '#10B981', id: randomUUID() },
        { name: 'Ready for Membership', order: 4, color: '#8B5CF6', id: randomUUID() },
        { name: 'Archived', order: 5, color: '#6B7280', id: randomUUID() }
    ];

    await updateDoc(doc(db, 'pipeline_boards', boardDoc.id), {
        stages: newStages,
        type: 'custom',
        updatedAt: Timestamp.now()
    });

    console.log('Success: Board updated with new stages.');
    process.exit(0);
}

main().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
