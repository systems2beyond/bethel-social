import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const { filename, contentType } = await req.json();

        if (!filename || !contentType) {
            return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
        }

        // 1. Get Integration Settings from Firestore to find Target Folder
        const settingsDoc = await adminDb.collection('settings').doc('integrations').get();
        const settings = settingsDoc.data();

        if (!settings?.drive?.enabled || !settings?.drive?.targetFolderId) {
            return NextResponse.json({ error: 'Google Drive integration is not configured' }, { status: 400 });
        }

        const targetFolderId = settings.drive.targetFolderId;

        // 2. Authenticate with Google Drive
        // This relies on GOOGLE_APPLICATION_CREDENTIALS or default service account
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // 3. Initiate Resumable Upload
        const fileMetadata = {
            name: filename,
            parents: [targetFolderId],
        };

        const media = {
            mimeType: contentType,
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
            uploadType: 'resumable' // Important!
        });

        // The 'location' header acts as the Resumable Session URI
        // However, using googleapis library, the behavior differs slightly:
        // - If we provide a readable stream content, it uploads.
        // - If we want just the session URI to send to client, we might need a lower level call or 'create' with empty body but 'resumable' param logic is tricky in the lib.

        // Actually, the `googleapis` node library tries to handle upload itself if 'body' is valid stream.
        // To get ONLY the session URI for client-side upload, we need to manually start the resumable session or use a trick.

        // Standard approach with library usually performs the upload. 
        // We want to delegate upload to client.

        // Let's manually request the session URI using `auth.request`.
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        const initiationUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`;

        const initResponse = await fetch(initiationUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': contentType,
                'X-Upload-Content-Length': '', // Optional but good practice if known
            },
            body: JSON.stringify({
                name: filename,
                parents: [targetFolderId]
            })
        });

        if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error('Drive Init Error:', errorText);
            throw new Error('Failed to initiate drive upload');
        }

        const uploadUrl = initResponse.headers.get('Location');

        if (!uploadUrl) {
            throw new Error('No upload URL returned from Drive');
        }

        return NextResponse.json({ uploadUrl });

    } catch (error: any) {
        console.error('Error in upload route:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
