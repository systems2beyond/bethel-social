const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const projectId = '503876827928'; // Use Project Number
const location = 'us-central1';

async function listModels() {
    console.log(`Listing models for project ${projectId} in ${location}...`);
    // Note: The Vertex AI SDK doesn't have a simple "listModels" for Foundation Models easily accessible via this client usually,
    // but we can try to instantiate a model and see if it works, or use the REST API via fetch.

    // Let's try to generate content with a few known model IDs to see which one works.
    const models = [
        'gemini-2.0-flash-001',
        'gemini-1.5-flash-001',
        'gemini-1.0-pro',
    ];

    const locations = ['us-central1', 'us-west1', 'us-east1', 'us-east4', 'northamerica-northeast1'];

    for (const loc of locations) {
        console.log(`\nTesting location: ${loc}`);
        const vertexAI = new VertexAI({ project: projectId, location: loc });

        for (const modelId of models) {
            // console.log(`Testing model: ${modelId}`);
            try {
                const model = vertexAI.getGenerativeModel({ model: modelId });
                const result = await model.generateContent('Hello');
                console.log(`✅ SUCCESS: ${modelId} in ${loc}`);
                return; // Stop if we find one
            } catch (e) {
                // console.log(`❌ FAILED: ${modelId} - ${e.message}`);
                if (!e.message.includes('not found')) console.log(`❌ FAILED: ${modelId} in ${loc} - ${e.message}`);
            }
        }
    }
}

listModels();
