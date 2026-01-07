
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

const youtube = google.youtube('v3');
const API_KEY = 'AIzaSyDY4Dy5hsGQEma3hnuMRf6QANl2YQls66Y'; // Temporarily hardcoded for test

// Bethel Channel ID: UCSCjB283HWz8AfxNYfD0yrA
// Uploads Playlist ID usually replaces 'UC' with 'UU'
const UPLOADS_PLAYLIST_ID = 'UUSCjB283HWz8AfxNYfD0yrA';

async function testEfficientSync() {
    if (!API_KEY) {
        console.error('No API KEY found');
        return;
    }

    console.log(`Testing efficient sync with Playlist ID: ${UPLOADS_PLAYLIST_ID}`);

    try {
        // 1. Get items from Uploads playlist (Cost: 1 unit)
        const playlistResponse = await youtube.playlistItems.list({
            key: API_KEY,
            playlistId: UPLOADS_PLAYLIST_ID,
            part: ['snippet'],
            maxResults: 5
        });

        const items = playlistResponse.data.items;
        if (!items || items.length === 0) {
            console.log('No items found in playlist.');
            return;
        }

        console.log(`Found ${items.length} items in Uploads playlist.`);

        const videoIds = items.map(item => item.snippet.resourceId.videoId);
        console.log('Video IDs:', videoIds);

        // 2. Get Video Details to check Live status (Cost: 1 unit)
        const videosResponse = await youtube.videos.list({
            key: API_KEY,
            id: videoIds,
            part: ['snippet', 'liveStreamingDetails']
        });

        const videos = videosResponse.data.items;
        videos.forEach(video => {
            console.log(`\nTitle: ${video.snippet.title}`);
            console.log(`Live Status: ${video.snippet.liveBroadcastContent}`);
            if (video.liveStreamingDetails) {
                console.log('Live Details:', JSON.stringify(video.liveStreamingDetails, null, 2));
            }
        });

        console.log('\nSuccess! This flow costs ~2 quota units vs ~300 units for search.');

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testEfficientSync();
