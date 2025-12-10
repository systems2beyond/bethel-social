import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export const saveImageProxy = onRequest({
    cors: true // Enable wildcard CORS for now to rule out issues
}, async (req, res) => {
    // Manually handle CORS if needed, but 'cors: true' should handle it.
    // We can also set headers manually.
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    console.log('saveImageProxy (onRequest) called!');

    // Basic connectivity test
    res.status(200).json({ success: true, message: 'Function is reachable via onRequest!' });
});
