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
}

export const syncYoutubeContent = async () => {
    logger.info('Starting YouTube sync...');

    const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY;
    let CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

    if (!API_KEY) {
        logger.error('Missing Google API Key (GOOGLE_API_KEY or GOOGLE_AI_API_KEY)');
        return;
    }

    logger.info(`Using API Key: ${API_KEY.substring(0, 10)}...`);

    try {
        // 0. Resolve Channel ID if missing
        // 0. Resolve Channel ID if missing
        if (!CHANNEL_ID) {
            logger.info('Resolving channel ID for @BMBCFamily...');
            try {
                const channelResponse = await getYoutube().channels.list({
                    key: API_KEY,
                    forHandle: 'BMBCFamily',
                    part: ['id']
                });

                if (channelResponse.data.items && channelResponse.data.items.length > 0) {
                    CHANNEL_ID = channelResponse.data.items[0].id || undefined;
                    logger.info(`Resolved Channel ID: ${CHANNEL_ID}`);
                } else {
                    // Fallback to search if handle lookup fails
                    logger.warn('Handle lookup failed, falling back to search...');
                    const searchResponse = await getYoutube().search.list({
                        key: API_KEY,
                        q: 'BMBCFamily',
                        type: ['channel'],
                        part: ['id'],
                        maxResults: 1,
                    });
                    if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                        CHANNEL_ID = searchResponse.data.items[0].id?.channelId || undefined;
                        logger.info(`Resolved Channel ID via search: ${CHANNEL_ID}`);
                    }
                }
            } catch (err) {
                logger.error('Error resolving channel ID:', err);
            }

            if (!CHANNEL_ID) {
                logger.error('Could not resolve channel ID for @BMBCFamily');
                return;
            }
        }

        // 1. Fetch latest videos
        const response = await getYoutube().search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'], // Search only supports snippet
            order: 'date',
            maxResults: 10, // Increased from 5
            type: ['video'],
        });

        // 2. Fetch currently LIVE video
        const liveResponse = await getYoutube().search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'],
            type: ['video'],
            eventType: 'live',
            maxResults: 1,
        });

        // 3. Fetch recently COMPLETED live videos (Standard search misses these sometimes)
        const completedResponse = await getYoutube().search.list({
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
        const uniqueVideoIds = Array.from(new Set(searchItems.map(item => item.id?.videoId).filter(id => !!id))) as string[];

        if (uniqueVideoIds.length === 0) {
            logger.info('No videos found.');
            return;
        }

        // 3. Fetch Video Details (needed for liveStreamingDetails)
        const videoDetailsResponse = await getYoutube().videos.list({
            key: API_KEY,
            id: uniqueVideoIds,
            part: ['snippet', 'liveStreamingDetails']
        });

        const items = videoDetailsResponse.data.items || [];
        logger.info(`Found ${items.length} videos. Processing...`);

        const db = admin.firestore();
        const batch = db.batch();

        for (const item of items) {
            if (!item.snippet || !item.id) continue;

            // Determine best timestamp: Actual Start -> Scheduled Start -> Published At
            let timestamp = new Date(item.snippet.publishedAt || new Date().toISOString()).getTime();
            if (item.liveStreamingDetails?.actualStartTime) {
                timestamp = new Date(item.liveStreamingDetails.actualStartTime).getTime();
            } else if (item.liveStreamingDetails?.scheduledStartTime) {
                timestamp = new Date(item.liveStreamingDetails.scheduledStartTime).getTime();
            }

            logger.info(`Processing video: ${item.snippet.title} (${item.id}) - Time: ${new Date(timestamp).toISOString()}`);

            const video: YoutubeVideo = {
                id: item.id,
                title: item.snippet.title || 'Untitled Video',
                description: item.snippet.description || '',
                thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
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

            // CLEANUP: Remove any Facebook posts that were ingested before this YouTube sync
            // This handles the race condition where FB sync runs first
            const fbDuplicates = await db.collection('posts')
                .where('youtubeVideoId', '==', video.id)
                .get();

            if (!fbDuplicates.empty) {
                fbDuplicates.forEach(doc => {
                    logger.info(`Removing duplicate Facebook post ${doc.id} for YouTube video ${video.id}`);
                    batch.delete(doc.ref);
                });
            } else {
                logger.info(`No Facebook duplicates found for YouTube video ${video.id}`);
            }
        }

        await batch.commit();
        logger.info(`Successfully synced ${items.length} YouTube videos.`);

    } catch (error) {
        logger.error('Error syncing YouTube content:', error);
    }
};
