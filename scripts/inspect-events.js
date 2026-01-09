const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function inspectEvents() {
    console.log('Fetching events...');
    const snapshot = await db.collection('events').limit(10).get();

    if (snapshot.empty) {
        console.log('No events found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\nEvent ID: ${doc.id}`);
        console.log('Fields:', Object.keys(data).join(', '));
        // Log specific potential differentiator fields
        console.log('Status:', data.status);
        console.log('Has extractedData:', !!data.extractedData);
        console.log('Source:', data.source || 'N/A');
        console.log('Created At:', data.createdAt ? data.createdAt.toDate() : 'N/A');
        console.log('Title:', data.title);
    });
}

inspectEvents().catch(console.error);
