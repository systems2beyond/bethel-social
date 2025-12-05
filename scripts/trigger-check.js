const CHECK_URL = 'https://us-central1-bethel-metro-social.cloudfunctions.net/checkPostCount';

async function check() {
    console.log(`Checking posts at ${CHECK_URL}...`);
    try {
        const response = await fetch(CHECK_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        console.log('Post Count:', result.count);
        console.log('Recent Posts:', result.recent);
    } catch (e) {
        console.error('Check failed:', e);
    }
}

check();
