import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// GET - Get single church details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ churchId: string }> }
) {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { churchId } = await params;
    const doc = await adminDb.collection('churches').doc(churchId).get();
    if (!doc.exists) {
        return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    // Get member count
    const membersSnap = await adminDb.collection('users')
        .where('churchId', '==', churchId)
        .count()
        .get();

    return NextResponse.json({
        id: doc.id,
        ...doc.data(),
        memberCount: membersSnap.data().count,
    });
}

// PUT - Update church profile
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ churchId: string }> }
) {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { churchId } = await params;
    const body = await request.json();

    // Get current data for audit log
    const currentDoc = await adminDb.collection('churches').doc(churchId).get();
    if (!currentDoc.exists) {
        return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'subdomain', 'tagline', 'appName', 'description', 'botName', 'botGreeting', 'theme', 'config'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
        if (field in body) {
            updates[field] = body[field];
        }
    }
    updates.updatedAt = FieldValue.serverTimestamp();

    await adminDb.collection('churches').doc(churchId).update(updates);

    // Audit log
    await adminDb.collection('system_logs').add({
        action: 'church_updated',
        churchId,
        performedBy: admin.uid,
        performedByEmail: admin.email,
        changes: { before: currentDoc.data(), after: updates },
        timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, churchId });
}
