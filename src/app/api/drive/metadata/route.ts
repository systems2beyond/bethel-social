import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/drive/metadata?url=<drive_share_url>
 *
 * Validates a Google Drive share link and returns file metadata.
 * This works for publicly shared files without requiring authentication.
 *
 * Returns: { name, mimeType, size, thumbnailUrl, isAccessible, driveFileId }
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const driveUrl = searchParams.get('url');

        if (!driveUrl) {
            return NextResponse.json(
                { error: 'Missing url parameter' },
                { status: 400 }
            );
        }

        // Extract file ID from various Google Drive URL formats
        const fileId = extractDriveFileId(driveUrl);

        if (!fileId) {
            return NextResponse.json(
                { error: 'Invalid Google Drive URL format' },
                { status: 400 }
            );
        }

        // Try to get public metadata using the Drive API
        // Note: This only works for files shared with "Anyone with link"
        const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink&key=${process.env.GOOGLE_API_KEY}`;

        const response = await fetch(metadataUrl);

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json({
                    error: 'File not found or not publicly accessible',
                    isAccessible: false,
                    driveFileId: fileId
                }, { status: 404 });
            }

            if (response.status === 403) {
                return NextResponse.json({
                    error: 'File is not publicly shared. Please enable "Anyone with link" access.',
                    isAccessible: false,
                    driveFileId: fileId
                }, { status: 403 });
            }

            throw new Error(`Drive API error: ${response.status}`);
        }

        const data = await response.json();

        return NextResponse.json({
            driveFileId: data.id,
            name: data.name,
            mimeType: data.mimeType,
            size: data.size ? parseInt(data.size, 10) : undefined,
            thumbnailUrl: data.thumbnailLink,
            webViewLink: data.webViewLink,
            downloadUrl: data.webContentLink,
            isAccessible: true
        });

    } catch (error: any) {
        console.error('Error fetching Drive metadata:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch file metadata' },
            { status: 500 }
        );
    }
}

/**
 * Extract Google Drive file ID from various URL formats
 */
function extractDriveFileId(url: string): string | null {
    try {
        // Handle various Drive URL formats:
        // https://drive.google.com/file/d/{fileId}/view
        // https://drive.google.com/open?id={fileId}
        // https://docs.google.com/document/d/{fileId}/edit
        // https://docs.google.com/spreadsheets/d/{fileId}/edit
        // https://docs.google.com/presentation/d/{fileId}/edit
        // https://drive.google.com/uc?id={fileId}&export=download

        const patterns = [
            /\/file\/d\/([a-zA-Z0-9_-]+)/,           // /file/d/{id}
            /\/d\/([a-zA-Z0-9_-]+)/,                  // /d/{id} (docs, sheets, etc.)
            /[?&]id=([a-zA-Z0-9_-]+)/,                // ?id={id} or &id={id}
            /\/folders\/([a-zA-Z0-9_-]+)/,            // /folders/{id}
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    } catch {
        return null;
    }
}
