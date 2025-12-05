const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function simulateScroll() {
    console.log('Starting scroll simulation...');

    let lastDoc = null;
    let page = 1;
    let totalFetched = 0;
    let keepGoing = true;

    while (keepGoing) {
        let query = db.collection('posts')
            .orderBy('timestamp', 'desc')
            .limit(10);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            console.log(`Page ${page}: No more results.`);
            keepGoing = false;
            break;
        }

        console.log(`Page ${page}: Fetched ${snapshot.size} posts.`);

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const date = new Date(data.timestamp).toISOString();
            console.log(` - [${date}] ${doc.id} (Timestamp type: ${typeof data.timestamp})`);
        });

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        totalFetched += snapshot.size;
        page++;

        // Safety break
        if (page > 20) {
            console.log('Stopping after 20 pages.');
            keepGoing = false;
        }
    }

    console.log(`Simulation complete. Total fetched: ${totalFetched}`);
}

simulateScroll().catch(console.error);
