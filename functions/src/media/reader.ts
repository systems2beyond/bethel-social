import { onRequest } from 'firebase-functions/v2/https';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as functions from 'firebase-functions';


// Helper to get Reddit Access Token
async function getRedditAccessToken() {
    const clientId = functions.config().reddit?.client_id;
    const clientSecret = functions.config().reddit?.client_secret;

    if (!clientId || !clientSecret) {
        throw new Error('Reddit API credentials not configured. Run: firebase functions:config:set reddit.client_id="YOUR_ID" reddit.client_secret="YOUR_SECRET"');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post('https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'web:bethel-social:v1.0.0 (by /u/Educational_Gap_3430)'
                }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Reddit access token:', error);
        throw error;
    }
}

export const fetchUrlContent = onRequest({
    cors: true,
    memory: '1GiB', // Increased for Puppeteer
    timeoutSeconds: 120
}, async (req, res) => {
    // Manually handle CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type'); // Changed from original

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const { url } = req.body;

    if (!url) {
        res.status(400).json({ error: 'URL is required' }); // Changed error message
        return;
    }

    // Check if it's a PDF based on extension or we can check Content-Type later
    const isPdf = url.toLowerCase().endsWith('.pdf');

    // Check if it's Reddit
    const isReddit = url.includes('reddit.com');

    try {
        let content = '';
        let title = '';
        let siteName = '';
        let textContent = '';
        let excerpt = '';
        let byline: string | null = null;

        if (isReddit) {
            // REDDIT API PATH
            try {
                const token = await getRedditAccessToken();

                // Extract ID from URL (e.g., comments/1h9640/)
                const match = url.match(/comments\/([a-z0-9]+)/i);
                let jsonUrl = '';

                if (match && match[1]) {
                    // Use the ID-based endpoint which is more reliable
                    jsonUrl = `https://oauth.reddit.com/comments/${match[1]}.json`;
                } else {
                    // Fallback to the original URL structure if ID not found
                    jsonUrl = url.split('?')[0];
                    if (!jsonUrl.endsWith('.json')) jsonUrl += '.json';
                    jsonUrl = jsonUrl.replace('www.reddit.com', 'oauth.reddit.com');
                }

                const response = await axios.get(jsonUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'web:bethel-social:v1.0.0 (by /u/Educational_Gap_3430)'
                    }
                });

                const data = response.data;
                // Reddit returns an array: [Listing (Post), Listing (Comments)]
                const postListing = data[0]?.data?.children?.[0]?.data;
                const commentsListing = data[1]?.data?.children;

                if (!postListing) throw new Error('No post data found');

                title = postListing.title;
                siteName = `r/${postListing.subreddit}`;
                byline = `u/${postListing.author}`;

                // Construct HTML content
                let html = `<div class="reddit-post">`;
                html += `<h1>${title}</h1>`;
                html += `<p><strong>Author:</strong> u/${postListing.author}</p>`;
                if (postListing.selftext_html) {
                    // selftext_html is escaped, need to unescape
                    const unescaped = postListing.selftext_html
                        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                    html += `<div class="post-body">${unescaped}</div>`;
                } else if (postListing.url) {
                    html += `<p><a href="${postListing.url}">Link to content</a></p>`;
                }

                html += `<h2>Comments</h2>`;

                // Process top comments
                if (commentsListing) {
                    commentsListing.slice(0, 10).forEach((c: any) => {
                        const comment = c.data;
                        if (comment.body_html) {
                            const unescaped = comment.body_html
                                .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                            html += `<div class="comment" style="margin-bottom: 20px; border-left: 2px solid #ccc; padding-left: 10px;">
                                <p><strong>u/${comment.author}</strong></p>
                                ${unescaped}
                             </div>`;
                        }
                    });
                }
                html += `</div>`;

                content = html;
                textContent = postListing.selftext || title;
                excerpt = textContent.substring(0, 200) + '...';

                res.status(200).json({
                    success: true,
                    title,
                    content,
                    textContent,
                    excerpt,
                    byline,
                    siteName
                });
                return;

            } catch (redditError: any) {
                console.error('Reddit API failed:', redditError);
                // If it's a config error, tell user.
                if (redditError.message.includes('configured')) {
                    res.status(500).json({ success: false, error: 'Reddit API not configured. Please set reddit.client_id and reddit.client_secret.' });
                    return;
                }
                // If Reddit API fails, DO NOT fall back to standard fetch as it will likely fail with 403
                // Return the specific error to help debugging
                console.error('Reddit API failed:', redditError.response?.data || redditError.message);

                const status = redditError.response?.status || 500;
                const message = redditError.response?.data?.message || redditError.message || 'Failed to fetch from Reddit API';

                res.status(status).json({
                    success: false,
                    error: `Reddit API Error: ${message}`,
                    details: redditError.response?.data
                });
                return;
            }
        }

        // STANDARD FETCH (Axios -> JSDOM -> Readability)
        const response = await axios.get(url, {
            responseType: isPdf ? 'arraybuffer' : 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': isPdf ? 'application/pdf' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.google.com/',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"'
            },
            timeout: 15000 // 15s timeout for fetch
        });

        const contentType = response.headers['content-type'];

        // Handle PDF
        if (isPdf || (contentType && contentType.includes('application/pdf'))) {
            // Dynamic import pdf-parse
            const pdf = require('pdf-parse');

            const dataBuffer = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
            const pdfData = await pdf(dataBuffer);

            title = url.split('/').pop() || 'PDF Document';
            content = `<div class="pdf-content"><h1>${title}</h1><p>${pdfData.text.replace(/\n/g, '<br>')}</p></div>`;
            textContent = pdfData.text;
            excerpt = textContent.substring(0, 200) + '...';
            siteName = 'PDF Viewer';
            byline = 'PDF Document';
        }
        // Handle HTML
        else {
            const dom = new JSDOM(response.data, { url });
            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            if (!article) {
                throw new Error('Readability failed to parse article');
            }

            title = article.title || 'No Title';
            content = article.content || '';
            textContent = article.textContent || '';
            excerpt = article.excerpt || '';
            byline = article.byline || null;
            siteName = article.siteName || new URL(url).hostname;
        }

        res.status(200).json({
            success: true,
            title,
            content,
            textContent,
            excerpt,
            byline,
            siteName
        });

    } catch (error: any) {
        // If PDF failed via Axios, return error (Puppeteer doesn't handle PDF parsing easily)
        if (error.response) {
            res.status(error.response.status).json({ success: false, error: `PDF Fetch Error: ${error.response.status}` });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});
