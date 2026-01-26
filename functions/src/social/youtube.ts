import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

let youtubeClient: any;

function getYoutube() {
    if (!youtubeClient) {
        youtubeClient = google.youtube('v3');
    }
    return youtubeClient;
}

interface YoutubeVideo {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    publishedAt: string;
    videoId: string;
    isLive: boolean;
    channelId: string;
}

// Hardcoded Channel ID for Bethel Metropolitan Baptist Church (St. Petersburg)
// Handle: @BMBCFamily
// Hardcoded Channel ID for Bethel Metropolitan Baptist Church (St. Petersburg)
// Handle: @BMBCFamily
const KNOWN_CHANNEL_ID = 'UCSCjB283HWz8AfxNYfD0yrA';
const UPLOADS_PLAYLIST_ID = 'UUSCjB283HWz8AfxNYfD0yrA'; // Channel ID with UU instead of UC

export const syncYoutubeContent = async () => {
    logger.info('Starting YouTube sync (Efficient Mode)...');

    const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
    // Prefer environment variable, fallback to known efficient ID
    const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || KNOWN_CHANNEL_ID;

    if (!API_KEY) {
        // Try fetching from Firestore (Dynamic Config)
        const settingsDoc = await admin.firestore().doc('settings/integrations').get();
        if (settingsDoc.exists) {
            const data = settingsDoc.data();
            if (data?.youtube?.apiKey) {
                logger.info('Using YouTube API Key from Firestore settings.');
                // We need to re-assign constants. Let's change loops slightly or use mutable vars.
            }
        }
    }

    // Dynamic Resolution
    let activeApiKey = API_KEY;
    let activeChannelId = CHANNEL_ID;

    if (!activeApiKey || !activeChannelId) {
        try {
            const settingsDoc = await admin.firestore().doc('settings/integrations').get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                if (!activeApiKey && data?.youtube?.apiKey) {
                    activeApiKey = data.youtube.apiKey;
                }
                if (process.env.YOUTUBE_CHANNEL_ID === undefined && data?.youtube?.channelId) {
                    // Only override default KNOWN_CHANNEL_ID if the user actively set one in settings, 
                    // OR if we strictly want to valid empty defaults. 
                    // Logic: If Env Var is set, it wins. If not, check DB. If not, check Hardcoded Default? 
                    // Actually, if DB has a channel ID, we should probably prefer it over the hardcoded default, but NOT the Env Var.
                    activeChannelId = data.youtube.channelId;
                }
            }
        } catch (e) { logger.error('Error reading settings', e); }
    }


    if (!activeApiKey) {
        logger.error('Missing Google API Key (Env or Firestore)');
        return;
    }

    try {
        // 1. Fetch latest videos from Uploads playlist (Cost: 1 unit)
        // This includes live streams (usually) and recent uploads.
        const playlistResponse = await getYoutube().playlistItems.list({
            key: activeApiKey,
            playlistId: UPLOADS_PLAYLIST_ID,
            part: ['snippet'],
            maxResults: 10, // Fetch last 10 to be safe
        });

        const playlistItems = playlistResponse.data.items || [];

        // Extract video IDs
        const videoIds = playlistItems
            .map((item: any) => item.snippet?.resourceId?.videoId)
            .filter((id: string) => !!id);

        if (videoIds.length === 0) {
            logger.info('No videos found in Uploads playlist.');
            return;
        }

        // 2. Fetch Video Details to check Live status (Cost: 1 unit)
        const videoDetailsResponse = await getYoutube().videos.list({
            key: activeApiKey,
            id: videoIds,
            part: ['snippet', 'liveStreamingDetails']
        });

        const items = videoDetailsResponse.data.items || [];
        logger.info(`Fetched details for ${items.length} videos.`);

        const db = admin.firestore();
        const batch = db.batch();

        for (const item of items) {
            if (!item.snippet || !item.id) continue;

            // Double check channel ID
            if (item.snippet.channelId !== activeChannelId) {
                logger.warn(`Skipping video ${item.id} from wrong channel: ${item.snippet.channelId} (Expected: ${activeChannelId})`);
                continue;
            }

            // Determine best timestamp
            let timestamp = new Date(item.snippet.publishedAt || new Date().toISOString()).getTime();
            if (item.liveStreamingDetails?.actualStartTime) {
                timestamp = new Date(item.liveStreamingDetails.actualStartTime).getTime();
            } else if (item.liveStreamingDetails?.scheduledStartTime) {
                timestamp = new Date(item.liveStreamingDetails.scheduledStartTime).getTime();
            }

            // Determine if truly live
            const isLive = item.snippet.liveBroadcastContent === 'live';

            const video: YoutubeVideo = {
                id: item.id,
                title: item.snippet.title || 'Untitled Video',
                description: item.snippet.description || '',
                thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
                publishedAt: new Date(timestamp).toISOString(),
                videoId: item.id,
                isLive: isLive,
                channelId: item.snippet.channelId,
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
                churchId: 'default_church', // Hardcoded for single-tenant migration phase
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            // CLEANUP: Remove duplicate Facebook posts
            // (Only do this cheaply if needed, or query specifically. skipping to save reads/writes for now unless critical?)
            // Keeping it for now as it's cleaner.
            const fbDuplicates = await db.collection('posts')
                .where('youtubeVideoId', '==', video.id)
                .get();

            if (!fbDuplicates.empty) {
                fbDuplicates.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }
        }

        // 3. Cleanup: Unmark any YouTube posts that are 'live' in DB but NOT in our current live list
        // Since we fetched the latest uploads, if a stream ended, it's either in this list as 'none'/'completed'
        // OR it's old enough to fall off the list.

        // Any video IN the list with isLive=false will be updated by the loop above.
        // But what if a video falls off the list (e.g. very old)? It shouldn't be live anyway.
        // The main risk is a video that WAS live, now ended, and we update it.

        // We still need to find any 'isLive: true' in DB and check if it's still valid.
        // But we only have the status of the 10 videos we fetched.
        // Use the same logic: Get all DB live posts. checking against the "live" ones we just found.

        const currentLiveVideoIds = items
            .filter((i: any) => i.snippet?.liveBroadcastContent === 'live')
            .map((i: any) => i.id as string);

        const stuckLivePosts = await db.collection('posts')
            .where('type', '==', 'youtube')
            .where('isLive', '==', true)
            .get();

        stuckLivePosts.forEach(doc => {
            const data = doc.data();
            // If the video is NOT in our currently live list
            if (!currentLiveVideoIds.includes(data.sourceId)) {
                // Check if we just updated it in the loop above (e.g. it was in the list but isLive=false)
                // If we updated it in the batch already, the batch update 'wins' or merges.
                // But specifically for 'isLive: false', simple unmark is fine.

                // If the video was IN the fetch list, the loop already set isLive=false (if it's not live).
                // If the video was NOT in the fetch list (e.g. older), it's definitely not live anymore (assuming we fetch enough history).
                // So safe to unmark.

                logger.info(`Unmarking live post: ${doc.id}`);
                batch.update(doc.ref, {
                    isLive: false,
                    pinned: false
                });
            }
        });

        await batch.commit();
        logger.info(`Synced ${items.length} videos. Live: ${currentLiveVideoIds.length}. Cleaned up ${stuckLivePosts.size} potentially stale.`);

    } catch (error) {
        logger.error('Error syncing YouTube content:', error);
    }
};
