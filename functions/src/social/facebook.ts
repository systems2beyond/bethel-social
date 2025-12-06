import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import axios from 'axios';
// import * as crypto from 'crypto';

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

export const syncFacebookPosts = async (backfill = false) => {
    logger.info(`Starting Facebook sync (Backfill: ${backfill})...`);

    const PAGE_ID = process.env.FB_PAGE_ID;
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

    if (!PAGE_ID || !ACCESS_TOKEN) {
        logger.error('Missing Facebook credentials (FB_PAGE_ID or FB_ACCESS_TOKEN)');
        return;
    }

    try {
        let params: any = {
            access_token: ACCESS_TOKEN,
            fields: 'id,message,full_picture,created_time,permalink_url,attachments{media}',
            limit: backfill ? 50 : 10,
        };

        if (backfill) {
            // Use Unix timestamp in seconds for 'since'
            params.since = Math.floor(new Date('2025-01-01').getTime() / 1000);
        }

        let url = `https://graph.facebook.com/v18.0/${PAGE_ID}/feed`;
        let hasNext = true;
        let totalSynced = 0;
        const db = admin.firestore();

        // Debug info to write to Firestore
        const debugInfo = {
            startTime: new Date().toISOString(),
            pages: [] as any[],
            error: null as any
        };

        while (hasNext) {
            const response = await axios.get(url, { params });
            const fbPosts: FacebookPost[] = response.data.data;

            debugInfo.pages.push({
                url: url,
                postCount: fbPosts.length,
                hasPaging: !!response.data.paging,
                hasNext: !!response.data.paging?.next
            });

            if (fbPosts.length === 0) {
                break;
            }

            const batch = db.batch();
            let batchCount = 0;

            for (const post of fbPosts) {
                // Skip posts without content/media
                if (!post.message && !post.full_picture) continue;

                const postRef = db.collection('posts').doc(`fb_${post.id}`);

                // Check for video in attachments
                let mediaUrl = post.full_picture;
                let postType: 'facebook' | 'video' | 'youtube' = 'facebook';
                let thumbnailUrl = null;

                if (post.attachments?.data[0]?.media?.source) {
                    mediaUrl = post.attachments.data[0].media.source;
                    if (mediaUrl && (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))) {
                        postType = 'youtube';
                    } else {
                        postType = 'video';
                    }
                    thumbnailUrl = post.full_picture || null;
                }

                batch.set(postRef, {
                    type: postType,
                    content: post.message || '',
                    mediaUrl: mediaUrl || null,
                    thumbnailUrl: thumbnailUrl,
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
                batchCount++;
            }

            if (batchCount > 0) {
                await batch.commit();
                totalSynced += batchCount;
                logger.info(`Synced batch of ${batchCount} posts.`);
            }

            // Pagination logic
            if (backfill && response.data.paging && response.data.paging.next) {
                url = response.data.paging.next;
                params = {}; // Params are included in the 'next' URL
                logger.info(`Fetching next page...`);
            } else {
                logger.info('No more pages or backfill disabled.', { backfill, paging: response.data.paging });
                hasNext = false;
            }
        }

        logger.info(`Successfully synced total ${totalSynced} Facebook posts.`);

        // Save debug info
        await db.collection('system').doc('facebook_sync_debug').set(debugInfo);

    } catch (error: any) {
        logger.error('Error syncing Facebook posts:', error);
        if (error.response) {
            logger.error('Facebook API Error Data:', error.response.data);
        }
        const db = admin.firestore();
        await db.collection('system').doc('facebook_sync_debug').set({
            error: error.message,
            response: error.response?.data || null,
            timestamp: new Date().toISOString()
        }, { merge: true });
    }
};

export const facebookWebhook = async (req: any, res: any) => {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
    // const APP_SECRET = process.env.FB_APP_SECRET;

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
