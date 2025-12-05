const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkPost() {
    try {
        // Get the most recent facebook post
        const snapshot = await db.collection('posts')
            .where('type', '==', 'facebook')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log('No Facebook posts found.');
            return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        console.log('Post ID:', doc.id);
        console.log('Timestamp:', new Date(data.timestamp).toISOString());
        console.log('UpdatedAt:', data.updatedAt ? new Date(data.updatedAt.toDate()).toISOString() : 'N/A');
        console.log('Media URL:', data.mediaUrl);
        console.log('Content:', data.content);

    } catch (error) {
        console.error('Error:', error);
    }
}

checkPost();
