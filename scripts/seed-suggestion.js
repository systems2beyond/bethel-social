const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function createMockSuggestion() {
    try {
        const mockId = 'mock_suggestion_' + Date.now();
        await db.collection('suggested_events').doc(mockId).set({
            title: 'Mock AI Event: Community Picnic',
            description: 'Join us for a fun afternoon at the park! Food and games provided.',
            date: admin.firestore.Timestamp.fromDate(new Date('2025-07-04T12:00:00')),
            location: 'Central Park',
            imageUrl: 'https://images.unsplash.com/photo-1596728343714-3d072483161c',
            sourcePostId: 'post_' + Date.now(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            extractedData: {
                confidence: 0.95,
                source: 'facebook'
            }
        });
        console.log('Mock suggestion created:', mockId);
    } catch (error) {
        console.error('Error creating mock suggestion:', error);
    }
}

createMockSuggestion();
