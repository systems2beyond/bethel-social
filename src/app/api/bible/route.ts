import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const version = searchParams.get('version') || 'kjv';
    const book = searchParams.get('book');
    const chapter = searchParams.get('chapter');
    const search = searchParams.get('search');

    let url = '';

    if (search) {
        url = `https://bible-api.com/?search=${encodeURIComponent(search)}`;
    } else if (book && chapter) {
        url = `https://bible-api.com/${encodeURIComponent(book)}+${chapter}?translation=${version.toLowerCase()}`;
    } else {
        return NextResponse.json({ error: 'Missing book+chapter OR search parameter' }, { status: 400 });
    }

    try {
        console.log(`Proxying Bible request to: ${url}`);

        const res = await fetch(url);

        if (!res.ok) {
            console.error(`Bible API Error: ${res.status} ${res.statusText}`);
            return NextResponse.json({ error: `Upstream API error: ${res.status}` }, { status: res.status });
        }

        const data = await res.json();

        // Cache for 1 year (Bible text doesn't change)
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=31536000, immutable',
                'CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
                'Vercel-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Bible Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
