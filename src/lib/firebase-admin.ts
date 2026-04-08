import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
// We use getApps() to avoid initializing twice in development hot-reloading
if (getApps().length === 0) {
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (base64) {
        // Netlify / production: decode service account from env var
        const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
        initializeApp({ credential: cert(serviceAccount) });
    } else {
        // Local dev: uses Application Default Credentials (gcloud auth)
        initializeApp();
    }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminApp = getApp();
