const fetch = require('node-fetch');

async function testSearch() {
    const url = 'https://us-central1-bethel-metro-social.cloudfunctions.net/search';
    const query = "Map of Paul's missionary journeys";
    console.log(`Testing Search at: ${url} with query: "${query}"`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: {
                    query: query
                }
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);

        try {
            const json = JSON.parse(text);
            // console.log('Response:', JSON.stringify(json, null, 2));

            if (json.error) {
                console.error('Function returned error:', json.error);
                process.exit(1);
            }

            const results = json.result?.results || json.data?.results || [];
            console.log(`Found ${results.length} results.`);

            if (results.length > 0) {
                const first = results[0];
                console.log('First Result Structure:');
                console.log('Title:', first.title);
                console.log('Link:', first.link);
                console.log('Snippet:', first.snippet ? 'Present' : 'MISSING');
                console.log('DisplayLink:', first.displayLink ? 'Present' : 'MISSING');
                console.log('Thumbnail:', first.thumbnail ? 'Present' : 'MISSING');

                if (first.snippet && first.thumbnail) {
                    console.log('SUCCESS: Rich results found (Snippet + Thumbnail).');
                } else {
                    console.warn('WARNING: Some rich fields are missing.');
                }
            } else {
                console.warn('WARNING: No results returned.');
            }

        } catch (e) {
            console.log('Raw body:', text);
        }

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testSearch();
