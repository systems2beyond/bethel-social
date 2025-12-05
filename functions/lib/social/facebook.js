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
exports.facebookWebhook = exports.syncFacebookPosts = void 0;
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const syncFacebookPosts = async (backfill = false) => {
    var _a, _b, _c, _d, _e;
    logger.info(`Starting Facebook sync (Backfill: ${backfill})...`);
    const PAGE_ID = process.env.FB_PAGE_ID;
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
    if (!PAGE_ID || !ACCESS_TOKEN) {
        logger.error('Missing Facebook credentials (FB_PAGE_ID or FB_ACCESS_TOKEN)');
        return;
    }
    try {
        let params = {
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
                hasNext: !!((_a = response.data.paging) === null || _a === void 0 ? void 0 : _a.next)
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
                if ((_d = (_c = (_b = post.attachments) === null || _b === void 0 ? void 0 : _b.data[0]) === null || _c === void 0 ? void 0 : _c.media) === null || _d === void 0 ? void 0 : _d.source) {
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
            response: ((_e = error.response) === null || _e === void 0 ? void 0 : _e.data) || null,
            timestamp: new Date().toISOString()
        }, { merge: true });
    }
};
exports.syncFacebookPosts = syncFacebookPosts;
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