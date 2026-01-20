const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'bethel-metro-social'
    });
}

const db = getFirestore();
const EVENT_ID = 'A6YjKUfpqOO7TrHQb5zZ';

async function checkRegistrations() {
    console.log(`Checking registrations for event ${EVENT_ID}...`);
    try {
        const regsRef = db.collection('events').doc(EVENT_ID).collection('registrations');
        const snapshot = await regsRef.get();

        if (snapshot.empty) {
            console.log('No registrations found.');
            return;
        }

        console.log(`Found ${snapshot.size} registrations:`);
        snapshot.forEach(doc => {
            console.log(doc.id, doc.data());
        });

    } catch (error) {
        console.error('Error fetching registrations:', error);
    }
}

checkRegistrations();
