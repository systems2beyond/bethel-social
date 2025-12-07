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
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncYoutubeContent = void 0;
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
const youtube = googleapis_1.google.youtube('v3');
const syncYoutubeContent = async () => {
    var _a, _b, _c, _d, _e, _f, _g;
    logger.info('Starting YouTube sync...');
    const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY; // Try both, prefer the one injected by secret
    let CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
    if (!API_KEY) {
        logger.error('Missing YouTube credentials (GOOGLE_AI_API_KEY)');
        return;
    }
    try {
        // 0. Resolve Channel ID if missing
        if (!CHANNEL_ID) {
            logger.info('Resolving channel ID for @BMBCFamily...');
            const searchResponse = await youtube.search.list({
                key: API_KEY,
                q: '@BMBCFamily',
                type: ['channel'],
                part: ['id'],
                maxResults: 1,
            });
            if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                CHANNEL_ID = ((_a = searchResponse.data.items[0].id) === null || _a === void 0 ? void 0 : _a.channelId) || undefined;
                logger.info(`Resolved Channel ID: ${CHANNEL_ID}`);
            }
            else {
                logger.error('Could not resolve channel ID for @BMBCFamily');
                return;
            }
        }
        // 1. Fetch latest videos
        const response = await youtube.search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'], // Search only supports snippet
            order: 'date',
            maxResults: 10, // Increased from 5
            type: ['video'],
        });
        // 2. Fetch currently LIVE video
        const liveResponse = await youtube.search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'],
            type: ['video'],
            eventType: 'live',
            maxResults: 1,
        });
        // 3. Fetch recently COMPLETED live videos (Standard search misses these sometimes)
        const completedResponse = await youtube.search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'],
            type: ['video'],
            eventType: 'completed',
            order: 'date',
            maxResults: 3,
        });
        const searchItems = [
            ...(response.data.items || []),
            ...(liveResponse.data.items || []),
            ...(completedResponse.data.items || [])
        ];
        const uniqueVideoIds = Array.from(new Set(searchItems.map(item => { var _a; return (_a = item.id) === null || _a === void 0 ? void 0 : _a.videoId; }).filter(id => !!id)));
        if (uniqueVideoIds.length === 0) {
            logger.info('No videos found.');
            return;
        }
        // 3. Fetch Video Details (needed for liveStreamingDetails)
        const videoDetailsResponse = await youtube.videos.list({
            key: API_KEY,
            id: uniqueVideoIds,
            part: ['snippet', 'liveStreamingDetails']
        });
        const items = videoDetailsResponse.data.items || [];
        logger.info(`Found ${items.length} videos. Processing...`);
        const db = admin.firestore();
        const batch = db.batch();
        for (const item of items) {
            if (!item.snippet || !item.id)
                continue;
            // Determine best timestamp: Actual Start -> Scheduled Start -> Published At
            let timestamp = new Date(item.snippet.publishedAt || new Date().toISOString()).getTime();
            if ((_b = item.liveStreamingDetails) === null || _b === void 0 ? void 0 : _b.actualStartTime) {
                timestamp = new Date(item.liveStreamingDetails.actualStartTime).getTime();
            }
            else if ((_c = item.liveStreamingDetails) === null || _c === void 0 ? void 0 : _c.scheduledStartTime) {
                timestamp = new Date(item.liveStreamingDetails.scheduledStartTime).getTime();
            }
            logger.info(`Processing video: ${item.snippet.title} (${item.id}) - Time: ${new Date(timestamp).toISOString()}`);
            const video = {
                id: item.id,
                title: item.snippet.title || 'Untitled Video',
                description: item.snippet.description || '',
                thumbnailUrl: ((_e = (_d = item.snippet.thumbnails) === null || _d === void 0 ? void 0 : _d.high) === null || _e === void 0 ? void 0 : _e.url) || ((_g = (_f = item.snippet.thumbnails) === null || _f === void 0 ? void 0 : _f.default) === null || _g === void 0 ? void 0 : _g.url) || '',
                publishedAt: new Date(timestamp).toISOString(),
                videoId: item.id,
                isLive: item.snippet.liveBroadcastContent === 'live',
            };
            const postRef = db.collection('posts').doc(`yt_${video.id}`);
            batch.set(postRef, {
                type: 'youtube',
                content: `${video.title}\n\n${video.description}`,
                mediaUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
                thumbnailUrl: video.thumbnailUrl,
                sourceId: video.id,
                timestamp: timestamp,
                pinned: video.isLive,
                author: {
                    name: 'Bethel Metropolitan',
                    avatarUrl: null
                },
                externalUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
                isLive: video.isLive,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
        logger.info(`Successfully synced ${items.length} YouTube videos.`);
    }
    catch (error) {
        logger.error('Error syncing YouTube content:', error);
    }
};
exports.syncYoutubeContent = syncYoutubeContent;
//# sourceMappingURL=youtube.js.map