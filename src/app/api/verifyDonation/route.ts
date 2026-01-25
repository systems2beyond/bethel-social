import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const authHeader = req.headers.get('authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const upstreamUrl = 'https://us-central1-bethel-metro-social.cloudfunctions.net/verifyDonationStatus';
        console.log(`Proxying to: ${upstreamUrl}`);

        const response = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify(body)
        });

        // Robust Response Handling
        const contentType = response.headers.get('content-type') || '';
        let data;

        if (contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch (e) {
                console.error('JSON Parse Error of upstream:', e);
                // Fallback if content-type lied
                data = { error: 'Upstream returned invalid JSON', raw: await response.text() };
            }
        } else {
            // It's likely HTML (404/403/500 from GCF infrastructure)
            const text = await response.text();
            console.error('Upstream returned non-JSON:', text.substring(0, 200));
            data = { error: 'Upstream returned non-JSON response', details: text };
        }

        if (!response.ok) {
            console.error('Cloud Function Error Status:', response.status, data);
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data, { status: 200 });

    } catch (error: any) {
        console.error('Proxy Fatal Error:', error);
        return NextResponse.json({ error: 'Internal Proxy Error', details: error.message }, { status: 500 });
    }
}
