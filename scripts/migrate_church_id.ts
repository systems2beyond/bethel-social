import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// INITIALIZATION
// Ensure you have SERVICE_ACCOUNT_KEY path in env or locally
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_KEY || path.join(process.cwd(), 'service-account.json');

// FALLBACK CHURCH ID for existing data
const DEFAULT_CHURCH_ID = 'bethel-metro';

// CONFIGURATION
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to TRUE for safety. Run with DRY_RUN=false to execute.

async function init() {
    if (!getApps().length) {
        try {
            initializeApp({
                credential: cert(require(SERVICE_ACCOUNT_PATH))
            });
        } catch (e) {
            console.error("Failed to init Firebase Admin. Make sure 'service-account.json' exists in project root or specify SERVICE_ACCOUNT_KEY.");
            process.exit(1);
        }
    }
}

async function migrateCollection(collectionName: string) {
    console.log(`\nStarting migration for: ${collectionName}`);
    const db = getFirestore();
    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
        console.log(`No documents found in ${collectionName}.`);
        return;
    }

    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if already has churchId
        if (data.churchId) {
            continue;
        }

        const updateData = { churchId: DEFAULT_CHURCH_ID };

        if (DRY_RUN) {
            console.log(`[DRY RUN] Would update ${collectionName}/${doc.id} with`, updateData);
        } else {
            batch.update(doc.ref, updateData);
        }

        count++;
        totalUpdated++;

        // Commit batch every 400 ops
        if (count >= 400) {
            if (!DRY_RUN) {
                await batch.commit();
                batch = db.batch();
            }
            console.log(`Processed ${totalUpdated} docs...`);
            count = 0;
        }
    }

    // Final batch
    if (count > 0 && !DRY_RUN) {
        await batch.commit();
    }

    console.log(`Finished ${collectionName}. Target Updates: ${totalUpdated}. Mode: ${DRY_RUN ? 'DRY RUN (No changes)' : 'LIVE EXECUTION'}`);
}

async function main() {
    await init();

    console.log(`
    =============================================
    MULTI-CHURCH MIGRATION SCRIPT
    Target Church ID: ${DEFAULT_CHURCH_ID}
    Mode: ${DRY_RUN ? 'DRY RUN (SAFE)' : '🚨 LIVE EXECUTION 🚨'}
    =============================================
    `);

    // Add delay for user to abort if live
    if (!DRY_RUN) {
        console.log("Starting in 5 seconds... Press Ctrl+C to abort.");
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 1. Users
    await migrateCollection('users');

    // 2. Posts
    await migrateCollection('posts');

    // 3. Groups
    await migrateCollection('groups');

    // 4. Events
    await migrateCollection('events');

    // 5. Sermons
    await migrateCollection('sermons');

    console.log("\nMigration Complete.");
}

main().catch(console.error);
