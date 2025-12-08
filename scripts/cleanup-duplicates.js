const admin = require('firebase-admin');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'bethel-metro-social'
    });
}

const db = admin.firestore();

async function cleanupDuplicates() {
    console.log('--- Starting Duplicate Cleanup ---');

    // 1. Fetch all posts
    console.log('Fetching all posts...');
    const snapshot = await db.collection('posts').get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Total posts found: ${posts.length}`);

    // 2. Identify Native YouTube Posts
    const youtubePosts = posts.filter(p => p.id.startsWith('yt_'));
    const youtubeVideoIds = new Set(youtubePosts.map(p => p.sourceId));
    console.log(`Native YouTube posts: ${youtubePosts.length}`);

    // 3. Identify Facebook Posts to Check
    const facebookPosts = posts.filter(p => p.id.startsWith('fb_'));
    console.log(`Facebook posts to check: ${facebookPosts.length}`);

    let deletedCount = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const post of facebookPosts) {
        let videoId = null;

        // Check mediaUrl
        if (post.mediaUrl) {
            const match = post.mediaUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (match && match[1]) videoId = match[1];
        }

        // Check externalUrl if not found
        if (!videoId && post.externalUrl) {
            const match = post.externalUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (match && match[1]) videoId = match[1];
        }

        // Check content if not found (sometimes just a link in text)
        if (!videoId && post.content) {
            const match = post.content.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (match && match[1]) videoId = match[1];
        }

        if (videoId) {
            if (youtubeVideoIds.has(videoId)) {
                console.log(`[DELETE] Found duplicate! FB Post: ${post.id} -> YouTube Video: ${videoId}`);
                const ref = db.collection('posts').doc(post.id);
                batch.delete(ref);
                batchCount++;
                deletedCount++;
            }
        }
    }

    if (batchCount > 0) {
        console.log(`Committing batch delete of ${batchCount} posts...`);
        await batch.commit();
        console.log('Cleanup complete.');
    } else {
        console.log('No duplicates found.');
    }
}

cleanupDuplicates();
