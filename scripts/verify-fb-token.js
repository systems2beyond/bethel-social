const axios = require('axios');

async function testToken() {
    const PAGE_ID = '120720411275822';
    const ACCESS_TOKEN = 'EAAYtDq4SmQcBQXKQHA953wIOgWTxZCwpId0N0sJNoZCcobGmpZBhtXkc2zKGV6B2BaZB6vxf644zOLLtoThjsKLHHXnJ93H784dYxLCmZCxQdyDG1sxwONgZCvJbTkG6Q5s3FtJAZBbxO664fse1qKAxI6tLGfRW6uOVrNzuZA9Jr0fHPAinWsEB35ZBWNznY4fdz5Ezls35kya8ZCYlhFXOHhiNctmuAhU1Pu7R2KHPLm5ZBbluTFlWors3QZDZD';

    console.log(`Testing token for Page ID: ${PAGE_ID}`);

    try {
        const url = `https://graph.facebook.com/v18.0/${PAGE_ID}/feed`;
        const params = {
            access_token: ACCESS_TOKEN,
            fields: 'id,message,created_time',
            limit: 5
        };

        const response = await axios.get(url, { params });
        console.log('SUCCESS! Found posts:', response.data.data.length);
        console.log('Sample Post:', response.data.data[0]);

    } catch (error) {
        console.error('ERROR!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testToken();
