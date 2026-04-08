import { adminAuth, adminDb } from '@/lib/firebase-admin';

interface VerifiedSuperAdmin {
    uid: string;
    email: string;
}

/**
 * Verifies that a request is from an authenticated super admin.
 * Checks Firebase custom claims first (fast, no DB read), falls back to Firestore role.
 */
export async function verifySuperAdmin(request: Request): Promise<VerifiedSuperAdmin | null> {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;

    try {
        const decoded = await adminAuth.verifyIdToken(token);

        // Check custom claims first (no DB read needed)
        if (decoded.super_admin === true) {
            return { uid: decoded.uid, email: decoded.email || '' };
        }

        // Fallback: check Firestore role field
        const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
        const userData = userDoc.data();
        if (userData?.role === 'super_admin') {
            return { uid: decoded.uid, email: decoded.email || '' };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Verifies that a request is from an authenticated user (any role).
 * Returns the decoded token UID.
 */
export async function verifyAuth(request: Request): Promise<{ uid: string } | null> {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) return null;

    try {
        const decoded = await adminAuth.verifyIdToken(token);
        return { uid: decoded.uid };
    } catch {
        return null;
    }
}
