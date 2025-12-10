import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export const saveImageProxy = onCall({
    cors: [
        'https://bethel-metro-social.netlify.app',
        'http://localhost:3000',
        'http://localhost:5173'
    ]
}, async (request) => {
    console.log('saveImageProxy called!');
    return { success: true, message: 'Function is reachable!' };
});
