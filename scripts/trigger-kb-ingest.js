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

async function triggerIngestion() {
    console.log('Starting Knowledge Base re-ingestion trigger...');

    // Get ALL posts
    const snapshot = await db.collection('posts').get();

    console.log(`Found ${snapshot.size} posts to re-ingest.`);

    const batchSize = 100; // Firestore batch limit is 500, keep it safe
    const chunks = [];
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
        chunks.push(docs.slice(i, i + batchSize));
    }

    let processed = 0;

    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(doc => {
            // Toggle forceIngest to trigger the function
            // We use a timestamp to ensure it's always a "change"
            batch.update(doc.ref, {
                forceIngest: true,
                lastIngestTrigger: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        processed += chunk.length;
        console.log(`Triggered ingestion for ${processed}/${snapshot.size} posts...`);

        // Small delay to avoid hammering the Cloud Function too hard
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Successfully triggered re-ingestion for all recent posts.');
    console.log('Please wait a few minutes for the Cloud Functions to process the images.');
}

triggerIngestion();
