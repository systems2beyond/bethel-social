const { google } = require('googleapis');
require('dotenv').config({ path: 'functions/.env' }); // Load env vars from functions

const youtube = google.youtube('v3');

async function debugYoutubeSync() {
    const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY;
    // Hardcode the resolved ID for @BMBCFamily to ensure we are testing the right thing, 
    // or let it resolve if that's part of the test.
    // Let's stick to the logic: resolve first.
    let CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

    console.log('API_KEY present:', !!API_KEY);

    if (!API_KEY) {
        console.error('Missing API Key');
        return;
    }

    try {
        if (!CHANNEL_ID) {
            console.log('Resolving channel ID for @BMBCFamily...');
            const searchResponse = await youtube.search.list({
                key: API_KEY,
                q: '@BMBCFamily',
                type: ['channel'],
                part: ['id'],
                maxResults: 1,
            });
            if (searchResponse.data.items && searchResponse.data.items.length > 0) {
                CHANNEL_ID = searchResponse.data.items[0].id?.channelId;
                console.log(`Resolved Channel ID: ${CHANNEL_ID}`);
            } else {
                console.error('Could not resolve channel ID');
                return;
            }
        }

        console.log(`Searching videos for Channel ID: ${CHANNEL_ID}`);

        // 1. Standard Search (Latest)
        const response = await youtube.search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'],
            order: 'date',
            maxResults: 10,
            type: ['video'],
        });

        console.log(`Standard Search found ${response.data.items?.length || 0} items.`);
        response.data.items?.forEach(item => {
            console.log(`- [${item.id.videoId}] ${item.snippet.title} (${item.snippet.publishedAt})`);
        });

        // 2. Live Search
        const liveResponse = await youtube.search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'],
            type: ['video'],
            eventType: 'live',
            maxResults: 1,
        });

        console.log(`Live Search found ${liveResponse.data.items?.length || 0} items.`);
        liveResponse.data.items?.forEach(item => {
            console.log(`- [LIVE] [${item.id.videoId}] ${item.snippet.title}`);
        });

        // 3. Completed Live Search (Hypothesis: maybe it's 'completed'?)
        const completedResponse = await youtube.search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'],
            type: ['video'],
            eventType: 'completed',
            order: 'date',
            maxResults: 5,
        });

        console.log(`Completed Event Search found ${completedResponse.data.items?.length || 0} items.`);
        completedResponse.data.items?.forEach(item => {
            console.log(`- [COMPLETED] [${item.id.videoId}] ${item.snippet.title} (${item.snippet.publishedAt})`);
        });

        // Check for the specific missing video
        const missingVideoId = 'PdGY_wWTdGQ';
        const allItems = [
            ...(response.data.items || []),
            ...(liveResponse.data.items || []),
            ...(completedResponse.data.items || [])
        ];

        const found = allItems.find(i => i.id.videoId === missingVideoId);
        if (found) {
            console.log(`\nSUCCESS: Found missing video ${missingVideoId}!`);
        } else {
            console.log(`\nFAILURE: Did NOT find missing video ${missingVideoId} in any query.`);

            // Try fetching it directly to see if it exists and what channel it belongs to
            console.log('Attempting to fetch missing video details directly...');
            const directCheck = await youtube.videos.list({
                key: API_KEY,
                id: [missingVideoId],
                part: ['snippet', 'liveStreamingDetails']
            });

            if (directCheck.data.items?.length > 0) {
                const v = directCheck.data.items[0];
                console.log('Video Details:');
                console.log(`- Channel ID: ${v.snippet.channelId}`);
                console.log(`- Title: ${v.snippet.title}`);
                console.log(`- Published At: ${v.snippet.publishedAt}`);
                console.log(`- Live Broadcast Content: ${v.snippet.liveBroadcastContent}`);
                if (v.snippet.channelId !== CHANNEL_ID) {
                    console.error(`MISMATCH: Video is on channel ${v.snippet.channelId}, but we searched ${CHANNEL_ID}`);
                }
            } else {
                console.error('Video ID not found via API directly. Is it private or deleted?');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugYoutubeSync();
