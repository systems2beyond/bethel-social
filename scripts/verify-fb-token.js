const axios = require('axios');

async function testToken() {
    const PAGE_ID = '120720411275822';
    const ACCESS_TOKEN = 'EAAYtDq4SmQcBQZAz3ZA4WhleosVPRJyiwvk639mMsJNjtMzBJXfAnLnxcyUpxIKXIyN63FjSKI6aKlXeeINBOkB5YuO5uCgGY5SNFJDgOEDWOYZC0uTyMSylqm2Kyr3ZBZBWn34mO4TvNJ54N5hZCc6pLC41j1QsOZBMXrUhvfIhObvPZCbB9LrxRmggzZCsaUOSGe4Va6NtlJD39XyATDUZAdenBqjbuPgRpVAccjivTBx9XZB3WfWtKSmXAZDZD';

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
