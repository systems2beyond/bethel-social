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
const vertexai_1 = require("@genkit-ai/vertexai");
const firestore_1 = require("firebase-admin/firestore");
const router_1 = require("./router");
// Initialize Genkit with Vertex AI (uses Project Quota/Blaze)
let ai;
function getAi() {
    if (!ai) {
        ai = (0, genkit_1.genkit)({
            plugins: [(0, vertexai_1.vertexAI)({ location: 'us-central1', projectId: 'bethel-metro-social' })],
            model: 'vertexai/gemini-2.0-flash-001',
        });
    }
    return ai;
}
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
        const embeddingResult = await getAi().embed({
            embedder: 'vertexai/text-embedding-004',
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
    var _a;
    const { message, history, userName, userPhone } = request.data;
    logger.info('Chat request received', { message, historyLength: history === null || history === void 0 ? void 0 : history.length, userName });
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
    const queryEmbeddingResult = await getAi().embed({
        embedder: 'vertexai/text-embedding-004',
        content: message,
    });
    const queryVector = extractEmbedding(queryEmbeddingResult);
    // 2. Vector Search in Firestore
    // Note: This requires a vector index on 'sermon_chunks' collection
    let vectorQuery = db.collection('sermon_chunks');
    // If sermonId is provided, filter by it (Pre-filtering is ideal but requires composite index with vector)
    // For now, we'll fetch more results and filter in memory or rely on the vector search to find relevant chunks naturally
    // IF we had a composite index (sermonId + embedding), we could do:
    // .where('sermonId', '==', request.data.sermonId)
    // However, without a custom index, let's try to just search. 
    // If the user asks about "this sermon", the semantic similarity to the sermon chunks should be high.
    // BUT, to be safe and precise, let's try to filter if possible.
    // Vertex AI Vector Search supports filtering, but Firestore Vector Search is limited.
    // Strategy: If sermonId is present, we might want to fetch chunks for that sermon specifically if the query is very specific?
    // Actually, Firestore Vector Search DOES support pre-filtering with `where` clauses if you have the index.
    // Let's assume we might not have the index yet, so we'll do a broad search but maybe boost?
    // Wait, the user wants "context of the sermons upon ingestion".
    // Let's try to use the `where` clause if `sermonId` is passed.
    // We will need to create a composite index: sermonId (ASC) + embedding (VECTOR).
    if (request.data.sermonId) {
        vectorQuery = vectorQuery.where('sermonId', '==', request.data.sermonId);
    }
    const snapshot = await vectorQuery
        .findNearest('embedding', firestore_1.FieldValue.vector(queryVector), {
        limit: 5,
        distanceMeasure: 'COSINE'
    })
        .get();
    const context = snapshot.docs.map((doc) => doc.data().text).join('\n\n');
    // 3. Generate Response
    // 3. Generate Response
    let systemPrompt = `
    You are the "Bethel Assistant", a helpful, warm, and biblically-grounded AI companion for the Bethel Metropolitan Baptist Church community.
    You are speaking with **${userName || 'a friend'}**${userPhone ? ` (Phone: ${userPhone})` : ''}.
    
    **Your Goals:**
    1. Answer questions about sermons, bible studies, and church events accurately using the provided context.
    2. Provide spiritual support and relevant scripture references when appropriate.
    3. Be welcoming to new visitors and encourage them to join our services (Sundays at 10:00 AM).
    4. Help the user perform actions like adding events to their calendar or sending emails to the church.
    
    **Rules:**
    - **Tone:** Warm, empathetic, respectful, and pastoral. Treat the user like a close friend and member of the congregation.
    - **Personalization:** Use **${userName || 'Friend'}**'s name naturally in the conversation to build rapport, especially when offering support or specific information. Ask how they are doing if appropriate.
    - **Scripture:** Always quote the KJV or NIV version when referencing the Bible.
    - **Context:** Use the provided 'Sermon Context' to answer specific questions about what was preached.
    - **Unknowns:** If the answer is not in the context and is not general biblical knowledge, politely say you don't know and offer to connect them with a human.
    - **Handoff:** If the user seems distressed, asks for prayer, or wants to speak to a pastor, suggest they contact the church office or use the "Talk to a Human" feature.
    - **Visuals:** The user is looking at the image provided in the context. ALWAYS use this image to answer questions about dates, times, locations, visual details, or text contained within the image. Assume the user's question refers to this image unless specified otherwise.
    - **Image Context:** If the context contains "[Image Analysis]" or "[Extracted Text]", treat this as high-priority information. This text comes directly from images in the post and often contains vital details not present in the main post text.
    
    **Tools & Actions:**
    If the user asks to add an event to their calendar or send an email, output a specific ACTION tag at the end of your response.
    
    1. **Calendar Action:**
       Output: \`[ACTION:CALENDAR | Title | StartTime (ISO) | EndTime (ISO) | Location | Description]\`
       Example: \`[ACTION:CALENDAR | Senior Shoe Event | 2025-05-04T10:00:00 | 2025-05-04T12:00:00 | Bethel Church | Bring new shoes for seniors]\`
       *Note: Infer the year as 2025 if not specified. Use the context to find the date/time.*

    2. **Email Action:**
       Output: \`[ACTION:EMAIL | Recipient Email | Subject | Body]\`
       Example: \`[ACTION:EMAIL | office@bethelmetro.org | Baptism Inquiry | Hi, I would like to know more about baptism...]\`
       *Note: Default recipient is office@bethelmetro.org unless specified.*

    3. **Search Action (Visual Aids):**
       If the user asks for a visual aid (map, image, diagram) or if you believe an image would significantly enhance the explanation (e.g., "Show me a map of Paul's journeys"), output a search query tag at the end.
       Output: \`<SEARCH>concise search query</SEARCH>\`
       Example: \`<SEARCH>map of Paul's first missionary journey</SEARCH>\`
       *Note: Only use this if a visual is genuinely helpful.*

    4. **Summary Suggestion:**
       If the conversation reaches a "noteworthy" moment (deep theology, practical application) OR if the user explicitly asks to "save this", "add to notes", or "remember this", output the tag \`<SUGGEST_SUMMARY>\` at the very end of your response.

    **Sermon Context:**
    ${context || "No specific sermon context available for this query."}
    `;
    // Override prompt for 'post' intent
    if (request.data.intent === 'post') {
        systemPrompt = `
        You are an expert Social Media Manager for Bethel Metropolitan Baptist Church.
        You are assisting **${userName || 'a staff member'}** in drafting an engaging post for the church's social feed.

        **Your Goal:**
        Create a draft social media post based on the user's input. The post should be engaging, warm, and relevant to the church community.

        **Rules:**
        - **Tone:** Encouraging, inviting, and community-focused.
        - **Format:** Use emojis appropriately. Use hashtags (e.g., #BethelMetro, #Faith, #Community).
        - **Clarity:** Ensure dates, times, and locations are clear if mentioned.
        - **Draft Only:** Do not say "Here is your post". Just provide the post content directly, perhaps wrapped in quotes or a clear block.
        - **Options:** You can offer 2-3 variations if the user's request is broad (e.g., "Short & Punchy", "Detailed & Warm").
        
        **Context:**
        Use the provided sermon/bible context if relevant to the post topic:
        ${context || "No specific context."}
        `;
    }
    // Override prompt for 'summarize_notes' intent OR general notes assistant
    if (request.data.intent === 'summarize_notes' || request.data.intent === 'notes_assistant') {
        systemPrompt = `
        You are a professional, objective note-taker and research assistant.
        Your goal is to help the user create high-quality, structured notes from the sermon AND answer their theological questions.
        
        RULES:
        1.  **Strictly Professional Tone:** Do NOT use conversational filler like "Sure!", "Here is...", "I can help with that", or "Great question". Start your response DIRECTLY with the content.
        2.  **No Prefixes:** Do NOT prefix your response with "Model:", "Assistant:", or "AI:". Just output the answer.
        3.  **Format:** Use Markdown for structure (headings, bullet points, bold text).
           - Use > Blockquotes for key scripture or quotes.
        4.  **Context & Knowledge:** 
           - **Primary Source:** Use the provided 'Input Context' (sermon transcript) for questions about what was preached.
           - **Secondary Source:** If the user asks a general biblical, historical, or theological question NOT in the transcript, use your general knowledge to answer it.
           - **External Source:** If you need to verify facts or find up-to-date info/visuals, use the <SEARCH> tool.
           - **Do NOT refuse** to answer just because the answer isn't in the transcript, unless it is completely unrelated to faith/history/notes.
        5.  **Search:** You have access to a search tool. If you need to verify facts, find latest information, or find visual aids (images, maps), you MUST output a search query wrapped in tags like this: <SEARCH>query</SEARCH>. 
           - **NEVER** apologize for not having access to the internet or say "I cannot provide a map". You CAN provide it by using the search tag.
           - Do not describe the image or fact, just output the tag.
        
        Example User: "Can you find a map of Paul's journey?"
        Example Output: <SEARCH>map of Paul's missionary journeys</SEARCH>
        
        Example User: "What is the historical context of Ephesus?"
        Example Output: <SEARCH>historical context of Ephesus first century</SEARCH>
        
        Example User: "Summarize the main point."
        Example Output: **The Main Point**
        The central theme of this sermon is...
        
        **Input Context:**
        ${context || "No specific sermon context."}
        `;
    }
    // Extract Media URL from context block if present
    // Format: [Context: ... Media URL: https://... ]
    const urlMatch = message.match(/Media URL: (https?:\/\/[^\s\]]+)/);
    const imageUrl = urlMatch ? urlMatch[1] : null;
    logger.info('Regex Match Result', {
        messageLength: message.length,
        hasMatch: !!urlMatch,
        extractedUrl: imageUrl
    });
    // Clean message by removing the context block for the prompt (optional, but keeps it clean)
    // const cleanMessage = message.replace(/\[Context:.*?\]/s, '').trim(); 
    // Actually, keeping the text context is useful for the LLM to know *why* the image is there.
    let prompt = [
        { text: systemPrompt },
    ];
    // Add history if present
    if (history && Array.isArray(history)) {
        history.forEach((msg) => {
            // Use a simpler format to avoid confusing the AI into repeating "Model:"
            prompt.push({ text: `\n${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content} ` });
        });
    }
    // Add current question
    prompt.push({ text: `\n ** User Question:**\n${message} ` });
    if (imageUrl) {
        // Add image part with contentType
        const lowerUrl = imageUrl.toLowerCase();
        // 1. Explicitly block known video/non-image domains/extensions that cause Gemini to crash
        if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('vimeo.com') || lowerUrl.includes('.mp4') || lowerUrl.includes('.mov')) {
            logger.info('Skipping media attachment (video domain)', { imageUrl });
        }
        else {
            // 2. Try to detect extension
            const cleanUrl = imageUrl.split('?')[0];
            const extension = (_a = cleanUrl.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
            let contentType = 'image/jpeg'; // Default fallback
            if (extension === 'png')
                contentType = 'image/png';
            if (extension === 'webp')
                contentType = 'image/webp';
            if (extension === 'heic')
                contentType = 'image/heic';
            if (extension === 'heif')
                contentType = 'image/heif';
            // If extension is 'jpg' or 'jpeg' or unknown, we use 'image/jpeg'
            logger.info('Attaching media to prompt', { imageUrl, contentType, inferredFrom: extension || 'fallback' });
            prompt.push({ media: { url: imageUrl, contentType } });
        }
    }
    logger.info('Sending prompt to Gemini', {
        promptLength: JSON.stringify(prompt).length,
        partsCount: prompt.length
    });
    // 4. Smart Routing
    const selectedModel = await (0, router_1.routeQuery)(message, !!imageUrl);
    logger.info(`Using model: ${selectedModel} `);
    let response;
    try {
        response = await getAi().generate({
            model: selectedModel,
            prompt: prompt,
            config: {
                temperature: 0.7,
            }
        });
    }
    catch (e) {
        logger.error('Vertex AI Gemini 1.5 Flash failed:', {
            message: e.message,
            status: e.status,
            details: e.errorDetails
        });
        throw e;
    }
    return { response: response.text };
};
exports.chatWithBibleBot = chatWithBibleBot;
//# sourceMappingURL=chatbot.js.map