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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTiptapToken = exports.fetchUrlContent = exports.saveImageProxy = exports.search = exports.ingestSermonWebhook = exports.updateUserRole = exports.onCommentWritten = exports.backfillEvents = exports.extractEventFromPost = exports.ingest = exports.chat = exports.manualYoutubeSync = exports.syncYoutube = exports.fbWebhook = exports.syncFacebook = exports.onMeetingCreated = exports.ingestSocialPost = exports.scheduledWebsiteCrawl = exports.ingestContent = exports.debugPosts = exports.manualFacebookSync = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
// import * as logger from 'firebase-functions/logger';
const params_1 = require("firebase-functions/params");
const googleApiKey = (0, params_1.defineSecret)('GOOGLE_API_KEY');
const fbAccessToken = (0, params_1.defineSecret)('FB_ACCESS_TOKEN');
const fbPageId = (0, params_1.defineSecret)('FB_PAGE_ID');
const fbVerifyToken = (0, params_1.defineSecret)('FB_VERIFY_TOKEN');
if (!admin.apps.length) {
    admin.initializeApp();
}
// Import social functions
const facebook_1 = require("./social/facebook");
const youtube_1 = require("./social/youtube");
exports.manualFacebookSync = (0, https_1.onRequest)({ secrets: [fbAccessToken, fbPageId] }, async (req, res) => {
    const backfill = req.query.backfill === 'true';
    await (0, facebook_1.syncFacebookPosts)(backfill);
    res.send(`Facebook sync executed (Backfill: ${backfill}).`);
});
exports.debugPosts = (0, https_1.onRequest)(async (req, res) => {
    try {
        const countSnapshot = await admin.firestore().collection('posts').count().get();
        const count = countSnapshot.data().count;
        const oldestSnapshot = await admin.firestore().collection('posts')
            .orderBy('timestamp', 'asc')
            .limit(1)
            .get();
        const newestSnapshot = await admin.firestore().collection('posts')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        const oldest = oldestSnapshot.empty ? null : Object.assign({ id: oldestSnapshot.docs[0].id }, oldestSnapshot.docs[0].data());
        const newest = newestSnapshot.empty ? null : Object.assign({ id: newestSnapshot.docs[0].id }, newestSnapshot.docs[0].data());
        const debugDoc = await admin.firestore().collection('system').doc('facebook_sync_debug').get();
        const debugInfo = debugDoc.exists ? debugDoc.data() : null;
        // Check for posts around Oct 5th 2025 (approx 1759641600000)
        const gapSnapshot = await admin.firestore().collection('posts')
            .orderBy('timestamp', 'desc')
            .where('timestamp', '<', 1760000000000) // Oct 9
            .limit(10)
            .get();
        const gapPosts = gapSnapshot.docs.map(d => ({
            id: d.id,
            date: new Date(d.data().timestamp).toISOString(),
            timestamp: d.data().timestamp
        }));
        // Simulation Logic
        let simLastDoc = null;
        const simulationLog = [];
        let simPage = 1;
        let keepGoing = true;
        while (keepGoing && simPage <= 20) {
            let query = admin.firestore().collection('posts')
                .orderBy('timestamp', 'desc')
                .orderBy('__name__', 'desc') // Secondary sort for stability
                .limit(10);
            if (simLastDoc) {
                // Use explicit field cursor
                query = query.startAfter(simLastDoc.data().timestamp, simLastDoc.id);
            }
            const snapshot = await query.get();
            if (snapshot.empty) {
                simulationLog.push(`Page ${simPage}: EMPTY (Stopped)`);
                keepGoing = false;
            }
            else {
                const first = snapshot.docs[0];
                const last = snapshot.docs[snapshot.docs.length - 1];
                simulationLog.push(`Page ${simPage}: Fetched ${snapshot.size}. Range: ${new Date(first.data().timestamp).toISOString()} -> ${new Date(last.data().timestamp).toISOString()}`);
                simLastDoc = last;
            }
            simPage++;
        }
        res.json({
            count,
            oldest: oldest ? Object.assign({ date: new Date(oldest.timestamp).toISOString() }, oldest) : null,
            newest: newest ? Object.assign({ date: new Date(newest.timestamp).toISOString() }, newest) : null,
            debugInfo,
            gapPosts,
            simulationLog
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Import AI functions
const chatbot_1 = require("./ai/chatbot");
var knowledge_base_1 = require("./ai/knowledge_base");
Object.defineProperty(exports, "ingestContent", { enumerable: true, get: function () { return knowledge_base_1.ingestContent; } });
Object.defineProperty(exports, "scheduledWebsiteCrawl", { enumerable: true, get: function () { return knowledge_base_1.scheduledWebsiteCrawl; } });
Object.defineProperty(exports, "ingestSocialPost", { enumerable: true, get: function () { return knowledge_base_1.ingestSocialPost; } });
__exportStar(require("./ai/comments"), exports);
__exportStar(require("./ai/meetings"), exports);
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "onMeetingCreated", { enumerable: true, get: function () { return notifications_1.onMeetingCreated; } });
__exportStar(require("./meeting"), exports); // Export meeting functions
exports.syncFacebook = (0, scheduler_1.onSchedule)({ schedule: 'every 10 minutes', secrets: [fbAccessToken, fbPageId] }, async (event) => {
    await (0, facebook_1.syncFacebookPosts)();
    await (0, facebook_1.syncFacebookLiveStatus)();
});
exports.fbWebhook = (0, https_1.onRequest)({ secrets: [fbVerifyToken, fbAccessToken, fbPageId] }, facebook_1.facebookWebhook);
exports.syncYoutube = (0, scheduler_1.onSchedule)({ schedule: 'every 3 minutes', secrets: [googleApiKey] }, async (event) => {
    await (0, youtube_1.syncYoutubeContent)();
});
exports.manualYoutubeSync = (0, https_1.onRequest)({ secrets: [googleApiKey] }, async (req, res) => {
    await (0, youtube_1.syncYoutubeContent)();
    res.send('YouTube sync executed.');
});
exports.chat = (0, https_1.onCall)({ timeoutSeconds: 300, memory: '1GiB' }, chatbot_1.chatWithBibleBot);
exports.ingest = (0, https_1.onCall)({ timeoutSeconds: 540, memory: '2GiB' }, chatbot_1.ingestSermon);
var events_1 = require("./ai/events");
Object.defineProperty(exports, "extractEventFromPost", { enumerable: true, get: function () { return events_1.extractEventFromPost; } });
Object.defineProperty(exports, "backfillEvents", { enumerable: true, get: function () { return events_1.backfillEvents; } });
var comments_1 = require("./triggers/comments");
Object.defineProperty(exports, "onCommentWritten", { enumerable: true, get: function () { return comments_1.onCommentWritten; } });
var user_management_1 = require("./admin/user_management");
Object.defineProperty(exports, "updateUserRole", { enumerable: true, get: function () { return user_management_1.updateUserRole; } });
var sermons_1 = require("./ai/sermons");
Object.defineProperty(exports, "ingestSermonWebhook", { enumerable: true, get: function () { return sermons_1.ingestSermonWebhook; } });
var search_1 = require("./ai/search");
Object.defineProperty(exports, "search", { enumerable: true, get: function () { return search_1.search; } });
var images_1 = require("./media/images");
Object.defineProperty(exports, "saveImageProxy", { enumerable: true, get: function () { return images_1.saveImageProxy; } });
var reader_1 = require("./media/reader");
Object.defineProperty(exports, "fetchUrlContent", { enumerable: true, get: function () { return reader_1.fetchUrlContent; } });
var token_1 = require("./collaboration/token");
Object.defineProperty(exports, "generateTiptapToken", { enumerable: true, get: function () { return token_1.generateTiptapToken; } });
//# sourceMappingURL=index.js.map