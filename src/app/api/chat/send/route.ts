
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split('Bearer ')[1];

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify token to ensure valid user (and get UID)
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const body = await request.json();
        const { message, chatId, context, intent } = body; // 'context' is the hidden system context

        if (!message || !chatId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Save User Message to Firestore (Admin SDK bypasses client blocks)
        await adminDb.collection('users').doc(uid).collection('chats').doc(chatId).collection('messages').add({
            role: 'user',
            content: message,
            createdAt: FieldValue.serverTimestamp(),
            intent: intent || 'chat'
        });

        // 1b. Update Chat Title if it's a new chat
        const chatDocRef = adminDb.collection('users').doc(uid).collection('chats').doc(chatId);
        const chatDoc = await chatDocRef.get();
        if (chatDoc.exists) {
            const data = chatDoc.data();
            if (data?.title === 'New Chat' || !data?.title) {
                const newTitle = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                await chatDocRef.set({ title: newTitle }, { merge: true });
            }
        }

        // 2. Invoke Cloud Function for AI Response
        // We proxy the call via server to avoid client-side blocking
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bethel-metro-social';
        const region = 'us-central1'; // Default for Firebase Functions
        const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/chat`;

        // Prepare payload for Callable Function protocol
        // Callable expects: { "data": { ...args } }
        const functionPayload = {
            data: {
                message: context ? `${message}\n\n${context}` : message, // Inject context manually as client would
                intent: intent || 'chat',
                // History? The cloud function might expect history. 
                // Client `sendMessage` sends history. We should probably accept history in body and forward it.
                // However, for simplicity/MVP of the fix, let's see if the function fetches history itself?
                // Checking ChatContext: it sends `history`.
                history: body.history || [],
                userName: body.userName,
                userPhone: body.userPhone
            }
        };

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Forward the user's ID token
            },
            body: JSON.stringify(functionPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Cloud Function Error:', response.status, errorText);
            throw new Error(`AI Service Error: ${response.status}`);
        }

        const result = await response.json();
        const aiResponseText = result.result?.response; // Callable result wrapper: { result: { response: ... } }

        if (aiResponseText) {
            // 3. Save AI Response to Firestore (Optional? Function might do it? 
            // ChatContext saves the BOT message manually after getting response.
            // So we must save it here too.)

            await adminDb.collection('users').doc(uid).collection('chats').doc(chatId).collection('messages').add({
                role: 'assistant',
                content: aiResponseText,
                createdAt: FieldValue.serverTimestamp()
            });

            // Update updated_at
            await adminDb.collection('users').doc(uid).collection('chats').doc(chatId).set({
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
        }

        return NextResponse.json({ success: true, response: aiResponseText });

    } catch (error: any) {
        console.error('Error in chat-send fallback:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
