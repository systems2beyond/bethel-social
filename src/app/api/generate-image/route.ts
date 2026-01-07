import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // STRATEGY: "SmAIrt" Local Generation
        // External APIs are unreliable (rate limits, timeouts) on shared IPs without authentication.
        // We use a deterministic, premium SVG generation based on keywords.
        // This is 100% reliable, fast, and ensures religious relevance.

        // SVG Paths for Christian/Social Icons
        const ICONS = {
            cross: "M256 0v160h-96v96h96v256h96v-256h96v-96h-96v-160z", // Latin Cross
            bible: "M144 32v416c0 17.7 14.3 32 32 32h272c17.7 0 32-14.3 32-32v-416c0-17.7-14.3-32-32-32h-272c-17.7 0-32 14.3-32 32zm80 32h208v352h-208v-352zm-32 32v352h-208v-352h208z",
            music: "M384 32h-128c-17.7 0-32 14.3-32 32v214c-13.9-8.8-30.6-14-48-14-44.2 0-80 35.8-80 80s35.8 80 80 80c43.3 0 78.4-34.3 79.8-77.2l.2-2.8v-218h96v224h32v-286c0-17.7-14.3-32-32-32z",
            heart: "M256 448l-30.2-27.2c-107.2-97.2-177.8-161.3-177.8-240.2 0-63.1 49.5-112.6 112.6-112.6 35.6 0 69.7 16.6 91.2 42.6 21.6-26 55.6-42.6 91.2-42.6 63.1 0 112.6 49.5 112.6 112.6 0 78.9-70.6 143-177.8 240.2l-30.2 27.2z",
            star: "M256 38.013l68.797 162.721 176.633 14.288-135.216 117.85 41.677 172.115-151.891-91.135-151.891 91.135 41.677-172.115-135.216-117.85 176.633-14.288z",
            globe: "M256 0c-141.4 0-256 114.6-256 256s114.6 256 256 256 256-114.6 256-256-114.6-256-256-256zm0 464c-25.2 0-48.8-4.6-70.6-12.8 19.4-44.8 38.6-105.4 38.6-180.2h64c0 74.8 19.2 135.4 38.6 180.2-21.8 8.2-45.4 12.8-70.6 12.8zm-96-32.9c16.3-13.4 33.4-30.8 49-54.8-21.6-35-37.5-77.4-44.4-123.3h-82.6c13.7 75.8 54.4 139.7 111.4 178.1zm-44.4-207.1h69.4c1.1-23.8 3.5-46.7 6.9-68.5-45.1 11.4-83.3 35.9-111.8 68.5 10.9 0 22.8 0 35.5 0zm140.4-124h-100c-6.6 45.9-22.5 88.3-44.1 123.3 16-10.4 33.4-17.8 50.4-23.6 16.7-5.7 34.6-8.7 53.7-8.7v-91z"
        };

        // Gradient Palettes
        const GRADIENTS = {
            warm: ['#FF9A9E', '#FECFEF'], // Youth, Love
            cool: ['#2193B0', '#6DD5ED'], // Study, Prayer
            spiritual: ['#673AB7', '#512DA8'], // Worship, Royal
            nature: ['#11998e', '#38ef7d'], // Outreach, Growth
            gold: ['#DAA520', '#FFD700'], // Classic Church
            midnight: ['#232526', '#414345'] // Men's, Serious
        };

        const lower = prompt.toLowerCase();

        // 1. Determine Icon (with randomness)
        const iconKeys = Object.keys(ICONS);
        let iconPath = ICONS.cross; // Default
        let iconScale = 0.5 + (Math.random() * 0.2); // Random scale between 0.5 and 0.7

        // Add random rotation and position offset
        const rotation = Math.floor(Math.random() * 20) - 10; // -10 to 10 degrees
        const translateX = 106 + (Math.floor(Math.random() * 20) - 10);
        const translateY = 106 + (Math.floor(Math.random() * 20) - 10);

        if (lower.match(/music|choir|sing|worship|praise/)) {
            iconPath = ICONS.music;
        } else if (lower.match(/bible|study|read|word|scripture/)) {
            iconPath = ICONS.bible;
        } else if (lower.match(/love|care|support|women/)) {
            iconPath = ICONS.heart;
        } else if (lower.match(/youth|kid|child|teen|star|bright/)) {
            iconPath = ICONS.star;
        } else if (lower.match(/mission|outreach|world|global/)) {
            iconPath = ICONS.globe;
        } else {
            // If no match, pick a random religious icon occasionally for variety
            if (Math.random() > 0.7) {
                const randomKey = iconKeys[Math.floor(Math.random() * iconKeys.length)] as keyof typeof ICONS;
                iconPath = ICONS[randomKey];
            }
        }

        // 2. Determine Color (with randomness)
        const gradientKeys = Object.keys(GRADIENTS);
        let gradient = GRADIENTS.gold; // Default

        if (lower.match(/youth|kid|child|love|care/)) gradient = GRADIENTS.warm;
        else if (lower.match(/bible|study|men/)) gradient = GRADIENTS.cool;
        else if (lower.match(/worship|music|royal/)) gradient = GRADIENTS.spiritual;
        else if (lower.match(/mission|outreach|growth/)) gradient = GRADIENTS.nature;
        else {
            // Randomize default gradient
            const randomKey = gradientKeys[Math.floor(Math.random() * gradientKeys.length)] as keyof typeof GRADIENTS;
            gradient = GRADIENTS[randomKey];
        }

        // Randomize gradient direction
        const gradX1 = Math.floor(Math.random() * 100);
        const gradY1 = Math.floor(Math.random() * 100);
        const gradX2 = 100 - gradX1;
        const gradY2 = 100 - gradY1;

        // 3. Construct SVG
        // Note: Using Buffer.from for base64 encoding
        const svg = `
        <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="${gradX1}%" y1="${gradY1}%" x2="${gradX2}%" y2="${gradY2}%">
                    <stop offset="0%" style="stop-color:${gradient[0]};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${gradient[1]};stop-opacity:1" />
                </linearGradient>
                <filter id="shadow">
                    <feDropShadow dx="0" dy="8" stdDeviation="15" flood-color="#000" flood-opacity="0.4"/>
                </filter>
            </defs>
            <!-- Background -->
            <rect width="512" height="512" fill="url(#grad)" rx="128" ry="128" />
            
            <!-- Icon -->
            <g transform="translate(${translateX}, ${translateY}) rotate(${rotation} 150 150) scale(${iconScale})" fill="white" filter="url(#shadow)">
                <path d="${iconPath}" />
            </g>
        </svg>`;

        const base64 = Buffer.from(svg).toString('base64');
        const dataUri = `data:image/svg+xml;base64,${base64}`;

        return NextResponse.json({
            image: dataUri
        });

    } catch (error) {
        console.error('Error generating image:', error);
        return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
    }
}
