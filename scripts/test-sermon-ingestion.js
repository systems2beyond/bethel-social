const fetch = require('node-fetch');

const WEBHOOK_URL = 'https://us-central1-bethel-metro-social.cloudfunctions.net/ingestSermonWebhook';

const MOCK_SERMON = {
    title: "The Power of Community",
    date: "2025-10-12T10:00:00Z",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    summary: "Pastor Davis explores the importance of fellowship and supporting one another in the body of Christ.",
    outline: [
        "I. Introduction: We are not meant to be alone",
        "II. The Early Church example (Acts 2)",
        "III. Practical ways to serve today",
        "IV. Conclusion: A call to unity"
    ],
    transcript: `
        Good morning church! It is so good to see everyone here today.
        Today we are continuing our series on "Life Together".
        
        You know, in the beginning, God said "It is not good for man to be alone."
        This isn't just about marriage; it's about community. We were designed for connection.
        
        Turn with me to Acts chapter 2. We see the early believers sharing everything they had.
        They ate together, they prayed together. They were there for each other.
        
        In our modern world, we are more connected digitally than ever, yet many feel more isolated.
        True community requires vulnerability. It requires showing up.
        
        I challenge you this week: reach out to someone. Not just a text. Call them. Visit them.
        Let's be the church that the world needs to see.
        
        Let us pray.
    `
};

async function testIngestion() {
    console.log('Sending mock sermon to webhook...');
    console.log('Target:', WEBHOOK_URL);
    console.log('Payload:', JSON.stringify(MOCK_SERMON, null, 2));

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'x-api-key': 'YOUR_API_KEY' // Uncomment if auth is enabled
            },
            body: JSON.stringify(MOCK_SERMON)
        });

        const text = await response.text();
        console.log('Response Status:', response.status);
        console.log('Response Body:', text);

        if (response.ok) {
            console.log('✅ Ingestion Successful!');
        } else {
            console.error('❌ Ingestion Failed');
        }

    } catch (error) {
        console.error('Error testing webhook:', error);
    }
}

testIngestion();
