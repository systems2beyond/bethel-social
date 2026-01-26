import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { uploadImageToStorage } from '../media/images';

// Helper to ensure URL is a storage URL
const ensureStorageUrl = async (url: string | undefined | null, postId: string, suffix: string): Promise<string | null> => {
    if (!url) return null;

    // If already a storage URL, return it
    if (url.includes('storage.googleapis.com') || url.includes('firebasestorage.googleapis.com')) {
        return url;
    }

    try {
        const storageUrl = await uploadImageToStorage(url, `social/facebook/${postId}`, `image_${suffix}`);
        logger.info(`Persisted Facebook image for ${postId}: ${storageUrl}`);
        return storageUrl;
    } catch (e) {
        logger.error(`Failed to persist Facebook image for ${postId}:`, e);
        // Fallback to original URL if upload fails, but log it
        return url;
    }
};

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
                image?: { src: string };
            };
            subattachments?: {
                data: Array<{
                    media: {
                        image: {
                            src: string;
                        }
                    }
                }>
            }
        }>
    }
}

export const syncFacebookPosts = async (backfill = false) => {
    logger.info(`Starting Facebook sync (Backfill: ${backfill})...`);

    // Determine credentials considering both Env and Firestore
    let activePageId = process.env.FB_PAGE_ID;
    let activeAccessToken = process.env.FB_ACCESS_TOKEN;

    try {
        // Try fetching from Firestore (Dynamic Config) - PRIORITIZE THIS
        const settingsDoc = await admin.firestore().doc('settings/integrations').get();
        if (settingsDoc.exists) {
            const data = settingsDoc.data();

            // Detailed logging to help debug
            logger.info('Firestore Settings Found:', {
                hasFacebook: !!data?.facebook,
                pageId: data?.facebook?.pageId ? 'Found' : 'Missing',
                token: data?.facebook?.accessToken ? 'Found' : 'Missing'
            });

            if (data?.facebook?.pageId) {
                activePageId = data.facebook.pageId;
                logger.info('Using Facebook Page ID from Firestore (overriding/augmenting env).');
            }
            if (data?.facebook?.accessToken) {
                activeAccessToken = data.facebook.accessToken;
                logger.info('Using Facebook Access Token from Firestore (overriding/augmenting env).');
            }
        }
    } catch (e) {
        logger.error('Error reading settings/integrations', e);
    }

    if (!activePageId || !activeAccessToken) {
        logger.error('Missing Facebook credentials (Env Vars or Firestore)');
        return;
    }

    // Replace usages below with activePageId and activeAccessToken


    try {
        let params: any = {
            access_token: activeAccessToken,
            fields: 'id,message,full_picture,created_time,permalink_url,attachments{media,subattachments}',
            limit: backfill ? 50 : 10,
        };

        if (backfill) {
            // Use Unix timestamp in seconds for 'since'
            params.since = Math.floor(new Date('2025-01-01').getTime() / 1000);
        }

        let url = `https://graph.facebook.com/v18.0/${activePageId}/feed`;
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
                let youtubeVideoId = null;
                let images: string[] = [];

                // Handle Attachments (Multi-image or Video)
                if (post.attachments?.data[0]) {
                    const attachment = post.attachments.data[0];

                    // 1. Check for Subattachments (Multi-image)
                    if (attachment.subattachments?.data) {
                        images = attachment.subattachments.data
                            .map((sub: any) => sub.media?.image?.src)
                            .filter((src: string) => !!src);
                    }

                    // If no subattachments but we have a main media (single image), put it in images array too
                    if (images.length === 0 && attachment.media?.image?.src) {
                        images.push(attachment.media.image.src);
                    }

                    // 2. Check for Video
                    if (attachment.media?.source) {
                        mediaUrl = attachment.media.source;
                        if (mediaUrl && (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))) {
                            postType = 'youtube';
                            // Extract Video ID
                            const match = mediaUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                            if (match && match[1]) {
                                youtubeVideoId = match[1];

                                // CHECK: Does this video already exist as a native YouTube post?
                                const existingYtDoc = await db.collection('posts').doc(`yt_${youtubeVideoId}`).get();
                                if (existingYtDoc.exists) {
                                    logger.info(`Skipping Facebook post ${post.id} because it duplicates YouTube video ${youtubeVideoId}`);
                                    continue;
                                }
                            }
                        } else {
                            postType = 'video';
                        }
                        thumbnailUrl = post.full_picture || null;
                    }
                }

                // Fallback: If no attachments data but full_picture exists (legacy/simple post)
                if (images.length === 0 && post.full_picture && postType === 'facebook') {
                    images.push(post.full_picture);
                }

                // Persist Images to Storage
                // 1. Persist Main Media URL (if it's an image)
                let finalMediaUrl = mediaUrl;
                if (mediaUrl && postType === 'facebook') { // Only persist if it's a direct image, not video stream URL
                    finalMediaUrl = await ensureStorageUrl(mediaUrl, post.id, 'main') || mediaUrl;
                }

                // 2. Persist Gallery Images
                const finalImages: string[] = [];
                for (let i = 0; i < images.length; i++) {
                    const imgUrl = images[i];
                    const storageUrl = await ensureStorageUrl(imgUrl, post.id, `gallery_${i}`);
                    if (storageUrl) finalImages.push(storageUrl);
                }

                batch.set(postRef, {
                    type: postType,
                    content: post.message || '',
                    mediaUrl: finalMediaUrl || null,
                    images: finalImages,
                    thumbnailUrl: thumbnailUrl,
                    sourceId: post.id,
                    youtubeVideoId: youtubeVideoId, // Save for reverse-lookup cleanup
                    timestamp: new Date(post.created_time).getTime(),
                    pinned: false,
                    author: {
                        name: 'Bethel Metropolitan',
                        avatarUrl: null
                    },
                    externalUrl: post.permalink_url,
                    churchId: 'default_church', // Hardcoded for single-tenant migration phase
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

export const syncFacebookLiveStatus = async () => {
    logger.info('Checking Facebook Live status...');
    const PAGE_ID = process.env.FB_PAGE_ID;
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

    if (!PAGE_ID || !ACCESS_TOKEN) return;

    const db = admin.firestore();

    try {
        // 1. Get currently LIVE videos
        const response = await axios.get(`https://graph.facebook.com/v18.0/${PAGE_ID}/live_videos`, {
            params: {
                access_token: ACCESS_TOKEN,
                status: 'LIVE_NOW',
                fields: 'id,description,title,embed_html,permalink_url,status,creation_time'
            }
        });

        const liveVideos = response.data.data;
        const liveVideoIds = new Set(liveVideos.map((v: any) => v.id));

        // 2. Update/Create Live Posts
        const batch = db.batch();

        for (const video of liveVideos) {
            const postRef = db.collection('posts').doc(`fb_${video.id}`);

            batch.set(postRef, {
                type: 'facebook_live',
                content: video.description || video.title || 'Live Stream',
                mediaUrl: video.permalink_url,
                thumbnailUrl: null,
                sourceId: video.id,
                timestamp: new Date(video.creation_time).getTime(),
                pinned: true,
                isLive: true,
                author: {
                    name: 'Bethel Metropolitan',
                    avatarUrl: null
                },
                externalUrl: video.permalink_url,
                churchId: 'default_church', // Hardcoded for single-tenant migration phase
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        // 3. Find old live posts that are no longer live and unmark them
        const oldLiveSnapshot = await db.collection('posts')
            .where('type', '==', 'facebook_live')
            .where('isLive', '==', true)
            .get();

        oldLiveSnapshot.docs.forEach(doc => {
            const sourceId = doc.data().sourceId;
            if (!liveVideoIds.has(sourceId)) {
                batch.update(doc.ref, {
                    isLive: false,
                    pinned: false,
                    type: 'facebook_video'
                });
            }
        });

        await batch.commit();
        logger.info(`Synced Facebook Live status. Found ${liveVideos.length} live videos.`);

    } catch (error: any) {
        logger.error('Error syncing Facebook Live status:', error);
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
