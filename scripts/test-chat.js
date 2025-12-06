const fetch = require('node-fetch');

async function testChat() {
    const url = 'https://us-central1-bethel-metro-social.cloudfunctions.net/chat';
    console.log(`Testing Chatbot at: ${url}`);

    try {
        const response = await fetch('https://us-central1-bethel-metro-social.cloudfunctions.net/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': 'Bearer ...' // If auth is enabled
            },
            body: JSON.stringify({
                data: {
                    message: "Tell me about the senior shoe event"
                }
            })
        });

        const text = await response.text();

        console.log('Status:', response.status);
        try {
            const json = JSON.parse(text);
            console.log('Response:', JSON.stringify(json, null, 2));

            if (json.error) {
                console.error('Function returned error:', json.error);
                process.exit(1);
            }
        } catch (e) {
            console.log('Raw body:', text);
        }

        if (!response.ok) {
            process.exit(1);
        }

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testChat();
