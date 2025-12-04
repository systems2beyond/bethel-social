import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as crypto from 'crypto';

interface FacebookPost {
    id: string;
    message?: string;
    full_picture?: string;
    created_time: string;
    permalink_url: string;
    attachments?: {
        data: Array<{
            media?: {
                source?: string; // Video URL
            }
        }>
    }
}

export const syncFacebookPosts = async () => {
    logger.info('Starting Facebook sync...');

    const PAGE_ID = process.env.FB_PAGE_ID;
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

    if (!PAGE_ID || !ACCESS_TOKEN) {
        logger.error('Missing Facebook credentials (FB_PAGE_ID or FB_ACCESS_TOKEN)');
        return;
    }

    try {
        // Fetch posts from Facebook Graph API
        const response = await axios.get(`https://graph.facebook.com/v18.0/${PAGE_ID}/feed`, {
            params: {
                access_token: ACCESS_TOKEN,
                fields: 'id,message,full_picture,created_time,permalink_url,attachments{media}',
                limit: 10,
            },
        });

        const fbPosts: FacebookPost[] = response.data.data;
        const db = admin.firestore();
        const batch = db.batch();

        for (const post of fbPosts) {
            // Skip posts without content/media
            if (!post.message && !post.full_picture) continue;

            const postRef = db.collection('posts').doc(`fb_${post.id}`);

            // Check for video in attachments
            let mediaUrl = post.full_picture;
            if (post.attachments?.data[0]?.media?.source) {
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
        }

        await batch.commit();
        logger.info(`Successfully synced ${fbPosts.length} Facebook posts.`);

    } catch (error) {
        logger.error('Error syncing Facebook posts:', error);
    }
};

export const facebookWebhook = async (req: any, res: any) => {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
    const APP_SECRET = process.env.FB_APP_SECRET;

    // 1. Handle Verification Request (GET)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                logger.info('WEBHOOK_VERIFIED');
                res.status(200).send(challenge);
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(400);
        }
        return;
    }

    // 2. Handle Event Notifications (POST)
    if (req.method === 'POST') {
        const body = req.body;

        if (body.object === 'page') {
            body.entry.forEach(async (entry: any) => {
                const webhookEvent = entry.changes[0];
                logger.info('Received webhook event:', webhookEvent);

                // Process new post
                if (webhookEvent.field === 'feed' && webhookEvent.value.item === 'post' && webhookEvent.value.verb === 'add') {
                    const postId = webhookEvent.value.post_id;
                    logger.info(`New post detected: ${postId}. Triggering sync/fetch.`);
                    await syncFacebookPosts();
                }
            });

            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    }
};
