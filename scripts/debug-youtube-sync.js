const { google } = require('googleapis');
const path = require('path');
// Try loading .env from absolute path to be sure
require('dotenv').config({ path: path.resolve(__dirname, '../functions/.env') });

const youtube = google.youtube('v3');

async function debugYoutubeSync() {
    console.log('Current directory:', process.cwd());
    console.log('Loading .env from:', path.resolve(__dirname, '../functions/.env'));

    // Debug what loaded
    const keys = Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('YOUTUBE'));
    console.log('Loaded relevant env vars:', keys);

    // Dynamic Resolution (Matching youtube.ts logic)
    let API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
    let CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

    // Initialize Firebase Admin if needed (only if keys missing)
    if (!API_KEY || !CHANNEL_ID) {
        console.log('Env vars missing/incomplete (API_KEY present: ' + !!API_KEY + '), checking Firestore settings...');

        const admin = require('firebase-admin');
        let serviceAccount = null;
        try {
            serviceAccount = require('../functions/service-account.json');
        } catch (e) {
            console.log('No local service-account.json found (expected for simple dev).');
        }

        if (!admin.apps.length) {
            try {
                if (serviceAccount) {
                    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
                } else {
                    // This might warn but is better than crashing
                    admin.initializeApp({ credential: admin.credential.applicationDefault() });
                }
            } catch (e) {
                console.log('Default creds failed (skipping Firestore check):', e.message);
            }
        }

        // Only try to read Firestore if we successfully initialized admin
        if (admin.apps.length) {
            try {
                const settingsDoc = await admin.firestore().doc('settings/integrations').get();
                if (settingsDoc.exists) {
                    const data = settingsDoc.data();
                    if (!API_KEY && data?.youtube?.apiKey) {
                        API_KEY = data.youtube.apiKey;
                        console.log('Using API Key from Firestore.');
                    }
                    if (!CHANNEL_ID && data?.youtube?.channelId) {
                        CHANNEL_ID = data.youtube.channelId;
                        console.log(`Using Channel ID from Firestore: ${CHANNEL_ID}`);
                    }
                }
            } catch (e) {
                console.error('Error fetching settings from Firestore:', e.message);
            }
        }
    }

    console.log('Final API_KEY present:', !!API_KEY ? 'YES' : 'NO');

    if (!API_KEY) {
        console.error('CRITICAL: Missing API Key (Env and Firestore). Cannot proceed.');
        return;
    }

    if (!CHANNEL_ID) {
        // Fallback or resolve
        console.log('Resolving channel ID for @BMBCFamily...');
        try {
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
            }
        } catch (e) { console.error("Search failed during resolution", e); }
    }

    if (!CHANNEL_ID) {
        console.error('CRITICAL: Missing Channel ID. Cannot proceed.');
        return;
    }

    try {
        console.log(`Searching videos for Channel ID: ${CHANNEL_ID}`);

        // 1. Standard Search (Latest)
        console.log('--- TEST 1: Standard Search (Latest) ---');
        const response = await youtube.search.list({
            key: API_KEY,
            channelId: CHANNEL_ID,
            part: ['snippet'],
            order: 'date',
            maxResults: 10,
            type: ['video'],
            q: 'Sunday Service' // Adding query sometimes helps find better matches, but removing it to be broad
        });

        console.log(`Standard Search found ${response.data.items?.length || 0} items.`);
        response.data.items?.forEach(item => {
            console.log(`- [${item.id.videoId}] ${item.snippet.title} (${item.snippet.publishedAt})`);
        });

        // 2. Playlist Logic (Mirroring youtube.ts)
        console.log('\n--- TEST 2: Uploads Playlist Strategy (Used by Production) ---');
        // Replace UC with UU
        const UPLOADS_PLAYLIST_ID = CHANNEL_ID.replace('UC', 'UU');
        console.log(`Using Playlist ID: ${UPLOADS_PLAYLIST_ID}`);

        try {
            const playlistResponse = await youtube.playlistItems.list({
                key: API_KEY,
                playlistId: UPLOADS_PLAYLIST_ID,
                part: ['snippet'],
                maxResults: 10,
            });

            console.log(`Playlist Strategy found ${playlistResponse.data.items?.length || 0} items.`);
            playlistResponse.data.items?.forEach(item => {
                const videoId = item.snippet?.resourceId?.videoId;
                console.log(`- [${videoId}] ${item.snippet.title} (${item.snippet.publishedAt})`);
            });
        } catch (e) {
            console.error('Playlist fetch failed:', e.message);
        }

    } catch (error) {
        console.error('Error during search:', error.message);
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugYoutubeSync();
