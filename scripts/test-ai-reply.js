const https = require('https');

const PROJECT_ID = 'bethel-metro-social';
const POST_ID = 'test_post_1764911237839'; // Use the test post
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
    console.error('Please provide an access token as the first argument.');
    process.exit(1);
}

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(`${BASE_URL}${path}`, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Request failed: ${res.statusCode} ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTest() {
    try {
        console.log('1. Creating test comment...');
        const commentData = {
            fields: {
                content: { stringValue: "@Matthew Hello from test script " + Date.now() },
                author: {
                    mapValue: {
                        fields: {
                            id: { stringValue: "test-user" },
                            name: { stringValue: "Test User" },
                            avatarUrl: { stringValue: "" }
                        }
                    }
                },
                timestamp: { integerValue: Date.now() },
                postId: { stringValue: POST_ID }
            }
        };

        const comment = await request('POST', `/posts/${POST_ID}/comments`, commentData);
        const commentId = comment.name.split('/').pop();
        console.log(`Created comment: ${commentId}`);

        console.log('2. Waiting for AI reply...');
        // Poll for 30 seconds
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 3000));
            console.log(`Polling attempt ${i + 1}...`);

            const result = await request('GET', `/posts/${POST_ID}/comments?orderBy=timestamp desc&pageSize=5`);
            const comments = result.documents || [];

            const aiReply = comments.find(c => {
                const fields = c.fields;
                return fields.author.mapValue.fields.id.stringValue === 'ai-matthew' &&
                    fields.parentId && fields.parentId.stringValue === commentId;
            });

            if (aiReply) {
                console.log('SUCCESS: Found threaded AI reply!');
                console.log('Reply ID:', aiReply.name.split('/').pop());
                console.log('Parent ID:', aiReply.fields.parentId.stringValue);
                console.log('Content:', aiReply.fields.content.stringValue);
                return;
            }

            // Check if there is an unthreaded reply (bug)
            const unthreadedReply = comments.find(c => {
                const fields = c.fields;
                return fields.author.mapValue.fields.id.stringValue === 'ai-matthew' &&
                    (!fields.parentId || fields.parentId.stringValue !== commentId) &&
                    fields.timestamp.integerValue > commentData.fields.timestamp.integerValue;
            });

            if (unthreadedReply) {
                console.log('FAILURE: Found unthreaded AI reply!');
                console.log('Reply ID:', unthreadedReply.name.split('/').pop());
                console.log('Parent ID:', unthreadedReply.fields.parentId ? unthreadedReply.fields.parentId.stringValue : 'UNDEFINED');
                return;
            }
        }

        console.log('TIMEOUT: No AI reply found after 30 seconds.');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

runTest();
