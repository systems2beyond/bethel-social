const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        });
    } catch (e) {
        console.error('Error initializing Firebase Admin:', e);
        process.exit(1);
    }
}

const reingestPosts = async () => {
    console.log('Starting post re-ingestion...');
    const db = admin.firestore();

    try {
        const snapshot = await db.collection('posts').get();
        console.log(`Found ${snapshot.size} posts.`);

        const batchSize = 5; // Reduced to avoid rate limits (15 RPM)
        let batch = db.batch();
        let count = 0;
        let totalUpdated = 0;

        for (const doc of snapshot.docs) {
            // Set forceIngest to true to bypass the "no change" check in the Cloud Function
            // Also update timestamp to ensure it's seen as a write
            batch.set(doc.ref, {
                forceIngest: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            count++;

            if (count >= batchSize) {
                await batch.commit();
                totalUpdated += count;
                console.log(`Updated ${totalUpdated} posts... Waiting 25s to respect rate limits...`);
                batch = db.batch();
                count = 0;
                // Wait 25 seconds to be safe (15 RPM = 1 request every 4s, batch of 5 needs ~20s buffer)
                await new Promise(resolve => setTimeout(resolve, 25000));
            }
        }

        if (count > 0) {
            await batch.commit();
            totalUpdated += count;
        }

        console.log(`Successfully triggered re-ingestion for ${totalUpdated} posts.`);

    } catch (error) {
        console.error('Error re-ingesting posts:', error);
    }
};

reingestPosts();
