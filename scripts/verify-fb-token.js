const axios = require('axios');

async function testToken() {
    const PAGE_ID = '120720411275822';
    const ACCESS_TOKEN = 'EAAYtDq4SmQcBQfsPaJLmh4SZAUuZAxBBpQ8lZCysZCnZAHrfutEJmlIWumTw0H9SZAWAWvbG8us8Bj7etMCJxb7pegcrbIvkWtBtItski1X0uQlEQ5xEskqTPBm1NtWuZBLQqNi5MItatERaUKR4mc9dH2Y6KWu91JWtp9Cuubev9t65bPCwsfNVwtSU6MMLDDSR3FoJZBxWr9ZAccJDh0ZBF9gzEZD';

    console.log(`Token Length: ${ACCESS_TOKEN.length}`);
    console.log(`First 10 chars: ${ACCESS_TOKEN.substring(0, 10)}`);
    console.log(`Last 10 chars: ${ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 10)}`);
    console.log(`Char codes of first 5: ${ACCESS_TOKEN.split('').slice(0, 5).map(c => c.charCodeAt(0)).join(', ')}`);

    console.log(`Testing token for Page ID: ${PAGE_ID}`);

    try {
        const url = `https://graph.facebook.com/v18.0/${PAGE_ID}/feed`;
        const params = {
            access_token: ACCESS_TOKEN,
            fields: 'id,message,created_time,attachments{media,subattachments}',
            limit: 5
        };

        const response = await axios.get(url, { params });
        console.log('SUCCESS! Found posts:', response.data.data.length);
        console.log('Sample Post:', JSON.stringify(response.data.data[0], null, 2));

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
