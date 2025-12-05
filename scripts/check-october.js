const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkPosts() {
    // Oct 5th 2025 timestamp is approx 1759641600000
    // Let's query posts around this time.

    console.log('Querying posts...');
    const snapshot = await db.collection('posts')
        .orderBy('timestamp', 'desc')
        .get();

    console.log(`Total posts: ${snapshot.size}`);

    let foundOct = false;
    let count = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = new Date(data.timestamp);

        // Log posts from Sep-Oct 2025
        if (date.getFullYear() === 2025 && (date.getMonth() === 8 || date.getMonth() === 9)) {
            console.log(`[${count}] ${date.toISOString()} - ${data.id} - Type: ${typeof data.timestamp}`);
            foundOct = true;
        }
        count++;
    });

    if (!foundOct) {
        console.log('No posts found in Sep/Oct 2025!');
    }
}

checkPosts().catch(console.error);
