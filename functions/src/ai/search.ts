import * as logger from 'firebase-functions/logger';
import { onCall } from 'firebase-functions/v2/https';
// import * as admin from 'firebase-admin';
import axios from 'axios';

export const search = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
    const { query, type = 'web' } = request.data;
    logger.info(`Search request received for: ${query} [Type: ${type}]`);

    if (!query) {
        return { results: [] };
    }

    // 1. Resolve API Keys (Hardcoded for Fix)
    // TODO: Revert to Env/Firestore after stabilizing
    const apiKey = 'AIzaSyDY4Dy5hsGQEma3hnuMRf6QANl2YQls66Y';
    const cx = '963445ad09d264687';

    // try {
    //     const settingsDoc = await admin.firestore().doc('settings/integrations').get();
    //     if (settingsDoc.exists) {
    //         const data = settingsDoc.data();
    //         // detailed logging for debugging
    //         logger.info('Firestore Settings Found:', {
    //             hasGoogle: !!data?.google,
    //             hasSearch: !!data?.search
    //         });
    //
    //         const fsApiKey = data?.google?.searchApiKey || data?.search?.apiKey || data?.google?.apiKey;
    //         const fsCx = data?.google?.searchCx || data?.google?.cx;
    //
    //         if (fsApiKey) {
    //             apiKey = fsApiKey;
    //             logger.info('Using Search API Key from Firestore (overriding/augmenting env).');
    //         }
    //         if (fsCx) {
    //             cx = fsCx;
    //             logger.info('Using Search CX from Firestore (overriding/augmenting env).');
    //         }
    //     }
    // } catch (error) {
    //     logger.warn('Failed to fetch settings/integrations for search config', error);
    // }

    logger.info('Env Vars Check:', {
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 5) : 'N/A',
        hasCx: !!cx,
        cxPrefix: cx ? cx.substring(0, 5) : 'N/A'
    });

    // 1. Try Real Search if keys exist
    if (apiKey && cx) {
        try {
            logger.info(`Executing Google Custom Search (${type})...`);

            // Construct Query
            let finalQuery = query;
            // Force theological context
            if (type === 'video') {
                finalQuery += ' site:youtube.com (bible OR christian OR jesus OR theology)';
            } else if (type === 'web') {
                finalQuery += ' (bible OR christian OR jesus OR theology)';
            }

            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: apiKey,
                    cx: cx,
                    q: finalQuery,
                    num: type === 'video' ? 4 : 6,
                    safe: 'active'
                }
            });

            const items = response.data.items || [];
            const results = items.map((item: any) => {
                let videoId = null;
                if (type === 'video' && item.link) {
                    const match = item.link.match(/[?&]v=([^&]+)/);
                    if (match) videoId = match[1];
                }

                return {
                    title: item.title,
                    link: item.link,
                    snippet: item.snippet,
                    displayLink: item.displayLink,
                    thumbnail: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || null,
                    videoId // Only populated for videos
                };
            });

            // For video search, filter out items without videoIds
            if (type === 'video') {
                return { results: results.filter((r: any) => r.videoId) };
            }

            return { results };

        } catch (error: any) {
            logger.error('Google Search API failed:', error.message);
            // Fall through to mock data on error
        }
    } else {
        logger.warn('Missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX. Using mock data.');
    }

    // 2. Fallback: Mock Results
    if (type === 'video') {
        const mockVideos = [
            {
                title: `Understanding ${query} - Biblical Theology`,
                link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                videoId: "dQw4w9WgXcQ",
                snippet: "A deep dive into the theological meaning..."
            },
            {
                title: `History of ${query}`,
                link: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
                thumbnail: "https://img.youtube.com/vi/oHg5SJYRHA0/mqdefault.jpg",
                videoId: "oHg5SJYRHA0",
                snippet: "Exploring the historical context..."
            }
        ];
        return { results: mockVideos };
    }

    const mockImages = [
        {
            title: `Map related to ${query}`,
            link: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Paul_First_Missionary_Journey_Map.jpg/800px-Paul_First_Missionary_Journey_Map.jpg",
            thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Paul_First_Missionary_Journey_Map.jpg/200px-Paul_First_Missionary_Journey_Map.jpg"
        },
        {
            title: `Illustration of ${query}`,
            link: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Paul_preaching_at_Athens_by_Raphael.jpg/800px-Paul_preaching_at_Athens_by_Raphael.jpg",
            thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Paul_preaching_at_Athens_by_Raphael.jpg/200px-Paul_preaching_at_Athens_by_Raphael.jpg"
        },
        {
            title: `Diagram for ${query}`,
            link: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Solomon%27s_Temple.png/800px-Solomon%27s_Temple.png",
            thumbnail: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Solomon%27s_Temple.png/200px-Solomon%27s_Temple.png"
        }
    ];

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return { results: mockImages };
});
