const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUsers() {
    console.log('Fetching users...');
    const snapshot = await db.collection('users').get();

    if (snapshot.empty) {
        console.log('No users found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`User ID: ${doc.id}`);
        console.log(`Email: ${data.email}`);
        console.log(`DisplayName: '${data.displayName}'`);
        console.log(`Phone: ${data.phoneNumber}`);
        console.log('---');
    });
}

checkUsers().catch(console.error);
