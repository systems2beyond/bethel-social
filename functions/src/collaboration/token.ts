import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as jwt from "jsonwebtoken";

// Initialize admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const APP_SECRET = "2e639665f80b85290236a2731174668615b13aa42dfd08c6fa11277a94943c2c";

export const generateTiptapToken = onCall({
    // Enable CORS for Netlify domain
    cors: [
        "https://bethel-metro-social.netlify.app",
        "http://localhost:3000",
        "http://localhost:3001"
    ]
}, async (request) => {
    const { data, auth } = request;

    // 1. Verify Authentication
    let uid = auth?.uid;

    if (!uid && data?.auth_token) {
        try {
            const decoded = await admin.auth().verifyIdToken(data.auth_token);
            uid = decoded.uid;
            console.log("Context auth missing, manually verified token for UID:", uid);
        } catch (e) {
            console.error("Manual token verification failed:", e);
        }
    }

    if (!uid) {
        const debugInfo = {
            hasAuth: !!auth,
            dataKeys: Object.keys(data || {}),
            hasAuthToken: !!data?.auth_token,
        };
        console.error("Auth failed. Debug:", JSON.stringify(debugInfo));
        throw new HttpsError('unauthenticated', `The function must be called while authenticated. Debug: ${JSON.stringify(debugInfo)}`);
    }

    // Fetch user details for the token
    const user = await admin.auth().getUser(uid);

    try {
        // 2. Sign the JWT for Hocuspocus
        const documentName = data.documentName || "*";

        const token = jwt.sign({
            allowedDocumentNames: [documentName],
            uid: uid,
            name: user.displayName || 'User',
            iss: "bethel-social",
        }, APP_SECRET, {
            expiresIn: "1h",
        });

        return { token };

    } catch (error) {
        console.error("Error signing token:", error);
        throw new HttpsError('internal', 'Unable to sign token');
    }
});
