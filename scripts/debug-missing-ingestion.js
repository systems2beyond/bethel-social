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

async function findMissingIngestions() {
    console.log('Analyzing missing ingestions...');

    // 1. Get all posts
    const postsSnapshot = await db.collection('posts').get();
    const allPosts = new Map();
    postsSnapshot.forEach(doc => allPosts.set(doc.id, doc.data()));
    console.log(`Total Posts: ${allPosts.size}`);

    // 2. Get all KB chunks
    const kbSnapshot = await db.collection('sermon_chunks')
        .where('docType', '==', 'social_post')
        .get();

    const ingestedPostIds = new Set();
    kbSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.originalPostId) {
            ingestedPostIds.add(data.originalPostId);
        }
    });
    console.log(`Total Ingested Posts: ${ingestedPostIds.size}`);

    // 3. Find missing
    const missingIds = [];
    for (const [id, data] of allPosts) {
        if (!ingestedPostIds.has(id)) {
            missingIds.push({ id, ...data });
        }
    }

    console.log(`\nFound ${missingIds.length} posts NOT in Knowledge Base:`);

    let skippedVideo = 0;
    let skippedEmpty = 0;
    let unknown = 0;

    missingIds.forEach(p => {
        const isVideo = p.mediaUrl && (p.mediaUrl.includes('youtube') || p.mediaUrl.includes('vimeo'));
        const isEmpty = !p.content && !p.mediaUrl;

        if (isVideo) {
            skippedVideo++;
        } else if (isEmpty) {
            skippedEmpty++;
        } else {
            unknown++;
            console.log(`\n--- Missing Post ID: ${p.id} ---`);
            console.log(`Type: ${p.type}`);
            console.log(`Content: ${p.content}`);
            console.log(`Media: ${p.mediaUrl}`);
        }
    });

    console.log('\nSummary of Missing Posts:');
    console.log(`- Video Posts (Skipped by design): ${skippedVideo}`);
    console.log(`- Empty Posts (Skipped by design): ${skippedEmpty}`);
    console.log(`- Unexplained Missing: ${unknown}`);
}

findMissingIngestions();
