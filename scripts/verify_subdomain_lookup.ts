
const admin = require('firebase-admin');

// Initialize Admin SDK
// Assumes GOOGLE_APPLICATION_CREDENTIALS or emulator is set, or default init works locally if authenticated via gcloud
if (!admin.apps.length) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'; // Force emulator for safety
    admin.initializeApp({
        projectId: 'demo-bethel-social' // Emulator project ID
    });
}

const db = admin.firestore();

async function verifyLookup() {
    console.log('🧪 Starting Subdomain Lookup Test...');

    const testSubdomain = 'unit-test_' + Date.now();
    const testChurchId = 'church_' + Date.now();

    try {
        // 1. Setup: Create a test church
        console.log(`1. Creating test church: ${testChurchId} (subdomain: ${testSubdomain})`);
        await db.collection('churches').doc(testChurchId).set({
            name: 'Unit Test Church',
            subdomain: testSubdomain,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Execute: Simulate the lookup query
        console.log('2. Executing Lookup Query...');
        const snapshot = await db.collection('churches')
            .where('subdomain', '==', testSubdomain)
            .limit(1)
            .get();

        // 3. Verify
        if (snapshot.empty) {
            console.error('❌ FAILURE: Lookup returned no results.');
            process.exit(1);
        }

        const foundId = snapshot.docs[0].id;
        if (foundId === testChurchId) {
            console.log('✅ SUCCESS: Resolved correct Church ID:', foundId);
        } else {
            console.error(`❌ FAILURE: Resolved WRONG ID. Expected ${testChurchId}, got ${foundId}`);
            process.exit(1);
        }

        // 4. Cleanup
        console.log('4. Cleaning up...');
        await db.collection('churches').doc(testChurchId).delete();
        console.log('✨ Test Complete.');

    } catch (error) {
        console.error('❌ ERROR:', error);
        process.exit(1);
    }
}

verifyLookup();
