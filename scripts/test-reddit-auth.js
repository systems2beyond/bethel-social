const axios = require('axios');

const CLIENT_ID = 'eTFmIAOVV0fgM5cPJojYNg';
const CLIENT_SECRET = 't49F49DmU7A0Z1jt9MYiuASPHgAh1g';
const REDDIT_URL = 'https://www.reddit.com/r/DebateReligion/comments/1h9640/did_matthew_write_about_feeding_the_5000/';

async function testRedditAuth() {
    console.log('Testing Reddit Auth with provided credentials...');

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        // 1. Get Token
        console.log('1. Requesting Access Token...');
        const tokenRes = await axios.post('https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'BethelSocial/1.0.0'
                }
            }
        );

        console.log('Token Response:', tokenRes.status);
        const token = tokenRes.data.access_token;
        console.log('Access Token obtained:', token ? 'YES' : 'NO');

        if (!token) {
            console.error('Failed to get token:', tokenRes.data);
            return;
        }

        // 2. Fetch Thread
        console.log('2. Fetching Thread via OAuth API...');

        // Try 1: No trailing slash before .json
        let cleanUrl = REDDIT_URL.split('?')[0];
        if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
        const url1 = cleanUrl.replace('www.reddit.com', 'oauth.reddit.com') + '.json';

        console.log('Trying URL 1:', url1);

        try {
            const contentRes = await axios.get(url1, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'BethelSocial/1.0.0'
                }
            });
            console.log('URL 1 Success:', contentRes.status);
            console.log('Title:', contentRes.data[0]?.data?.children?.[0]?.data?.title);
            return;
        } catch (e) {
            console.log('URL 1 Failed:', e.response?.status || e.message);
        }

        // Try 2: Simple ID based
        // Extract ID: comments/1h9640/
        const match = REDDIT_URL.match(/comments\/([a-z0-9]+)/);
        if (match) {
            const id = match[1];
            const url2 = `https://oauth.reddit.com/comments/${id}.json`;
            console.log('Trying URL 2:', url2);
            try {
                const contentRes = await axios.get(url2, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': 'BethelSocial/1.0.0'
                    }
                });
                console.log('URL 2 Success:', contentRes.status);
                console.log('Title:', contentRes.data[0]?.data?.children?.[0]?.data?.title);
                return;
            } catch (e) {
                console.log('URL 2 Failed:', e.response?.status || e.message);
            }
        }

    } catch (error) {
        console.error('TEST FAILED:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
    }
}

testRedditAuth();
