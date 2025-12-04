import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

admin.initializeApp();

// Import social functions
import { syncFacebookPosts, facebookWebhook } from './social/facebook';
import { syncYoutubeContent } from './social/youtube';

// Import AI functions
import { chatWithBibleBot, ingestSermon } from './ai/chatbot';

export const syncFacebook = onSchedule('every 60 minutes', async (event) => {
    await syncFacebookPosts();
});

export const fbWebhook = onRequest(facebookWebhook);

export const syncYoutube = onSchedule('every 60 minutes', async (event) => {
    await syncYoutubeContent();
});

export const chat = onCall(chatWithBibleBot);
export const ingest = onCall(ingestSermon);
