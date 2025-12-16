import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, onRequest } from 'firebase-functions/v2/https';
// import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
const googleApiKey = defineSecret('GOOGLE_API_KEY');
if (!admin.apps.length) {
    admin.initializeApp();
}

// Import social functions
import { facebookWebhook, syncFacebookPosts, syncFacebookLiveStatus } from './social/facebook';
import { syncYoutubeContent } from './social/youtube';

export const manualFacebookSync = onRequest(async (req, res) => {
    const backfill = req.query.backfill === 'true';
    await syncFacebookPosts(backfill);
    res.send(`Facebook sync executed (Backfill: ${backfill}).`);
});

export const debugPosts = onRequest(async (req, res) => {
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

        const oldest = oldestSnapshot.empty ? null : { id: oldestSnapshot.docs[0].id, ...oldestSnapshot.docs[0].data() } as any;
        const newest = newestSnapshot.empty ? null : { id: newestSnapshot.docs[0].id, ...newestSnapshot.docs[0].data() } as any;

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
            } else {
                const first = snapshot.docs[0];
                const last = snapshot.docs[snapshot.docs.length - 1];
                simulationLog.push(`Page ${simPage}: Fetched ${snapshot.size}. Range: ${new Date(first.data().timestamp).toISOString()} -> ${new Date(last.data().timestamp).toISOString()}`);
                simLastDoc = last;
            }
            simPage++;
        }

        res.json({
            count,
            oldest: oldest ? { date: new Date(oldest.timestamp).toISOString(), ...oldest } : null,
            newest: newest ? { date: new Date(newest.timestamp).toISOString(), ...newest } : null,
            debugInfo,
            gapPosts,
            simulationLog
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Import AI functions
import { chatWithBibleBot, ingestSermon } from './ai/chatbot';
export { ingestContent, scheduledWebsiteCrawl, ingestSocialPost } from './ai/knowledge_base';
export * from './ai/comments';
export * from './ai/meetings';
export { onMeetingCreated } from './notifications';
export * from './meeting'; // Export meeting functions


export const syncFacebook = onSchedule('every 10 minutes', async (event) => {
    await syncFacebookPosts();
    await syncFacebookLiveStatus();
});

export const fbWebhook = onRequest(facebookWebhook);

export const syncYoutube = onSchedule({ schedule: 'every 10 minutes', secrets: [googleApiKey] }, async (event) => {
    await syncYoutubeContent();
});

export const manualYoutubeSync = onRequest({ secrets: [googleApiKey] }, async (req, res) => {
    await syncYoutubeContent();
    res.send('YouTube sync executed.');
});



export const chat = onCall({ timeoutSeconds: 300, memory: '1GiB' }, chatWithBibleBot);
export const ingest = onCall({ timeoutSeconds: 540, memory: '2GiB' }, ingestSermon);

export { extractEventFromPost, backfillEvents } from './ai/events';
export { onCommentWritten } from './triggers/comments';
export { updateUserRole } from './admin/user_management';
export { ingestSermonWebhook } from './ai/sermons';
export { search } from './ai/search';
export { saveImageProxy } from './media/images';
export { fetchUrlContent } from './media/reader';
