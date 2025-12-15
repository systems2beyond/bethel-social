import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { genkit, z } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

// Initialize Genkit with Vertex AI
const ai = genkit({
    plugins: [vertexAI({ location: 'us-central1', projectId: 'bethel-metro-social' })],
    model: 'vertexai/gemini-2.0-flash-001',
});

const db = admin.firestore();

// Define the schema for event extraction
const EventSchema = z.object({
    isEvent: z.boolean().describe("True if the post is promoting a specific future event with a date and time."),
    title: z.string().optional().describe("The name of the event."),
    date: z.string().optional().describe("The date of the event in YYYY-MM-DD format."),
    time: z.string().optional().describe("The start time of the event in HH:MM AM/PM format."),
    location: z.string().optional().describe("The location of the event."),
    description: z.string().optional().describe("A brief summary of the event."),
});

export const extractEventFromPost = onDocumentWritten(
    {
        document: 'posts/{postId}',
        region: 'us-central1',
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return; // Deletion

        const after = snapshot.after.data();
        const before = snapshot.before.data();

        // Skip if deleted or no content
        if (!after || !after.content) return;

        // Skip if content hasn't changed (unless it's a new post)
        if (before && before.content === after.content && before.mediaUrl === after.mediaUrl) return;

        const postId = event.params.postId;
        await processPostForEvent(postId, after);
    }
);

// Reusable helper function
async function processPostForEvent(postId: string, postData: any) {
    logger.info(`Analyzing post ${postId} for event details...`);

    try {
        const postDate = postData.timestamp ? new Date(postData.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        const prompt: any[] = [
            {
                text: `Analyze this social media post.
    Context: Today is ${today}. The post was created on ${postDate}.
    Task: If the post is promoting a specific FUTURE event (happening after ${postDate}), extract the details. 
            - If the flyer says "Nov 11" and the post is from Nov 2025, the year is 2025.
            - If the event is in the past relative to the post date, set isEvent to false.
            - If it is just an inspirational quote or general announcement without a specific date / time, set isEvent to false.` },
            { text: `\nPost Content: \n${postData.content} ` }
        ];

        // Determine media URL (prefer thumbnail for YouTube/video)
        const mediaUrl = postData.thumbnailUrl || postData.mediaUrl;

        if (mediaUrl) {
            try {
                new URL(mediaUrl); // Validate URL
                logger.info(`Using media URL: ${mediaUrl}`);
                prompt.push({ media: { url: mediaUrl } });
            } catch (e) {
                logger.warn(`Invalid media URL for post ${postId}: ${mediaUrl}`);
            }
        }

        logger.info(`Sending prompt to Gemini 1.5 Flash for post ${postId}...`);

        let result;
        try {
            result = await ai.generate({
                model: 'vertexai/gemini-2.0-flash-001',
                prompt: prompt,
                output: { schema: EventSchema },
            });
        } catch (err) {
            logger.warn(`Gemini call failed with image for post ${postId}. Retrying with text only...`, err);
            // Remove media part and retry
            const textOnlyPrompt = prompt.filter(p => !p.media);
            result = await ai.generate({
                model: 'vertexai/gemini-2.0-flash-001',
                prompt: textOnlyPrompt,
                output: { schema: EventSchema },
            });
        }

        const extraction = result.output;
        logger.info(`Gemini response for ${postId}: `, JSON.stringify(extraction));

        if (extraction && extraction.isEvent && extraction.title && extraction.date) {
            logger.info(`Event detected in post ${postId}: ${extraction.title} on ${extraction.date}`);

            // Construct a valid timestamp
            let timestamp = admin.firestore.Timestamp.now();
            if (extraction.date) {
                const timeStr = extraction.time || '10:00 AM';
                const dateTimeStr = `${extraction.date} ${timeStr}`;
                const dateObj = new Date(dateTimeStr);
                if (!isNaN(dateObj.getTime())) {
                    timestamp = admin.firestore.Timestamp.fromDate(dateObj);
                }
            }

            await db.collection('events').doc(postId).set({
                title: extraction.title,
                description: extraction.description || postData.content,
                date: timestamp,
                location: extraction.location || 'Bethel Metropolitan Baptist Church',
                imageUrl: postData.thumbnailUrl || postData.mediaUrl || null,
                sourcePostId: postId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                extractedData: extraction
            });
        } else {
            logger.info(`No event detected in post ${postId}.`);
        }

    } catch (e) {
        logger.error(`Failed to extract event from post ${postId}: `, e);
    }
}

export const backfillEvents = onRequest(
    {
        region: 'us-central1',
        timeoutSeconds: 540, // Long timeout for batch processing
    },
    async (req, res) => {
        // Basic security: check for a query param key or just allow it (it's a one-off)
        // For now, open but obscure.

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Posts store timestamp as number (milliseconds), not Firestore Timestamp
        const timestampMs = thirtyDaysAgo.getTime();

        logger.info('Starting backfill for posts since:', thirtyDaysAgo.toISOString(), `(${timestampMs})`);

        try {
            const snapshot = await db.collection('posts')
                .where('timestamp', '>=', timestampMs)
                .get();

            logger.info(`Found ${snapshot.size} posts to process.`);

            // Process in chunks of 3 to avoid rate limits/timeouts
            const posts = snapshot.docs;
            const chunkSize = 3;
            let processedCount = 0;
            for (let i = 0; i < posts.length; i += chunkSize) {
                const chunk = posts.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (doc) => {
                    try {
                        await processPostForEvent(doc.id, doc.data());
                        processedCount++;
                    } catch (err) {
                        logger.error(`Failed to process post ${doc.id}: `, err);
                    }
                }));
            }

            res.json({ success: true, processed: processedCount, totalFound: snapshot.size });
        } catch (error) {
            logger.error('Backfill failed:', error);
            res.status(500).json({ error: 'Backfill failed' });
        }
    }
);
