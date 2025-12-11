const axios = require('axios');

// URL of the deployed function (or emulator if running locally)
// const FUNCTION_URL = 'http://127.0.0.1:5001/bethel-metro-social/us-central1/fetchUrlContent'; // Emulator
const FUNCTION_URL = 'https://us-central1-bethel-metro-social.cloudfunctions.net/fetchUrlContent'; // Production

async function testUrl(url, expectedMethod) {
    console.log(`\n--- Testing URL: ${url} ---`);
    console.log(`Expected handling: ${expectedMethod}`);

    const startTime = Date.now();
    try {
        const response = await axios.post(FUNCTION_URL, { url });
        const duration = Date.now() - startTime;

        if (response.data.success) {
            console.log(`✅ SUCCESS (${duration}ms)`);
            console.log(`Title: ${response.data.title}`);
            console.log(`Site: ${response.data.siteName}`);
            console.log(`Content Length: ${response.data.content?.length} chars`);
        } else {
            console.log(`❌ FAILED (Soft): ${response.data.error}`);
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`❌ FAILED (Hard) (${duration}ms):`);
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Data:`, error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

async function runTests() {
    console.log("Starting Reader View Verification...");

    // 1. Test a "normal" site (should be fast, handled by Axios)
    await testUrl('https://example.com', 'Axios (Fast)');

    // 2. Test a "strict" site (Reddit/Pinterest) - Should trigger Puppeteer fallback
    // Note: Reddit often blocks Axios immediately.
    await testUrl('https://www.reddit.com/r/Christianity/comments/1b8t5p0/what_is_the_gospel/', 'Puppeteer (Fallback)');

    // 3. Test a PDF (should succeed now)
    await testUrl('https://www.hhs.gov/sites/default/files/surgeon-general-social-connection-advisory.pdf', 'PDF Check (Should Succeed)');

    console.log("\nVerification Complete.");
}

runTests();
