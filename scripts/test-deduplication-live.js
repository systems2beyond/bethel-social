const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'bethel-metro-social'
    });
}

const db = admin.firestore();

// Configuration
const TARGET_VIDEO_ID = 'PdGY_wWTdGQ'; // The video we just fixed
const DUMMY_FB_POST_ID = 'fb_TEST_DUPLICATE_123';
const SYNC_ENDPOINT = 'https://manualyoutubesync-4xnaperncq-uc.a.run.app';

async function runTest() {
    console.log('--- Starting Deduplication Live Test ---');

    // 1. Create Dummy Facebook Post
    console.log(`1. Creating dummy Facebook post: ${DUMMY_FB_POST_ID} linked to YT Video: ${TARGET_VIDEO_ID}...`);
    await db.collection('posts').doc(DUMMY_FB_POST_ID).set({
        type: 'facebook',
        content: 'Check out our latest service!',
        mediaUrl: `https://youtube.com/watch?v=${TARGET_VIDEO_ID}`,
        sourceId: 'TEST_DUPLICATE_123',
        youtubeVideoId: TARGET_VIDEO_ID, // This is what the new FB sync logic would add
        timestamp: Date.now(),
        author: { name: 'Test Bot' },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('   Dummy post created.');

    // 2. Verify it exists
    let doc = await db.collection('posts').doc(DUMMY_FB_POST_ID).get();
    if (!doc.exists) {
        console.error('   ERROR: Failed to create dummy post.');
        return;
    }
    console.log('   Verified dummy post exists in Firestore.');

    // 3. Trigger YouTube Sync
    console.log('2. Triggering manualYoutubeSync (this should trigger cleanup)...');
    try {
        await axios.get(SYNC_ENDPOINT);
        console.log('   Sync triggered successfully.');
    } catch (e) {
        console.error('   ERROR triggering sync:', e.message);
        return;
    }

    // 4. Poll for Deletion
    console.log('3. Waiting for cleanup (polling Firestore)...');
    let deleted = false;
    for (let i = 0; i < 10; i++) {
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s
        doc = await db.collection('posts').doc(DUMMY_FB_POST_ID).get();
        if (!doc.exists) {
            deleted = true;
            break;
        }
    }
    console.log('');

    // 5. Report Result
    if (deleted) {
        console.log('✅ SUCCESS: The dummy Facebook post was automatically deleted by the YouTube sync!');
        console.log('   This confirms the deduplication logic is working correctly.');
    } else {
        console.error('❌ FAILURE: The dummy Facebook post still exists.');
        console.error('   The cleanup logic did not fire or failed.');

        // Cleanup manually if test failed
        await db.collection('posts').doc(DUMMY_FB_POST_ID).delete();
        console.log('   (Cleaned up dummy post manually)');
    }
}

runTest();
