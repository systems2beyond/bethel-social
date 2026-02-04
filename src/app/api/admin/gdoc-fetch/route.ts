import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { docId } = await req.json();

        if (!docId) {
            return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
        }

        // Use the Google Docs export endpoint for public documents
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

        const response = await fetch(exportUrl);

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json({ error: 'Document not found or not public. Ensure it is shared as "Anyone with the link can view".' }, { status: 404 });
            }
            throw new Error(`Failed to fetch from Google Docs: ${response.statusText}`);
        }

        const text = await response.text();
        return NextResponse.json({ text });

    } catch (error: any) {
        console.error('Error fetching Google Doc:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
