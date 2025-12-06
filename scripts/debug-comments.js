const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkComments() {
    const postId = 'fb_120720411275822_1256197753197974'; // The recent post
    console.log(`Checking comments for post: ${postId}`);

    const snapshot = await db.collection('posts').doc(postId).collection('comments')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    if (snapshot.empty) {
        console.log('No comments found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log('--------------------------------');
        console.log(`ID: ${doc.id}`);
        console.log(`Author: ${data.author.name} (${data.author.id})`);
        console.log(`Content: ${data.content}`);
        console.log(`ParentID: ${data.parentId || 'UNDEFINED'}`);
        console.log(`IsAI: ${data.isAi}`);
    });
}

checkComments().catch(console.error);
