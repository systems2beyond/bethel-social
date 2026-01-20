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
                fields: 'id,message,full_picture,created_time,permalink_url,attachments{media,subattachments}',
                limit: 100, // Fetch last 100 posts
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
            let images = [];

            // Helper to get high-res image
            const getSrc = (mediaObj) => mediaObj?.image?.src || null;

            if (post.attachments && post.attachments.data && post.attachments.data[0]) {
                const attachment = post.attachments.data[0];

                // 1. Check for Video
                if (attachment.media && attachment.media.source) {
                    mediaUrl = attachment.media.source;
                }

                // 2. Check for Subattachments (Gallery)
                if (attachment.subattachments && attachment.subattachments.data) {
                    images = attachment.subattachments.data
                        .map(sub => sub.media?.image?.src)
                        .filter(src => !!src);
                }

                // If no subattachments but we have a main image not used as video
                if (images.length === 0 && attachment.media?.image?.src) {
                    images.push(attachment.media.image.src);
                }
            }

            // Fallback to full_picture if no images found yet
            if (images.length === 0 && post.full_picture && !mediaUrl?.includes('mp4')) {
                images.push(post.full_picture);
            }

            batch.set(postRef, {
                type: 'facebook',
                content: post.message || '',
                mediaUrl: mediaUrl || null,
                images: images, // Save the flattened images array
                sourceId: post.id,
                timestamp: new Date(post.created_time).getTime(),
                pinned: false,
                author: {
                    name: 'Bethel Metropolitan',
                    avatarUrl: null
                },
                externalUrl: post.permalink_url,
                subattachments: post.attachments?.data[0]?.subattachments?.data || null,
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
