const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function fixDonation() {
    try {
        console.log('Updating donation 8onk3TBgPRJKWc4cZn9L to paid...');
        await db.collection('donations').doc('8onk3TBgPRJKWc4cZn9L').update({
            status: 'paid',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Successfully updated donation status.');
    } catch (error) {
        console.error('Error updating document:', error);
    }
}

fixDonation();
