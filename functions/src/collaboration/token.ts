import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as jwt from "jsonwebtoken";


// Initialize admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const APP_SECRET = "2e639665f80b85290236a2731174668615b13aa42dfd08c6fa11277a94943c2c";

export const generateTiptapToken = functions.https.onCall(async (dataOrRequest: any, context: any) => {
    // ADAPTER: Detect if we are receiving a v2 CallableRequest (common in Gen 2 functions)
    let data = dataOrRequest;
    let auth = context?.auth; // Default to v1 context.auth

    // If the first argument looks like a CallableRequest (has .data and .auth properties)
    if (dataOrRequest && typeof dataOrRequest === 'object' && 'data' in dataOrRequest && 'auth' in dataOrRequest) {
        console.log("Detected v2 CallableRequest signature.");
        data = dataOrRequest.data;
        auth = dataOrRequest.auth;
    }

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
            isV2: !!(dataOrRequest && dataOrRequest.data && dataOrRequest.auth),
            hasAuth: !!auth,
            dataKeysArgs1: Object.keys(dataOrRequest || {}),
            dataKeysResolved: Object.keys(data || {}),
            hasAuthToken: !!data?.auth_token,
        };
        console.error("Auth failed. Debug:", JSON.stringify(debugInfo));
        throw new functions.https.HttpsError('unauthenticated', `The function must be called while authenticated. Debug: ${JSON.stringify(debugInfo)}`);
    }

    // Fetch user details for the token
    const user = await admin.auth().getUser(uid);

    try {
        // 2. Sign the JWT for Hocuspocus
        // We use the same structure but signed with OUR secret.
        const documentName = data.documentName || "*";

        const token = jwt.sign({
            allowedDocumentNames: [documentName],
            uid: uid,
            name: user.displayName || 'User',
            iss: "bethel-social", // New Issuer
        }, APP_SECRET, {
            expiresIn: "1h", // Rotate tokens every hour
        });

        return { token };

    } catch (error) {
        console.error("Error signing token:", error);
        throw new functions.https.HttpsError('internal', 'Unable to sign token');
    }
});
