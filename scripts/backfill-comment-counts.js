const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'bethel-metro-social'
});

const db = admin.firestore();

async function backfillCommentCounts() {
    console.log('Starting comment count backfill...');
    const postsSnapshot = await db.collection('posts').get();

    let totalUpdated = 0;

    for (const postDoc of postsSnapshot.docs) {
        const commentsSnapshot = await postDoc.ref.collection('comments').count().get();
        const count = commentsSnapshot.data().count;

        if (count > 0 || postDoc.data().comments !== undefined) {
            await postDoc.ref.update({ comments: count });
            console.log(`Updated post ${postDoc.id}: ${count} comments`);
            totalUpdated++;
        }
    }

    console.log(`Backfill complete. Updated ${totalUpdated} posts.`);
}

backfillCommentCounts().catch(console.error);
