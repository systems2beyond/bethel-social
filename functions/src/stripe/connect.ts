
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

// Define the secret (must be set via `firebase functions:secrets:set STRIPE_SECRET_KEY`)
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

const getStripe = () => {
    const key = stripeSecretKey.value();
    if (!key) {
        // Fallback for local dev if secret not emulated, or throw error
        // For safety, we throw.
        throw new HttpsError('internal', 'Stripe secret key not configured.');
    }
    // Ensure we use the API version matching the SDK or a pinned recent version
    return new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
};

/**
 * creates a Stripe Express account for the church and returns the onboarding URL.
 */
export const createExpressAccount = onCall({ secrets: [stripeSecretKey] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Identify the church/organization. 
    // In this single-tenant-ish app, we might use a single doc 'default_church' or the user's tenant ID.
    const churchId = request.data.churchId || 'default_church';
    const redirectBaseUrl = request.data.redirectUrl; // e.g., http://localhost:3000 or https://myapp.com

    if (!redirectBaseUrl) {
        throw new HttpsError('invalid-argument', 'redirectUrl is required');
    }

    const stripe = getStripe();
    const db = admin.firestore();

    try {
        // 1. Check if account already exists
        const docRef = db.collection('churches').doc(churchId);
        const doc = await docRef.get();
        let accountId = doc.data()?.stripeAccountId;

        if (!accountId) {
            // 2. Create Express Account
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US', // Hardcoded for now, could be dynamic
                email: request.auth.token.email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'manual', // Platform controls payouts (optional, depends on flow)
                        }
                    }
                },
                metadata: {
                    churchId
                }
            });
            accountId = account.id;

            // Save the ID
            await docRef.set({
                stripeAccountId: accountId,
                stripeAccountStatus: 'pending_onboarding',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // 3. Create Account Link
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${redirectBaseUrl}/admin?status=refresh`,
            return_url: `${redirectBaseUrl}/admin?status=complete`,
            type: 'account_onboarding',
        });

        return { url: accountLink.url };
    } catch (error: any) {
        console.error('Stripe Onboarding Error:', error);
        if (error.message && error.message.includes('signed up for Connect')) {
            throw new HttpsError('failed-precondition', 'CONNECT_NOT_ENABLED');
        }
        throw new HttpsError('internal', error.message || 'Failed to create onboarding link');
    }
});

/**
 * Creates a login link for the Stripe Express Dashboard.
 */
export const getStripeLoginLink = onCall({ secrets: [stripeSecretKey] }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const churchId = request.data.churchId || 'default_church';
    const db = admin.firestore();
    const doc = await db.collection('churches').doc(churchId).get();
    const accountId = doc.data()?.stripeAccountId;

    if (!accountId) {
        throw new HttpsError('not-found', 'No Stripe account found for this church.');
    }

    const stripe = getStripe();
    try {
        const loginLink = await stripe.accounts.createLoginLink(accountId);
        return { url: loginLink.url };
    } catch (error: any) {
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Fetches recent payouts for the connected account.
 */
export const getRecentPayouts = onCall({ secrets: [stripeSecretKey] }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const churchId = request.data.churchId || 'default_church';
    const db = admin.firestore();
    const doc = await db.collection('churches').doc(churchId).get();
    const accountId = doc.data()?.stripeAccountId;

    if (!accountId) {
        return { payouts: [] };
    }

    const stripe = getStripe();
    try {
        const payouts = await stripe.payouts.list({
            limit: 5,
        }, { stripeAccount: accountId });

        return { payouts: payouts.data };
    } catch (error: any) {
        console.error('Error fetching payouts:', error);
        throw new HttpsError('internal', error.message);
    }
});
