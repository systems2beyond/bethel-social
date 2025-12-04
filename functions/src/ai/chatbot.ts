import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { genkit } from 'genkit';
import { googleAI, gemini15Flash, textEmbedding004 } from '@genkit-ai/googleai';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Genkit
const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

const db = admin.firestore();

// Simple text splitter
function splitText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

export const ingestSermon = async (request: any) => {
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
            embedder: textEmbedding004,
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
            embedding: FieldValue.vector(embeddingVector), // Store as vector
            chunkIndex: i,
        });
    }

    await batch.commit();
    logger.info(`Ingested ${chunks.length} chunks for sermon: ${title}`);
    return { success: true, chunks: chunks.length };
}

export const chatWithBibleBot = async (request: any) => {
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
        embedder: textEmbedding004,
        content: message,
    });
    // @ts-ignore
    const queryVector = Array.isArray(queryEmbeddingResult) ? queryEmbeddingResult : queryEmbeddingResult.embedding;

    // 2. Vector Search in Firestore
    // Note: This requires a vector index on 'sermon_chunks' collection
    const snapshot = await db.collection('sermon_chunks')
        .findNearest('embedding', FieldValue.vector(queryVector), {
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
