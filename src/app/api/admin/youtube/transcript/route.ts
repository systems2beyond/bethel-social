import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Fetch transcript
        try {
            const transcriptItems = await YoutubeTranscript.fetchTranscript(url);

            // Combine into a single string
            const fullText = transcriptItems.map(item => item.text).join(' ');

            // Decode HTML entities (basic handling)
            const decodedText = fullText
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

            return NextResponse.json({ transcript: decodedText });
        } catch (ytError: any) {
            console.error('YouTube API Error:', ytError);
            // Handle disabled captions or invalid video
            const errorStr = ytError?.message || ytError?.toString() || '';
            if (errorStr.includes('Captions are disabled') || errorStr.includes('Transcript is disabled')) {
                return NextResponse.json({ error: 'Transcripts are disabled for this video. The uploader has not enabled captions.' }, { status: 422 });
            }
            // Return detailed error for debugging
            return NextResponse.json({
                error: `Detailed Error: ${ytError.message || ytError.toString()}`
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Transcript Fetch Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
