const admin = require('firebase-admin');

// Initialize with default credentials (works locally with emulator or if logged in via gcloud)
// For this script to work against the real DB, we might need to set GOOGLE_APPLICATION_CREDENTIALS
// or just rely on the fact that we are in a logged-in environment.
// However, since we don't have a service account key file easily handy, 
// we will try to use the application default credentials.

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'bethel-metro-social'
    });
}

const db = admin.firestore();

async function seedPost() {
    console.log('Seeding mock Facebook post...');
    try {
        await db.collection('posts').doc('mock_fb_1').set({
            type: 'facebook',
            content: 'This is a test post from the Facebook integration! Join us for worship.',
            mediaUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800&q=80',
            sourceId: '123456789',
            timestamp: Date.now(),
            pinned: false,
            author: {
                name: 'Bethel Metropolitan',
                avatarUrl: null
            },
            externalUrl: 'https://facebook.com/bethel/posts/123',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Successfully seeded post!');
    } catch (error) {
        console.error('Error seeding post:', error);
    }
}

seedPost();
