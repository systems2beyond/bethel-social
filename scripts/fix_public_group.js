const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'bethel-metro-social'
    });
}

const db = getFirestore();
const GROUP_ID = 'GSr8mr0uPOpCb3YN1IWf';

async function fixGroup() {
    console.log(`Fixing group ${GROUP_ID}...`);
    try {
        const groupRef = db.collection('groups').doc(GROUP_ID);
        const doc = await groupRef.get();
        if (!doc.exists) {
            console.error('Group not found!');
            return;
        }

        await groupRef.update({
            privacy: 'public',
            'settings.invitePermission': 'everyone',
            'settings.joinPolicy': 'open'
        });

        console.log('Group updated to PUBLIC.');
    } catch (error) {
        console.error('Error updating group:', error);
    }
}

fixGroup();
