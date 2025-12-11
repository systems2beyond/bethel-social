const axios = require('axios');

const FUNCTION_URL = 'https://fetchurlcontent-4xnaperncq-uc.a.run.app';
const REDDIT_URL = 'https://www.reddit.com/r/DebateReligion/comments/1h9640/did_matthew_write_about_feeding_the_5000/';

async function testRedditFetch() {
    console.log(`Testing fetchUrlContent at: ${FUNCTION_URL}`);
    console.log(`Target URL: ${REDDIT_URL}`);

    try {
        const response = await axios.post(FUNCTION_URL, {
            url: REDDIT_URL
        });

        console.log('Response Status:', response.status);
        console.log('Success:', response.data.success);
        console.log('Title:', response.data.title);
        console.log('Site Name:', response.data.siteName);
        console.log('Byline:', response.data.byline);
        console.log('Excerpt:', response.data.excerpt);
        console.log('Content Length:', response.data.content?.length);

        if (!response.data.success) {
            console.error('Error from function:', response.data.error);
        }

    } catch (error) {
        console.error('Request failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

testRedditFetch();
