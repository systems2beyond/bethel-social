import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { genkit } from 'genkit';
import { googleAI, textEmbedding004 } from '@genkit-ai/googleai';
import { FieldValue } from 'firebase-admin/firestore';
import * as cheerio from 'cheerio';

const GOOGLE_API_KEY = defineSecret('GOOGLE_API_KEY');

// Initialize Genkit
const ai = genkit({
    plugins: [googleAI()],
});

const db = admin.firestore();

// Helper to extract embedding from Genkit result
function extractEmbedding(result: any): number[] {
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

// Simple text splitter
function splitText(text: string, chunkSize = 1000, overlap = 100): string[] {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

interface IngestRequest {
    sourceType: 'webpage' | 'social_post';
    url?: string;
    text?: string; // For manual ingestion or if URL fetch fails
    title?: string;
    metadata?: any;
}

export const ingestContent = onCall(
    {
        secrets: [GOOGLE_API_KEY],
        region: 'us-central1',
        timeoutSeconds: 300,
    },
    async (request) => {
        // Only allow admin users (or authenticated users for now, refine later)
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User not authenticated.');
        }

        const data = request.data as IngestRequest;
        const { sourceType, url, title, metadata } = data;
        let { text } = data;

        logger.info(`Ingesting content: ${title} (${sourceType})`);

        // If URL provided but no text, try to fetch and parse
        if (url && !text && sourceType === 'webpage') {
            try {
                logger.info(`Fetching URL: ${url}`);
                const response = await fetch(url);
                const html = await response.text();
                const $ = cheerio.load(html);

                // Remove scripts, styles, etc.
                $('script').remove();
                $('style').remove();
                $('nav').remove();
                $('footer').remove();

                // Extract main content (naive approach, can be improved)
                text = $('body').text().replace(/\s+/g, ' ').trim();
                logger.info(`Extracted ${text.length} chars from URL`);
            } catch (e) {
                logger.error(`Failed to fetch URL ${url}:`, e);
                throw new HttpsError('internal', `Failed to fetch URL: ${e}`);
            }
        }

        if (!text) {
            throw new HttpsError('invalid-argument', 'No text provided or extracted.');
        }

        // 1. Chunk text
        const chunks = splitText(text);

        // 2. Generate embeddings and save to Firestore
        const batch = db.batch();
        let chunkCount = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                const embeddingResult = await ai.embed({
                    embedder: textEmbedding004,
                    content: chunk,
                });
                const embeddingVector = extractEmbedding(embeddingResult);

                const docRef = db.collection('sermon_chunks').doc();
                batch.set(docRef, {
                    docType: sourceType,
                    title: title || 'Untitled',
                    url: url || '',
                    text: chunk,
                    embedding: FieldValue.vector(embeddingVector),
                    createdAt: FieldValue.serverTimestamp(),
                    metadata: metadata || {},
                    chunkIndex: i,
                });
                chunkCount++;
            } catch (e) {
                logger.error(`Failed to embed chunk ${i}:`, e);
            }
        }

        await batch.commit();
        logger.info(`Ingested ${chunkCount} chunks.`);
        return { success: true, chunks: chunkCount };
    }
);

// Scheduled function to crawl website daily
export const scheduledWebsiteCrawl = onSchedule(
    {
        schedule: 'every 24 hours',
        secrets: [GOOGLE_API_KEY],
        region: 'us-central1',
        timeoutSeconds: 540,
    },
    async (event) => {
        logger.info('Starting scheduled website crawl...');

        const urls = [
            'https://bmbcfamily.com/about-us',
            'https://bmbcfamily.com/next-steps',
            // 'https://bmbcfamily.com/staff-leaders', // 404s currently
        ];

        for (const url of urls) {
            try {
                // Reuse the logic from ingestContent (refactor if needed, or just call internal helper)
                // For simplicity, duplicating fetch logic here or we can extract a helper function.
                // Let's extract a helper.
                await ingestUrl(url);
            } catch (e) {
                logger.error(`Failed to crawl ${url}:`, e);
            }
        }
    }
);

async function ingestUrl(url: string) {
    logger.info(`Fetching URL: ${url}`);
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    $('script').remove();
    $('style').remove();
    $('nav').remove();
    $('footer').remove();

    const text = $('body').text().replace(/\s+/g, ' ').trim();
    const title = $('title').text().trim() || url;

    const chunks = splitText(text);
    const batch = db.batch();

    // Check if we should delete old chunks for this URL first?
    // Ideally yes, to avoid duplicates.
    const oldDocs = await db.collection('sermon_chunks').where('url', '==', url).get();
    oldDocs.forEach(doc => batch.delete(doc.ref));

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embeddingResult = await ai.embed({
            embedder: textEmbedding004,
            content: chunk,
        });
        const embeddingVector = extractEmbedding(embeddingResult);

        const docRef = db.collection('sermon_chunks').doc();
        batch.set(docRef, {
            docType: 'webpage',
            title: title,
            url: url,
            text: chunk,
            embedding: FieldValue.vector(embeddingVector),
            createdAt: FieldValue.serverTimestamp(),
            chunkIndex: i,
        });
    }
    await batch.commit();
    logger.info(`Ingested ${chunks.length} chunks for ${url}`);
}

import { onDocumentWritten } from 'firebase-functions/v2/firestore';

export const ingestSocialPost = onDocumentWritten(
    {
        document: 'posts/{postId}',
        secrets: [GOOGLE_API_KEY],
        region: 'us-central1',
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            return; // Deletion
        }

        const after = snapshot.after.data();
        const before = snapshot.before.data();

        // If deleted or no content, skip
        if (!after || !after.content) {
            // TODO: Handle deletion from knowledge base if post is deleted?
            return;
        }

        // If content hasn't changed, skip
        if (before && before.content === after.content) {
            return;
        }

        const text = after.content;
        const postId = event.params.postId;
        const title = `Social Post ${after.timestamp ? new Date(after.timestamp).toLocaleDateString() : ''}`;

        let url = after.externalUrl;
        if (!url) {
            if (after.type === 'facebook' && after.sourceId) {
                url = `https://facebook.com/${after.sourceId}`;
            } else {
                url = `https://bethel-metro-social.web.app/posts/${postId}`; // Internal link
            }
        }

        logger.info(`Ingesting social post ${postId}...`);

        try {
            const embeddingResult = await ai.embed({
                embedder: textEmbedding004,
                content: text,
            });
            const embeddingVector = extractEmbedding(embeddingResult);

            // We store social posts as a single chunk usually, as they are short.
            // But we should use the same schema.
            // We use the postId as the ID for the knowledge base doc to allow easy updates.
            const kbDocRef = db.collection('sermon_chunks').doc(`post_${postId}`);

            await kbDocRef.set({
                docType: 'social_post',
                title: title,
                url: url,
                text: text,
                embedding: FieldValue.vector(embeddingVector),
                createdAt: FieldValue.serverTimestamp(),
                originalPostId: postId,
                metadata: {
                    author: after.author?.name || 'Unknown',
                    platform: after.type || 'unknown',
                }
            });
            logger.info(`Ingested social post ${postId}`);
        } catch (e) {
            logger.error(`Failed to ingest social post ${postId}:`, e);
        }
    }
);
