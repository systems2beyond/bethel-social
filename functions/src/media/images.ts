import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export const uploadImageToStorage = async (imageUrl: string, folder: string, filename?: string): Promise<string> => {
    try {
        console.log(`Uploading image: ${imageUrl} to ${folder}`);
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

        const bucket = admin.storage().bucket();
        const finalFilename = filename ? `${filename}.${extension}` : `${uuidv4()}.${extension}`;
        const filePath = `${folder}/${finalFilename}`;
        const file = bucket.file(filePath);

        await file.save(buffer, {
            metadata: {
                contentType: contentType,
                metadata: {
                    originalUrl: imageUrl
                }
            }
        });

        await file.makePublic();

        return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (error: any) {
        console.error('Error uploading image to storage:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};

export const saveImageProxy = onRequest({
    cors: true // Enable wildcard CORS for now to rule out issues
}, async (req, res) => {
    // Manually handle CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            res.status(400).json({ success: false, error: 'Missing imageUrl' });
            return;
        }

        // Let's assume the client sends the token in Authorization header
        let uid = 'anonymous';
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const idToken = authHeader.split('Bearer ')[1];
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                uid = decodedToken.uid;
            } catch (e) {
                console.warn('Failed to verify token, using anonymous:', e);
            }
        }

        const publicUrl = await uploadImageToStorage(imageUrl, `user-uploads/${uid}`);

        res.status(200).json({ success: true, url: publicUrl });

    } catch (error: any) {
        console.error('Error saving image:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
});
