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

    const API_KEY = process.env.GOOGLE_AI_API_KEY; // Using the same key if it has YouTube Data API enabled
    const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

    if (!API_KEY || !CHANNEL_ID) {
        logger.error('Missing YouTube credentials (GOOGLE_AI_API_KEY or YOUTUBE_CHANNEL_ID)');
        return;
    }

    try {
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
            if (!item.snippet || !item.id?.videoId) continue;

            const video: YoutubeVideo = {
                id: item.id.videoId,
                title: item.snippet.title || 'Untitled Video',
                description: item.snippet.description || '',
                thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
                publishedAt: item.snippet.publishedAt || new Date().toISOString(),
                videoId: item.id.videoId,
                isLive: item.snippet.liveBroadcastContent === 'live',
            };

            const postRef = db.collection('posts').doc(`yt_${video.id}`);

            batch.set(postRef, {
                type: 'youtube',
                content: video.title, // Use title as main content
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

    } catch (error) {
        logger.error('Error syncing YouTube content:', error);
    }
};
