"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithBibleBot = exports.ingestSermon = void 0;
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
// import { z } from 'zod';
const genkit_1 = require("genkit");
const googleai_1 = require("@genkit-ai/googleai");
const firestore_1 = require("firebase-admin/firestore");
// Initialize Genkit
const ai = (0, genkit_1.genkit)({
    plugins: [(0, googleai_1.googleAI)()],
    model: googleai_1.gemini15Flash,
});
const db = admin.firestore();
// Simple text splitter
function splitText(text, chunkSize = 1000, overlap = 100) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}
// Helper to extract embedding from Genkit result
function extractEmbedding(result) {
    if (Array.isArray(result)) {
        if (result.length > 0 && typeof result[0] === 'number') {
            return result;
        }
        if (result.length > 0 && result[0].embedding) {
            return result[0].embedding;
        }
    }
    if (result && result.embedding) {
        return result.embedding;
    }
    throw new Error(`Could not extract embedding from result: ${JSON.stringify(result)}`);
}
const ingestSermon = async (request) => {
    // request.data should contain { title: string, text: string, date: string }
    const { title, text, date } = request.data;
    if (!text || !title) {
        throw new Error('Missing text or title');
    }
    logger.info(`Ingesting sermon: ${title}`);
    // 1. Chunk text
    const chunks = splitText(text);
    // 2. Generate embeddings and save to Firestore
    const batch = db.batch();
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Generate embedding using Genkit
        const embeddingResult = await ai.embed({
            embedder: googleai_1.textEmbedding004,
            content: chunk,
        });
        // Extract the embedding array
        const embeddingVector = extractEmbedding(embeddingResult);
        const docRef = db.collection('sermon_chunks').doc();
        batch.set(docRef, {
            sermonTitle: title,
            sermonDate: date,
            text: chunk,
            embedding: firestore_1.FieldValue.vector(embeddingVector), // Store as vector
            chunkIndex: i,
        });
    }
    await batch.commit();
    logger.info(`Ingested ${chunks.length} chunks for sermon: ${title}`);
    return { success: true, chunks: chunks.length };
};
exports.ingestSermon = ingestSermon;
const chatWithBibleBot = async (request) => {
    const { message } = request.data;
    logger.info('Chat request received', { message });
    // 0. Check for Handoff Intent (Simple keyword check for now, could be LLM classifier)
    const handoffKeywords = ['talk to human', 'speak to pastor', 'contact staff', 'real person'];
    if (handoffKeywords.some(k => message.toLowerCase().includes(k))) {
        // Trigger Google Chat Webhook (Mock)
        logger.info('Triggering Google Chat Handoff');
        // await axios.post(process.env.GOOGLE_CHAT_WEBHOOK, { text: `User requested help: ${message}` });
        return {
            response: "I'm connecting you with a staff member. They will reach out to you shortly via the contact info on file.",
            handoff: true
        };
    }
    // 1. Embed user query
    const queryEmbeddingResult = await ai.embed({
        embedder: googleai_1.textEmbedding004,
        content: message,
    });
    const queryVector = extractEmbedding(queryEmbeddingResult);
    // 2. Vector Search in Firestore
    // Note: This requires a vector index on 'sermon_chunks' collection
    const snapshot = await db.collection('sermon_chunks')
        .findNearest('embedding', firestore_1.FieldValue.vector(queryVector), {
        limit: 5,
        distanceMeasure: 'COSINE'
    })
        .get();
    const context = snapshot.docs.map(doc => doc.data().text).join('\n\n');
    // 3. Generate Response
    const systemPrompt = `
    You are the "Bethel Assistant", a helpful, warm, and biblically-grounded AI companion for the Bethel Metropolitan Baptist Church community.
    
    **Your Goals:**
    1. Answer questions about sermons, bible studies, and church events accurately using the provided context.
    2. Provide spiritual support and relevant scripture references when appropriate.
    3. Be welcoming to new visitors and encourage them to join our services (Sundays at 10:00 AM).
    
    **Rules:**
    - **Tone:** Warm, empathetic, respectful, and pastoral.
    - **Scripture:** Always quote the KJV or NIV version when referencing the Bible.
    - **Context:** Use the provided 'Sermon Context' to answer specific questions about what was preached.
    - **Unknowns:** If the answer is not in the context and is not general biblical knowledge, politely say you don't know and offer to connect them with a human.
    - **Handoff:** If the user seems distressed, asks for prayer, or wants to speak to a pastor, suggest they contact the church office or use the "Talk to a Human" feature.
    - **Visuals:** If an image is provided, use it to answer questions about event details, flyers, or visual content.
    
    **Sermon Context:**
    ${context || "No specific sermon context available for this query."}
    `;
    // Extract Media URL from context block if present
    // Format: [Context: ... Media URL: https://... ]
    const urlMatch = message.match(/Media URL: (https?:\/\/[^\s\]]+)/);
    const imageUrl = urlMatch ? urlMatch[1] : null;
    // Clean message by removing the context block for the prompt (optional, but keeps it clean)
    // const cleanMessage = message.replace(/\[Context:.*?\]/s, '').trim(); 
    // Actually, keeping the text context is useful for the LLM to know *why* the image is there.
    let prompt = [
        { text: systemPrompt },
        { text: `\n**User Question:**\n${message}` }
    ];
    if (imageUrl) {
        // Add image part
        prompt.push({ media: { url: imageUrl } });
    }
    let response;
    try {
        response = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: prompt,
            config: {
                temperature: 0.7,
            }
        });
    }
    catch (e) {
        logger.error('Gemini 2.0 Flash failed:', e);
        throw e;
    }
    return { response: response.text };
};
exports.chatWithBibleBot = chatWithBibleBot;
//# sourceMappingURL=chatbot.js.map