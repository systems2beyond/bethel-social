import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const updateUserRole = onCall(async (request) => {
    // 1. Authentication Check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const callerUid = request.auth.uid;
    const { targetUid, newRole } = request.data;

    // 2. Input Validation
    if (!targetUid || !newRole) {
        throw new HttpsError('invalid-argument', 'The function must be called with "targetUid" and "newRole" arguments.');
    }

    const validRoles = ['admin', 'staff', 'member'];
    if (!validRoles.includes(newRole)) {
        throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // 3. Authorization Check (Caller must be Admin)
    // Check custom claims first for speed
    if (request.auth.token.role !== 'admin') {
        // Double check Firestore just in case claims are stale (optional, but safer for critical ops)
        const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            throw new HttpsError('permission-denied', 'Only admins can update user roles.');
        }
    }

    try {
        // 4. Update Firestore
        await admin.firestore().collection('users').doc(targetUid).update({
            role: newRole,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 5. Update Custom Claims (for Auth context)
        // Preserve existing claims if any, just update role
        const userRecord = await admin.auth().getUser(targetUid);
        const existingClaims = userRecord.customClaims || {};

        await admin.auth().setCustomUserClaims(targetUid, {
            ...existingClaims,
            role: newRole
        });

        return { success: true, message: `User ${targetUid} role updated to ${newRole}` };

    } catch (error: any) {
        console.error('Error updating user role:', error);
        throw new HttpsError('internal', 'Unable to update user role.');
    }
});
