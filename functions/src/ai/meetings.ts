import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

// Initialize Genkit
const ai = genkit({
    plugins: [vertexAI({ location: 'us-central1', projectId: 'bethel-metro-social' })],
    model: 'vertexai/gemini-2.0-flash-001',
});

const db = admin.firestore();

export const generateMeetingRecap = onCall({ timeoutSeconds: 300 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { meetingId } = request.data;
    if (!meetingId) {
        throw new HttpsError('invalid-argument', 'Meeting ID is required.');
    }

    try {
        // 1. Fetch Meeting Details
        const meetingRef = db.collection('meetings').doc(meetingId);
        const meetingSnap = await meetingRef.get();

        if (!meetingSnap.exists) {
            throw new HttpsError('not-found', 'Meeting not found.');
        }

        const meeting = meetingSnap.data();

        // 2. Fetch Chat Logs
        const chatSnap = await db.collection('meetings').doc(meetingId).collection('comments').orderBy('timestamp', 'asc').get();
        const chatLogs = chatSnap.docs.map(doc => {
            const data = doc.data();
            return `${data.author.name}: ${data.content}`;
        }).join('\n');

        // 3. Construct Prompt (Use transcriptUrl if I could fetch it, but for now just Chat)
        // TODO: If we implement transcript fetching, add it here.
        let promptContext = `
        Meeting Title: ${meeting?.title}
        Date: ${new Date(meeting?.date).toDateString()}
        Description: ${meeting?.description || 'N/A'}
        
        Transcript / Chat Log:
        ${chatLogs.length > 0 ? chatLogs : '[No chat messages recorded.]'}
        `;

        // 4. Generate Content with AI
        const prompt = `
        You are an expert secretary and meeting facilitator.
        Review the following meeting context (Chat logs and details).
        Generate a structured "Meeting Minutes" document.
        
        Format it in clean Markdown.
        Include:
        - **Summary**: A brief paragraph summarizing the discussion.
        - **Key Topics**: Bullet points of main subjects discussed.
        - **Action Items**: A checklist of tasks mentioned or implied (assign to "Team" if unclear).
        - **Notable Quotes**: Interesting things said (if any).
        
        If the input is sparse (e.g. just greetings), create a polite generic summary saying "General fellowship meeting with no specific business recorded." but still try to be helpful.
        
        Context:
        ${promptContext}
        `;

        const { text } = await ai.generate(prompt);

        // 5. Save as a Note (Scroll) for the User
        const noteRef = db.collection('users').doc(request.auth.uid).collection('notes').doc();
        await noteRef.set({
            title: `Recap: ${meeting?.title}`,
            content: text,
            tags: ['Meeting', 'AI Recap'],
            updatedAt: Date.now(),
            createdAt: Date.now(),
            type: 'text' // simple text/markdown note
        });

        // 6. Update Meeting to say a recap was generated? (Optional)
        // await meetingRef.update({ recapGenerated: true });

        return { success: true, noteId: noteRef.id };

    } catch (error: any) {
        logger.error('Error generating meeting recap:', error);
        throw new HttpsError('internal', 'Failed to generate recap: ' + error.message);
    }
});
