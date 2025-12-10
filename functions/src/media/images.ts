import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export const saveImageProxy = onCall({ cors: true }, async (request) => {
    // Check authentication
    if (!request.auth) {
        throw new HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { imageUrl } = request.data;
    if (!imageUrl) {
        throw new HttpsError(
            'invalid-argument',
            'The function must be called with an "imageUrl" argument.'
        );
    }

    try {
        // 1. Fetch the image
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10s timeout
            maxContentLength: 10 * 1024 * 1024 // 10MB max
        });

        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] || 'image/jpeg';

        // Determine extension
        let extension = 'jpg';
        if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('gif')) extension = 'gif';
        else if (contentType.includes('webp')) extension = 'webp';

        // 2. Upload to Firebase Storage
        const bucket = admin.storage().bucket();
        const filename = `user-uploads/${request.auth.uid}/${uuidv4()}.${extension}`;
        const file = bucket.file(filename);

        await file.save(buffer, {
            metadata: {
                contentType: contentType,
                metadata: {
                    originalUrl: imageUrl,
                    uploadedBy: request.auth.uid
                }
            }
        });

        // 3. Make it public (or generate signed URL)
        // For simplicity in this app, we'll make it public so it loads easily in the editor
        await file.makePublic();

        // 4. Return the public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

        return { success: true, url: publicUrl };

    } catch (error: any) {
        console.error('Error saving image:', error);
        throw new HttpsError(
            'internal',
            `Failed to save image: ${error.message}`
        );
    }
});
