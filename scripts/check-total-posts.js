const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin with ADC
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'bethel-metro-social'
    });
}

const db = getFirestore();

async function checkTotalPosts() {
    console.log('Checking total post count...');
    const snapshot = await db.collection('posts').count().get();
    console.log(`Total posts in database: ${snapshot.data().count}`);

    // Check how many have [Image Analysis] in their KB entry
    const kbSnapshot = await db.collection('sermon_chunks').count().get();
    console.log(`Total knowledge base entries: ${kbSnapshot.data().count}`);
}

checkTotalPosts();
