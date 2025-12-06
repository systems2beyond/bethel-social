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

async function findFallPreventionPost() {
    console.log('Searching for posts related to "fall" or "prevention"...');

    // 1. List recent posts
    const postsSnapshot = await db.collection('posts')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

    console.log(`Found ${postsSnapshot.size} recent posts.`);

    postsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n--- Post ID: ${doc.id} ---`);
        console.log(`Date: ${new Date(data.timestamp).toISOString()}`);
        console.log(`Content: ${data.content}`);
        console.log(`Media URL: ${data.mediaUrl}`);
    });

    // 2. Search in 'sermon_chunks' (Knowledge Base)
    console.log('\nSearching in knowledge base (sermon_chunks)...');
    const kbSnapshot = await db.collection('sermon_chunks').get();
    let foundInKb = false;

    kbSnapshot.forEach(doc => {
        const data = doc.data();
        const text = (data.text || '').toLowerCase();
        if (text.includes('fall') && text.includes('prevention')) {
            console.log(`\n--- KB Chunk ID: ${doc.id} ---`);
            console.log(`Source URL: ${data.url}`);
            console.log(`Text Preview: ${data.text.substring(0, 200)}...`);
            foundInKb = true;
        }
    });

    if (!foundInKb) {
        console.log('\n❌ No matching chunks found in knowledge base for "fall prevention".');
    }
}

findFallPreventionPost();
