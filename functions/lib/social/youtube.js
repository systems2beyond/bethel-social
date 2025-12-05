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
    var _a, _b, _c, _d, _e, _f;
    logger.info('Starting YouTube sync...');
    const API_KEY = process.env.GOOGLE_AI_API_KEY; // Using the same key if it has YouTube Data API enabled
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
            part: ['snippet'],
            order: 'date',
            maxResults: 5,
            type: ['video'],
        });
        const items = response.data.items || [];
        const db = admin.firestore();
        const batch = db.batch();
        for (const item of items) {
            if (!item.snippet || !((_b = item.id) === null || _b === void 0 ? void 0 : _b.videoId))
                continue;
            const video = {
                id: item.id.videoId,
                title: item.snippet.title || 'Untitled Video',
                description: item.snippet.description || '',
                thumbnailUrl: ((_d = (_c = item.snippet.thumbnails) === null || _c === void 0 ? void 0 : _c.high) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = item.snippet.thumbnails) === null || _e === void 0 ? void 0 : _e.default) === null || _f === void 0 ? void 0 : _f.url) || '',
                publishedAt: item.snippet.publishedAt || new Date().toISOString(),
                videoId: item.id.videoId,
                isLive: item.snippet.liveBroadcastContent === 'live',
            };
            const postRef = db.collection('posts').doc(`yt_${video.id}`);
            batch.set(postRef, {
                type: 'youtube',
                content: `${video.title}\n\n${video.description}`, // Combine title and description
                mediaUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
                thumbnailUrl: video.thumbnailUrl,
                sourceId: video.id,
                timestamp: new Date(video.publishedAt).getTime(),
                pinned: video.isLive, // Auto-pin live streams
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