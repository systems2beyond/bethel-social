
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkInvitations() {
    console.log('Checking all invitations...');
    const snapshot = await db.collection('invitations').get();

    if (snapshot.empty) {
        console.log('No invitations found in the entire collection.');
        return;
    }

    console.log(`Found ${snapshot.size} total invitations.`);
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  To User: ${data.toUserId}`);
        console.log(`  From: ${data.fromUser?.displayName} (${data.fromUser?.uid})`);
        console.log(`  Title: ${data.title}`);
        console.log(`  Resource: ${data.resourceId}`);
        console.log(`  Created At: ${data.createdAt?.toDate()}`);
        console.log('---');
    });
}

checkInvitations().catch(console.error);
