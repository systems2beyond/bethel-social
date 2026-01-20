const admin = require('firebase-admin');

// Initialize Firebase Admin (Default Creds)
admin.initializeApp();
const db = admin.firestore();

const TARGET_ID = '120720411275822_1260518452765904';

async function checkDeduplication() {
    console.log('--- Checking Deduplication Logic ---');

    // 1. Get Target Post
    let target = null;
    const targetDoc = await db.collection('posts').doc(TARGET_ID).get();
    if (targetDoc.exists) {
        target = { id: targetDoc.id, ...targetDoc.data() };
        console.log('✅ Target Post Found:', {
            id: target.id,
            type: target.type,
            timestamp: new Date(target.timestamp).toISOString(),
            mediaUrl: target.sourceUrl || target.mediaUrl || 'N/A',
            url: target.externalUrl || 'N/A',
            contentSnippet: target.content?.substring(0, 50)
        });
    } else {
        console.log('❌ Target Post NOT Found');
    }

    // 2. Get Live Post
    const liveQuery = await db.collection('posts').where('isLive', '==', true).get();
    if (!liveQuery.empty) {
        const live = liveQuery.docs[0].data();
        live.id = liveQuery.docs[0].id;
        console.log('📺 LIVE Post Found:', {
            id: live.id,
            type: live.type,
            timestamp: new Date(live.timestamp).toISOString(),
            mediaUrl: live.mediaUrl || 'N/A',
            url: live.externalUrl || 'N/A'
        });

        // 3. Simulate Frontend Filter Logic
        let hidden = false;
        if (target) {
            if (target.id === live.id) {
                console.log('⚠️ HIDDEN: Target IS the Live Post.');
                hidden = true;
            }
            if (target.mediaUrl && live.mediaUrl && target.mediaUrl === live.mediaUrl) {
                console.log('⚠️ HIDDEN: Same mediaUrl.');
                hidden = true;
            }
            if (live.mediaUrl && target.content && target.content.includes(live.mediaUrl)) {
                console.log('⚠️ HIDDEN: Target content contains Live URL.');
                hidden = true;
            }

            if (!hidden) console.log('✅ PASS: Target would NOT be hidden by Live post.');
        }

    } else {
        console.log('ℹ️ No Live Post currently active.');
    }
}

checkDeduplication();
