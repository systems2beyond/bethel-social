import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-helpers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// POST - Set super_admin custom claims on a user
export async function POST(request: Request) {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { email } = await request.json();
    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    try {
        // Look up user by email
        const userRecord = await adminAuth.getUserByEmail(email);

        // Set custom claims
        await adminAuth.setCustomUserClaims(userRecord.uid, {
            ...userRecord.customClaims,
            super_admin: true,
        });

        // Also update Firestore role
        await adminDb.collection('users').doc(userRecord.uid).update({
            role: 'super_admin',
        });

        // Audit log
        await adminDb.collection('system_logs').add({
            action: 'super_admin_granted',
            targetUid: userRecord.uid,
            targetEmail: email,
            performedBy: admin.uid,
            performedByEmail: admin.email,
            timestamp: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, uid: userRecord.uid });
    } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to set claims' }, { status: 500 });
    }
}
