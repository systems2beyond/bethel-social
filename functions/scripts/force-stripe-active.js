const admin = require('firebase-admin');

// Initialize with Application Default Credentials
admin.initializeApp();

const db = admin.firestore();

async function fixStatus() {
    try {
        console.log('Updating church/default_church...');
        await db.collection('churches').doc('default_church').update({
            stripeAccountStatus: 'active',
            stripeDetailsSubmitted: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Successfully updated status to active.');
    } catch (error) {
        console.error('Error updating document:', error);
    }
}

fixStatus();
