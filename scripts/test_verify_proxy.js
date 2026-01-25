// scripts/test_verify_proxy.js
const fetch = require('node-fetch'); // Assuming node-fetch is available or using native fetch in Node 18+

// URL to test
const BASE_URL = 'https://bethel-metro-social.netlify.app';
const ENDPOINT = '/api/verifyDonation';

async function testProxy() {
    console.log(`Testing ${BASE_URL}${ENDPOINT}...`);

    // Test 1: No Trailing Slash
    try {
        const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { donationId: 'test-id' } })
        });
        console.log(`\nPOST ${ENDPOINT} (No Slash):`);
        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`Body Preview: ${text.substring(0, 100)}`);
        console.log(`Is HTML? ${text.trim().startsWith('<')}`);

        if (res.status === 404 || text.trim().startsWith('<')) {
            console.error('❌ Failed: Route not found or returning HTML (Next.js 404 page)');
        } else if (res.status === 401 || res.status === 403) {
            console.log('✅ Success! (401/403 means Proxy hit the Cloud Function which rejected auth)');
        } else {
            console.log('❓ Unexpected status, but likely not a 404.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }

    // Test 2: With Trailing Slash (if Middleware matches both)
    const ENDPOINT_SLASH = '/api/verifyDonation/';
    try {
        const res = await fetch(`${BASE_URL}${ENDPOINT_SLASH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { donationId: 'test-id' } })
        });
        console.log(`\nPOST ${ENDPOINT_SLASH} (With Slash):`);
        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`Body Preview: ${text.substring(0, 100)}`);

        if (res.status === 401 || res.status === 403) {
            console.log('✅ Success! (401/403 means Proxy hit the Cloud Function which rejected auth)');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testProxy();
