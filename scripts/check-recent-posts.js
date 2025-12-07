const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRecentPosts() {
    console.log('Fetching recent posts...');
    const snapshot = await db.collection('posts')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    if (snapshot.empty) {
        console.log('No posts found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`[${doc.id}] ${new Date(data.timestamp).toISOString()} - Type: ${data.type} - Pinned: ${data.pinned} - Live: ${data.isLive}`);
        console.log(`Title: ${data.content.substring(0, 50)}...`);
        console.log(`Media: ${data.mediaUrl}`);
        console.log('---');
    });
}

checkRecentPosts().catch(console.error);
