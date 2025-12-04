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
        // @ts-ignore - Genkit types can be tricky, ensuring we get the array
        const embeddingVector = Array.isArray(embeddingResult) ? embeddingResult : embeddingResult.embedding;
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
    const { message, history } = request.data;
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
    // @ts-ignore
    const queryVector = Array.isArray(queryEmbeddingResult) ? queryEmbeddingResult : queryEmbeddingResult.embedding;
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
    const prompt = `
    You are a helpful AI assistant for Bethel Metropolitan Baptist Church.
    Use the following context from our sermons to answer the user's question.
    If the answer is not in the context, use your general knowledge of the Bible but mention that it's not from a specific sermon.
    
    Context:
    ${context}

    User Question: ${message}
  `;
    const response = await ai.generate({
        prompt: prompt,
        // history: history, // Genkit history handling varies, keeping simple for now
    });
    return { response: response.text };
};
exports.chatWithBibleBot = chatWithBibleBot;
//# sourceMappingURL=chatbot.js.map