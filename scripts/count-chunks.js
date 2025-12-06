const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bethel-metro-social'
        });
    } catch (e) {
        console.error('Error initializing Firebase Admin:', e);
        process.exit(1);
    }
}

const db = admin.firestore();

async function countChunks() {
    try {
        const snapshot = await db.collection('sermon_chunks').count().get();
        console.log(`Total sermon chunks: ${snapshot.data().count}`);
    } catch (error) {
        console.error('Error counting chunks:', error);
    }
}

countChunks();
