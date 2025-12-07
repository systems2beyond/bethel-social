import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

const youtube = google.youtube('v3');

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
                CHANNEL_ID = searchResponse.data.items[0].id?.channelId || undefined;
                logger.info(`Resolved Channel ID: ${CHANNEL_ID}`);
            } else {
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
        const uniqueVideoIds = Array.from(new Set(searchItems.map(item => item.id?.videoId).filter(id => !!id))) as string[];

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
        }

        await batch.commit();
        logger.info(`Successfully synced ${items.length} YouTube videos.`);

    } catch (error) {
        logger.error('Error syncing YouTube content:', error);
    }
};
