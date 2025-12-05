const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
// const serviceAccount = require('../service-account.json');
// For local dev without service account file, we can try default credentials if 'firebase login' was run
// But 'firebase-admin' usually needs a key file or GOOGLE_APPLICATION_CREDENTIALS.
// Let's try to use the default app if already initialized, or initialize with applicationDefault()

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        });
    } catch (e) {
        console.log('Error initializing Firebase Admin:', e);
        console.log('Please ensure you have set GOOGLE_APPLICATION_CREDENTIALS or are logged in via gcloud.');
        process.exit(1);
    }
}

const syncFacebookPosts = async () => {
    console.log('Starting Facebook sync...');

    const PAGE_ID = process.env.FB_PAGE_ID;
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

    if (!PAGE_ID || !ACCESS_TOKEN) {
        console.error('Missing Facebook credentials (FB_PAGE_ID or FB_ACCESS_TOKEN) in .env.local');
        return;
    }

    try {
        // Fetch posts from Facebook Graph API
        const response = await axios.get(`https://graph.facebook.com/v18.0/${PAGE_ID}/feed`, {
            params: {
                access_token: ACCESS_TOKEN,
                fields: 'id,message,full_picture,created_time,permalink_url,attachments{media}',
                limit: 20, // Fetch last 20 posts
            },
        });

        const fbPosts = response.data.data;
        const db = admin.firestore();
        const batch = db.batch();

        let count = 0;
        for (const post of fbPosts) {
            // Skip posts without content/media
            if (!post.message && !post.full_picture) continue;

            const postRef = db.collection('posts').doc(`fb_${post.id}`);

            // Check for video in attachments
            let mediaUrl = post.full_picture;
            if (post.attachments && post.attachments.data && post.attachments.data[0].media && post.attachments.data[0].media.source) {
                mediaUrl = post.attachments.data[0].media.source;
            }

            batch.set(postRef, {
                type: 'facebook',
                content: post.message || '',
                mediaUrl: mediaUrl || null,
                sourceId: post.id,
                timestamp: new Date(post.created_time).getTime(),
                pinned: false,
                author: {
                    name: 'Bethel Metropolitan',
                    avatarUrl: null
                },
                externalUrl: post.permalink_url,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            count++;
        }

        await batch.commit();
        console.log(`Successfully synced ${count} Facebook posts.`);

    } catch (error) {
        console.error('Error syncing Facebook posts:', error.response ? error.response.data : error.message);
    }
};

syncFacebookPosts();
