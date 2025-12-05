const DEBUG_URL = 'https://us-central1-bethel-metro-social.cloudfunctions.net/debugPosts';

async function check() {
    console.log(`Checking posts at ${DEBUG_URL}...`);
    try {
        const response = await fetch(DEBUG_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        console.log('Post Count:', result.count);
        console.log('Oldest Post:', result.oldest);
        console.log('Newest Post:', result.newest);
        console.log('Debug Info:', JSON.stringify(result.debugInfo, null, 2));
        console.log('Gap Posts (around Oct 5):', JSON.stringify(result.gapPosts, null, 2));
        console.log('Simulation Log:', JSON.stringify(result.simulationLog, null, 2));
    } catch (e) {
        console.error('Check failed:', e);
    }
}

check();
