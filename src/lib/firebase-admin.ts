import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
// We use getApps() to avoid initializing twice in development hot-reloading
if (getApps().length === 0) {
    // If GOOGLE_APPLICATION_CREDENTIALS is set, applicationDefault() is used automatically by initializeApp()
    // If not, we might fall back to other methods, but for now we assume standard environment setup.
    // If we have a specific serviceAccount JSON in env, we could parse it, but standard practice is env var path.
    initializeApp();
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminApp = getApp();
