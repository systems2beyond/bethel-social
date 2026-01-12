const { execSync } = require('child_process');

try {
    console.log('Fetching Webhook Endpoints...');
    const webhooksJson = execSync('stripe webhook_endpoints list --live --limit 5 --format json').toString();
    const webhooks = JSON.parse(webhooksJson);
    const webhook = webhooks.data.find(w => w.url.includes('stripewebhook')); // The URL we matched earlier
    console.log('Webhook ID:', webhook ? webhook.id : 'NOT FOUND');

    console.log('Fetching Events...');
    const eventsJson = execSync('stripe events list --live --type account.updated --limit 20 --format json').toString();
    const events = JSON.parse(eventsJson);
    // Find the latest account.updated event for the specific account
    const targetAccountId = 'acct_1SnWBsAHE2d3dv7U';
    const event = events.data.find(e => e.data.object.id === targetAccountId);
    console.log('Event ID:', event ? event.id : 'NOT FOUND');

} catch (e) {
    console.error('Error:', e.message);
}
