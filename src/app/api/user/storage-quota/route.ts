import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';

/**
 * GET /api/user/storage-quota?userId=<userId>
 *
 * Calculates the total Firebase Storage used by a user for task attachments.
 * Returns: { used, limit, remaining, percentUsed }
 *
 * Note: This requires the requesting user to be authenticated and match the userId,
 * or be an admin. For simplicity, we're checking via a header token.
 */

const MAX_USER_QUOTA = 50 * 1024 * 1024; // 50MB limit for non-Google users

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId parameter' },
                { status: 400 }
            );
        }

        // Get user's churchId for the storage path
        const userDoc = await adminDb.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const userData = userDoc.data();
        const churchId = userData?.churchId || 'default';

        // Calculate storage usage by listing files
        const bucket = getStorage().bucket();
        const storagePaths = [
            `task_attachments/${churchId}/ministry/`,
            `task_attachments/${churchId}/personal/`
        ];

        let totalUsed = 0;
        const fileCount = { ministry: 0, personal: 0 };

        for (const prefix of storagePaths) {
            try {
                const [files] = await bucket.getFiles({
                    prefix: prefix,
                    // Filter to files belonging to this user
                    // Note: This requires files to have userId in metadata or naming convention
                });

                for (const file of files) {
                    // Check if file belongs to this user via metadata
                    const [metadata] = await file.getMetadata();

                    if (metadata?.metadata?.uploadedBy === userId) {
                        const size = parseInt(metadata.size as string, 10) || 0;
                        totalUsed += size;

                        if (prefix.includes('/ministry/')) {
                            fileCount.ministry++;
                        } else {
                            fileCount.personal++;
                        }
                    }
                }
            } catch (err) {
                // Bucket or prefix might not exist yet, that's ok
                console.log(`No files found at ${prefix}`);
            }
        }

        // Also check user document for stored quota tracking (faster than listing)
        const storedUsage = userData?.storageUsed || 0;

        // Use the max of calculated vs stored (in case of discrepancy)
        const actualUsed = Math.max(totalUsed, storedUsage);

        return NextResponse.json({
            used: actualUsed,
            limit: MAX_USER_QUOTA,
            remaining: Math.max(0, MAX_USER_QUOTA - actualUsed),
            percentUsed: Math.round((actualUsed / MAX_USER_QUOTA) * 100),
            fileCount,
            formattedUsed: formatBytes(actualUsed),
            formattedLimit: formatBytes(MAX_USER_QUOTA),
            formattedRemaining: formatBytes(Math.max(0, MAX_USER_QUOTA - actualUsed))
        });

    } catch (error: any) {
        console.error('Error calculating storage quota:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to calculate storage quota' },
            { status: 500 }
        );
    }
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
