"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.facebookWebhook = exports.syncFacebookLiveStatus = exports.syncFacebookPosts = void 0;
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const syncFacebookPosts = async (backfill = false) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    logger.info(`Starting Facebook sync (Backfill: ${backfill})...`);
    // Determine credentials considering both Env and Firestore
    let activePageId = process.env.FB_PAGE_ID;
    let activeAccessToken = process.env.FB_ACCESS_TOKEN;
    if (!activePageId || !activeAccessToken) {
        try {
            // Try fetching from Firestore (Dynamic Config)
            const settingsDoc = await admin.firestore().doc('settings/integrations').get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                if (((_a = data === null || data === void 0 ? void 0 : data.facebook) === null || _a === void 0 ? void 0 : _a.pageId) && ((_b = data === null || data === void 0 ? void 0 : data.facebook) === null || _b === void 0 ? void 0 : _b.accessToken)) {
                    activePageId = data.facebook.pageId;
                    activeAccessToken = data.facebook.accessToken;
                    logger.info('Using Facebook credentials from Firestore settings.');
                }
            }
        }
        catch (e) {
            logger.error('Error reading settings', e);
        }
    }
    if (!activePageId || !activeAccessToken) {
        logger.error('Missing Facebook credentials (Env Vars or Firestore)');
        return;
    }
    // Replace usages below with activePageId and activeAccessToken
    try {
        let params = {
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
            pages: [],
            error: null
        };
        while (hasNext) {
            const response = await axios_1.default.get(url, { params });
            const fbPosts = response.data.data;
            debugInfo.pages.push({
                url: url,
                postCount: fbPosts.length,
                hasPaging: !!response.data.paging,
                hasNext: !!((_c = response.data.paging) === null || _c === void 0 ? void 0 : _c.next)
            });
            if (fbPosts.length === 0) {
                break;
            }
            const batch = db.batch();
            let batchCount = 0;
            for (const post of fbPosts) {
                // Skip posts without content/media
                if (!post.message && !post.full_picture)
                    continue;
                const postRef = db.collection('posts').doc(`fb_${post.id}`);
                // Check for video in attachments
                let mediaUrl = post.full_picture;
                let postType = 'facebook';
                let thumbnailUrl = null;
                let youtubeVideoId = null;
                let images = [];
                // Handle Attachments (Multi-image or Video)
                if ((_d = post.attachments) === null || _d === void 0 ? void 0 : _d.data[0]) {
                    const attachment = post.attachments.data[0];
                    // 1. Check for Subattachments (Multi-image)
                    if ((_e = attachment.subattachments) === null || _e === void 0 ? void 0 : _e.data) {
                        images = attachment.subattachments.data
                            .map((sub) => { var _a, _b; return (_b = (_a = sub.media) === null || _a === void 0 ? void 0 : _a.image) === null || _b === void 0 ? void 0 : _b.src; })
                            .filter((src) => !!src);
                    }
                    // If no subattachments but we have a main media (single image), put it in images array too
                    if (images.length === 0 && ((_g = (_f = attachment.media) === null || _f === void 0 ? void 0 : _f.image) === null || _g === void 0 ? void 0 : _g.src)) {
                        images.push(attachment.media.image.src);
                    }
                    // 2. Check for Video
                    if ((_h = attachment.media) === null || _h === void 0 ? void 0 : _h.source) {
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
                        }
                        else {
                            postType = 'video';
                        }
                        thumbnailUrl = post.full_picture || null;
                    }
                }
                // Fallback: If no attachments data but full_picture exists (legacy/simple post)
                if (images.length === 0 && post.full_picture && postType === 'facebook') {
                    images.push(post.full_picture);
                }
                batch.set(postRef, {
                    type: postType,
                    content: post.message || '',
                    mediaUrl: mediaUrl || null,
                    images: images,
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
            }
            else {
                logger.info('No more pages or backfill disabled.', { backfill, paging: response.data.paging });
                hasNext = false;
            }
        }
        logger.info(`Successfully synced total ${totalSynced} Facebook posts.`);
        // Save debug info
        await db.collection('system').doc('facebook_sync_debug').set(debugInfo);
    }
    catch (error) {
        logger.error('Error syncing Facebook posts:', error);
        if (error.response) {
            logger.error('Facebook API Error Data:', error.response.data);
        }
        const db = admin.firestore();
        await db.collection('system').doc('facebook_sync_debug').set({
            error: error.message,
            response: ((_j = error.response) === null || _j === void 0 ? void 0 : _j.data) || null,
            timestamp: new Date().toISOString()
        }, { merge: true });
    }
};
exports.syncFacebookPosts = syncFacebookPosts;
const syncFacebookLiveStatus = async () => {
    logger.info('Checking Facebook Live status...');
    const PAGE_ID = process.env.FB_PAGE_ID;
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
    if (!PAGE_ID || !ACCESS_TOKEN)
        return;
    const db = admin.firestore();
    try {
        // 1. Get currently LIVE videos
        const response = await axios_1.default.get(`https://graph.facebook.com/v18.0/${PAGE_ID}/live_videos`, {
            params: {
                access_token: ACCESS_TOKEN,
                status: 'LIVE_NOW',
                fields: 'id,description,title,embed_html,permalink_url,status,creation_time'
            }
        });
        const liveVideos = response.data.data;
        const liveVideoIds = new Set(liveVideos.map((v) => v.id));
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
    }
    catch (error) {
        logger.error('Error syncing Facebook Live status:', error);
    }
};
exports.syncFacebookLiveStatus = syncFacebookLiveStatus;
const facebookWebhook = async (req, res) => {
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
            }
            else {
                res.sendStatus(403);
            }
        }
        else {
            res.sendStatus(400);
        }
        return;
    }
    // 2. Handle Event Notifications (POST)
    if (req.method === 'POST') {
        const body = req.body;
        if (body.object === 'page') {
            body.entry.forEach(async (entry) => {
                const webhookEvent = entry.changes[0];
                logger.info('Received webhook event:', webhookEvent);
                // Process new post
                if (webhookEvent.field === 'feed' && webhookEvent.value.item === 'post' && webhookEvent.value.verb === 'add') {
                    const postId = webhookEvent.value.post_id;
                    logger.info(`New post detected: ${postId}. Triggering sync/fetch.`);
                    await (0, exports.syncFacebookPosts)();
                }
            });
            res.status(200).send('EVENT_RECEIVED');
        }
        else {
            res.sendStatus(404);
        }
    }
};
exports.facebookWebhook = facebookWebhook;
//# sourceMappingURL=facebook.js.map