
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
// Initialize Firebase Admin
// Try to find service account key
const serviceAccountPath = path.join(__dirname, '..', 'service-account-key.json');
let serviceAccount;

try {
    serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Initialized with service-account-key.json');
} catch (e) {
    console.log('Service account key not found, attempting to use Application Default Credentials...');
    admin.initializeApp({
        projectId: 'bethel-metro-social'
    });
}

const db = admin.firestore();

async function makeAdmin(email) {
    if (!email) {
        console.error('Please provide an email address.');
        console.log('Usage: node scripts/make-admin.js <email>');
        process.exit(1);
    }

    console.log(`Looking up user with email: ${email}...`);

    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        console.log(`Found user: ${uid} `);

        // Update Firestore document
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log('User document does not exist in Firestore. Creating one...');
            await userRef.set({
                email: email,
                role: 'admin',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            console.log(`Current role: ${doc.data().role || 'none'} `);
            await userRef.update({ role: 'admin' });
        }

        // Set Custom Claims (optional but recommended for security rules)
        await admin.auth().setCustomUserClaims(uid, { role: 'admin' });

        console.log(`Successfully promoted ${email} to ADMIN.`);
        process.exit(0);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Get email from command line argument
const email = process.argv[2];
makeAdmin(email);
