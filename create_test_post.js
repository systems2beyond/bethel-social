const admin = require('firebase-admin');

// Initialize with default credentials (assumes GOOGLE_APPLICATION_CREDENTIALS is set or gcloud auth is active)
// Since we are in the user's environment, we might not have a service account key handy.
// However, we can try to use the `firebase-admin` if we are running in an environment that supports it.
// Alternatively, we can use the `firebase-tools` or just ask the user to create a post via the UI.
// But I want to automate verification.

// Let's try to use the `firebase-admin` with application default credentials.
// If this fails, I'll ask the user to create a post.

try {
    admin.initializeApp({
        projectId: 'bethel-metro-social'
    });
} catch (e) {
    // If already initialized
}

const db = admin.firestore();

async function createTestPost() {
    const postId = 'test_event_post_' + Date.now();
    console.log(`Creating test post: ${postId}`);

    await db.collection('posts').doc(postId).set({
        content: "Join us for our Annual Community Picnic! Saturday, July 15th at 12:00 PM. Central Park. Food, games, and fun for everyone!",
        mediaUrl: "https://images.unsplash.com/photo-1530103862676-de3c9a59af38?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80", // Generic picnic image
        type: "image",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        author: {
            name: "Bethel Admin",
            image: "https://ui-avatars.com/api/?name=Bethel+Admin"
        }
    });

    console.log("Test post created. Watch logs for extraction.");
}

createTestPost().catch(console.error);
