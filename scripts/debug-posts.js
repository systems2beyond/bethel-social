const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function checkPosts() {
    console.log('Fetching last 5 posts...');
    const snapshot = await db.collection('posts')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    if (snapshot.empty) {
        console.log('No posts found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\nID: ${doc.id}`);
        console.log(`Type: ${data.type}`);
        console.log(`Media URL: ${data.mediaUrl}`);
    });
}

checkPosts().catch(console.error);
