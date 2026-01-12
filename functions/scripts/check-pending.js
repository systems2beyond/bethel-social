const admin = require('firebase-admin');
const Stripe = require('stripe');

// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();

// Hardcoded for this specific debugging session
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY; // We'll need to run this with the key or rely on it being in the env if using firebase functions shell, but for a standalone script we might need to be careful. 
// actually, let's use the functions emulation if possible, or just hardcode the logic to check the DB first.
// Wait, I can't easily get the secret in a standalone script without the user providing it or using `firebase functions:secrets:access`.

// Let's assume we can just check the firestore doc first to confirm which one it is.
// I'll write a script that attempts to use the stripe SDK if I can import it, or just logs the info for me to verify with a CLI command.
// BETTER APPROACH: Use the `stripe` CLI tool in `run_command` if available? 
// The user has `firebase-tools`. 
// I will try to use the `stripe` node library if installed in `functions`.

async function checkPaymentStatus() {
    // 1. Get the pending donation
    const snapshot = await db.collection('donations')
        .where('status', '==', 'pending')
        .limit(5)
        .get();

    if (snapshot.empty) {
        console.log('No pending donations found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Found pending donation ${doc.id}:`);
        console.log(`- Amount: ${data.amount}`);
        console.log(`- PI ID: ${data.stripePaymentIntentId}`);
        console.log(`- Created At: ${data.createdAt.toDate()}`);

        // We can't easily check Stripe API here without the key in plain text or env.
        // But we can output the PI ID for the user (or me) to check.
    });
}

checkPaymentStatus();
