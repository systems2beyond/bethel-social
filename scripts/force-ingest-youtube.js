const admin = require('firebase-admin');
const { google } = require('googleapis');
// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'bethel-metro-social'
    });
}

const db = admin.firestore();
const youtube = google.youtube('v3');

const API_KEY = 'AIzaSyDiC1ul3FuGm9a0mzBU3MHKwZaI8edUbpI'; // Hardcoded valid key
const VIDEO_ID = 'PdGY_wWTdGQ';

async function forceIngest() {
    console.log(`Fetching video ${VIDEO_ID}...`);

    try {
        const videoResponse = await youtube.videos.list({
            key: API_KEY,
            id: VIDEO_ID,
            part: ['snippet', 'liveStreamingDetails']
        });

        if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
            console.error('Video not found!');
            return;
        }

        const video = videoResponse.data.items[0];
        const snippet = video.snippet;
        const liveDetails = video.liveStreamingDetails;

        console.log('Video found:', snippet.title);

        // Determine timestamp
        let timestamp = snippet.publishedAt;
        if (liveDetails) {
            if (liveDetails.actualStartTime) {
                timestamp = liveDetails.actualStartTime;
            } else if (liveDetails.scheduledStartTime) {
                timestamp = liveDetails.scheduledStartTime;
            }
        }

        const postData = {
            type: 'youtube',
            sourceId: video.id,
            title: snippet.title,
            content: snippet.description || '',
            mediaUrl: `https://www.youtube.com/embed/${video.id}?autoplay=1`,
            thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
            externalUrl: `https://youtube.com/live/${video.id}`,
            timestamp: new Date(timestamp).getTime(), // Convert to millis
            author: {
                name: snippet.channelTitle,
                avatarUrl: null // Can't easily get this without another call
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            forceIngest: true
        };

        console.log('Writing to Firestore:', postData);

        await db.collection('posts').doc(`yt_${video.id}`).set(postData, { merge: true });

        console.log(`Successfully ingested yt_${video.id}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

forceIngest();
