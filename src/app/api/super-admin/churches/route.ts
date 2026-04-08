import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// GET - List all churches with member counts
export async function GET(request: Request) {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const churchesSnap = await adminDb.collection('churches').get();
    const churches = await Promise.all(
        churchesSnap.docs.map(async (doc) => {
            const data = doc.data();
            // Get member count
            const membersSnap = await adminDb.collection('users')
                .where('churchId', '==', doc.id)
                .count()
                .get();
            return {
                id: doc.id,
                ...data,
                memberCount: membersSnap.data().count,
            };
        })
    );

    return NextResponse.json({ churches });
}

// POST - Create a new church
export async function POST(request: Request) {
    const admin = await verifySuperAdmin(request);
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, subdomain, theme, config, tagline, appName, description, botName, botGreeting, adminEmail } = body;

    if (!name || !subdomain) {
        return NextResponse.json({ error: 'Name and subdomain are required' }, { status: 400 });
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
        return NextResponse.json({ error: 'Subdomain must be lowercase alphanumeric with hyphens' }, { status: 400 });
    }

    // Check subdomain uniqueness
    const existing = await adminDb.collection('churches')
        .where('subdomain', '==', subdomain)
        .get();
    if (!existing.empty) {
        return NextResponse.json({ error: 'Subdomain already taken' }, { status: 409 });
    }

    const churchId = `${subdomain}-church`;
    const churchData = {
        name,
        subdomain,
        tagline: tagline || null,
        appName: appName || null,
        description: description || null,
        botName: botName || null,
        botGreeting: botGreeting || null,
        theme: theme || { primaryColor: '#6366f1', logoUrl: '' },
        config: config || {},
        connectedChurchIds: [],
        createdAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection('churches').doc(churchId).set(churchData);

    // Create invitation if admin email provided
    if (adminEmail) {
        await adminDb.collection('invitations').add({
            email: adminEmail,
            churchId,
            role: 'admin',
            createdBy: admin.uid,
            createdAt: FieldValue.serverTimestamp(),
            status: 'pending',
        });
    }

    // Audit log
    await adminDb.collection('system_logs').add({
        action: 'church_created',
        churchId,
        performedBy: admin.uid,
        performedByEmail: admin.email,
        details: { name, subdomain },
        timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ churchId, ...churchData });
}
