import * as logger from 'firebase-functions/logger';
import { genkit, z } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

// Define Model Constants
export const MODEL_FLASH = 'vertexai/gemini-2.0-flash-001';
export const MODEL_PRO = 'vertexai/gemini-2.0-flash-001'; // Using Flash 2.0 for everything as it's better/faster

// Initialize a separate Genkit instance for routing (always uses Flash)
const routerAi = genkit({
    plugins: [vertexAI({ location: 'us-central1', projectId: 'bethel-metro-social' })],
    model: MODEL_FLASH,
});

const ClassificationSchema = z.object({
    complexity: z.enum(['SIMPLE', 'COMPLEX']).describe("The complexity level of the query."),
    reasoning: z.string().describe("Brief reason for the classification."),
});

export async function routeQuery(query: string, hasImage: boolean): Promise<any> {
    // 1. Visual queries default to PRO (complex multimodal analysis)
    if (hasImage) {
        logger.info('Routing: Image detected -> PRO');
        return MODEL_PRO;
    }

    // 2. Short queries are usually simple
    if (query.length < 15) {
        logger.info('Routing: Short query -> FLASH');
        return MODEL_FLASH;
    }

    try {
        const prompt = `
        Classify the following user query as SIMPLE or COMPLEX.
        
        **SIMPLE:** 
        - Greetings (Hi, Hello)
        - Specific facts (What time is service? Where is the church?)
        - Simple database lookups (Who is the pastor?)
        - Yes/No questions.
        
        **COMPLEX:**
        - Theological questions (What is grace? Why do we pray?)
        - Emotional support or advice (I feel sad, pray for me).
        - Reasoning or summarization tasks.
        - Open-ended questions.

        Query: "${query}"
        `;

        const result = await routerAi.generate({
            model: MODEL_FLASH,
            prompt: prompt,
            output: { schema: ClassificationSchema },
        });

        const classification = result.output;
        logger.info(`Routing: Classified as ${classification?.complexity} (${classification?.reasoning})`);

        if (classification?.complexity === 'COMPLEX') {
            return MODEL_PRO;
        }
        return MODEL_FLASH;

    } catch (e) {
        logger.error('Routing failed, defaulting to FLASH:', e);
        return MODEL_FLASH; // Fallback
    }
}
