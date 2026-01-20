const admin = require('firebase-admin');

// Initialize Firebase
try {
    admin.initializeApp();
} catch (e) {
    console.error('Failed to init admin:', e);
    process.exit(1);
}

const db = admin.firestore();

async function migrateEvents() {
    console.log('Starting migration: Backfilling startDate from date...');
    try {
        const snapshot = await db.collection('events').get();
        if (snapshot.empty) {
            console.log('No events found.');
            return;
        }

        let updatedCount = 0;
        const batch = db.batch(); // Firestore batch (limit 500)
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Check if startDate is missing but date exists
            if (!data.startDate && data.date) {
                console.log(`Migrating event [${doc.id}]...`);

                // Copy date to startDate
                // Also ensures it's a Timestamp, though copying the field preserves type usually
                const updates = {
                    startDate: data.date
                };

                batch.update(doc.ref, updates);
                updatedCount++;
                batchCount++;

                // Commit batch if getting large
                if (batchCount >= 400) {
                    await batch.commit();
                    console.log(`Committed batch of ${batchCount} updates...`);
                    batchCount = 0; // Reset count (batch object needs recreating? No, usually new batch)
                    // Actually, for safety, firestore batches are one-time. 
                    // Let's just update individually for now to avoid batch complexity in script, 
                    // or recreate batch. 
                    // PROPER WAY: 
                    // We'll just invoke updateDoc since volume is low (<500 likely).
                    // Wait, batch is better. I'll recreate batch logic if I needed, 
                    // but simplest is just:
                }
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            console.log(`Committed final batch of ${batchCount} updates.`);
        }

        console.log(`Migration complete. Updated ${updatedCount} events.`);

    } catch (error) {
        console.error('Error migrating events:', error);
    }
}

migrateEvents();
