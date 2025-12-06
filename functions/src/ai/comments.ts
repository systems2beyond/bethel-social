import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

// Initialize Genkit
const ai = genkit({
    plugins: [vertexAI({ location: 'us-central1', projectId: 'bethel-metro-social' })],
    model: 'vertexai/gemini-2.0-flash-001',
});

const db = admin.firestore();

export const onCommentCreated = onDocumentCreated(
    {
        document: 'posts/{postId}/comments/{commentId}',
        region: 'us-central1',
        maxInstances: 10,
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            return;
        }

        const comment = snapshot.data();
        const { postId, commentId } = event.params;

        // 1. Check for mentions of Matthew
        // Matches @Matthew, @Matt, @matthew, @matt (case insensitive)
        // Also matches if it's just "Matthew" or "Matt" at the start of the sentence potentially, 
        // but let's stick to explicit mentions or clear intent for now to avoid spam.
        // The user said: "@matthew or @matt capilized or not shouldnt matter"
        const mentionRegex = /@?(Matthew|Matt)\b/i;

        if (!mentionRegex.test(comment.content)) {
            logger.info(`No mention found in comment ${commentId}`);
            return;
        }

        // Prevent infinite loops: Don't reply to yourself (AI)
        if (comment.author.id === 'ai-matthew') {
            return;
        }

        logger.info(`Matthew mentioned in comment ${commentId} on post ${postId}`);

        try {
            // 2. Fetch Context
            // A. The Post Content
            const postDoc = await db.collection('posts').doc(postId).get();
            const postData = postDoc.data();
            const postContent = postData?.content || "No content";
            const postAuthor = postData?.author?.name || "Unknown";

            // B. Recent Comments (Thread Context)
            // Get last 5 comments before this one to understand the conversation
            const commentsSnapshot = await db.collection('posts').doc(postId).collection('comments')
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();

            // Reverse to get chronological order
            const recentComments = commentsSnapshot.docs.map(doc => doc.data()).reverse();

            // 3. Construct Prompt
            const systemPrompt = `
            You are **Matthew**, a digital disciple and AI assistant for the Bethel Metropolitan Baptist Church community.
            You are named after the biblical disciple Matthew (Levi), the tax collector turned follower of Jesus.
            
            **Your Persona:**
            - **Biblical & Grounded:** You speak with wisdom, referencing scripture naturally (KJV or NIV).
            - **Friendly & Approachable:** You are not a robot; you are a helpful member of the community.
            - **Humble:** You acknowledge you are an AI helper, but you strive to serve like a disciple.
            - **Context Aware:** You are reading a comment thread on a social media post.
            
            **The Post You Are Commenting On:**
            Author: ${postAuthor}
            Content: "${postContent}"
            
            **Recent Comments:**
            ${recentComments.map(c => `- ${c.author.name}: "${c.content}"`).join('\n')}
            
            **Instructions:**
            - Reply to the last comment by **${comment.author.name}**.
            - Keep your response concise (under 280 characters if possible, like a tweet/comment).
            - Answer their question or offer spiritual encouragement.
            - If they ask for prayer, offer a short prayer.
            - Use emojis sparingly but effectively.
            `;

            const userPrompt = `Reply to this comment: "${comment.content}"`;

            // 4. Generate Response
            const result = await ai.generate({
                prompt: [
                    { text: systemPrompt },
                    { text: userPrompt }
                ],
                config: {
                    temperature: 0.7,
                }
            });

            const responseText = result.text;

            // 5. Post Reply
            await db.collection('posts').doc(postId).collection('comments').add({
                postId: postId,
                author: {
                    id: 'ai-matthew',
                    name: 'Matthew',
                    avatarUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Matthew&clothing=graphicShirt&eyes=happy&mouth=smile&top=shortHair' // Placeholder avatar
                },
                content: responseText,
                timestamp: Date.now(),
                isAi: true // Flag for frontend styling
            });

            logger.info(`Matthew replied to comment ${commentId}`);

        } catch (error) {
            logger.error("Error generating Matthew response:", error);
        }
    }
);
