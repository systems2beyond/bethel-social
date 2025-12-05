const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'bethel-metro-social',
    });
}

const db = admin.firestore();

async function checkPosts() {
    console.log('Checking posts collection...');
    const snapshot = await db.collection('posts').count().get();
    console.log(`Total posts: ${snapshot.data().count}`);

    const recent = await db.collection('posts')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    console.log('Recent posts:');
    recent.forEach(doc => {
        const data = doc.data();
        console.log(`- [${new Date(data.timestamp).toISOString()}] ${data.content ? data.content.substring(0, 50) : 'No content'}...`);
    });
}

checkPosts();
