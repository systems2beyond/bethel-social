import * as logger from 'firebase-functions/logger';
import { onCall } from 'firebase-functions/v2/https';
import axios from 'axios';

export const search = onCall(async (request) => {
    const { query } = request.data;
    logger.info(`Search request received for: ${query}`);

    if (!query) {
        return { results: [] };
    }

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    // 1. Try Real Search if keys exist
    if (apiKey && cx) {
        try {
            logger.info('Executing Google Custom Search...');
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: apiKey,
                    cx: cx,
                    q: query,
                    searchType: 'image',
                    num: 6, // Fetch 6 images
                    safe: 'active'
                }
            });

            const items = response.data.items || [];
            const results = items.map((item: any) => ({
                title: item.title,
                link: item.link,
                thumbnail: item.image?.thumbnailLink || item.link
            }));

            return { results };

        } catch (error: any) {
            logger.error('Google Search API failed:', error.message);
            // Fall through to mock data on error
        }
    } else {
        logger.warn('Missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX. Using mock data.');
    }

    // 2. Fallback: Mock Results
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
