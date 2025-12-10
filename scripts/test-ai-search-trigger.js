const fetch = require('node-fetch');

async function testAiSearchTrigger() {
    const url = 'https://us-central1-bethel-metro-social.cloudfunctions.net/chat';
    console.log(`Testing AI Search Trigger at: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: {
                    message: "can you find any articles why people feel more alone now then before the digital connectionera",
                    history: [],
                    userName: "Ryan",
                    sermonId: "test-sermon-id",
                    intent: "notes_assistant"
                }
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);

        try {
            const json = JSON.parse(text);
            const aiResponse = json.result?.response || json.data?.response;

            console.log('AI Response:', aiResponse);

            if (aiResponse && aiResponse.includes('<SEARCH>')) {
                console.log('SUCCESS: AI output contained <SEARCH> tag.');
                const match = aiResponse.match(/<SEARCH>(.*?)<\/SEARCH>/);
                if (match) {
                    console.log('Extracted Query:', match[1]);
                }
            } else {
                console.error('FAILURE: AI output did NOT contain <SEARCH> tag.');
                process.exit(1);
            }

        } catch (e) {
            console.log('Raw body:', text);
        }

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testAiSearchTrigger();
