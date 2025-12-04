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
exports.ingest = exports.chat = exports.syncYoutube = exports.fbWebhook = exports.syncFacebook = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
// Import social functions
const facebook_1 = require("./social/facebook");
const youtube_1 = require("./social/youtube");
// Import AI functions
const chatbot_1 = require("./ai/chatbot");
exports.syncFacebook = (0, scheduler_1.onSchedule)('every 60 minutes', async (event) => {
    await (0, facebook_1.syncFacebookPosts)();
});
exports.fbWebhook = (0, https_1.onRequest)(facebook_1.facebookWebhook);
exports.syncYoutube = (0, scheduler_1.onSchedule)('every 60 minutes', async (event) => {
    await (0, youtube_1.syncYoutubeContent)();
});
exports.chat = (0, https_1.onCall)(chatbot_1.chatWithBibleBot);
exports.ingest = (0, https_1.onCall)(chatbot_1.ingestSermon);
//# sourceMappingURL=index.js.map