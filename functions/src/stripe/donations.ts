
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

const getStripe = () => {
    const key = stripeSecretKey.value();
    if (!key) throw new HttpsError('internal', 'Stripe secret key not configured.');
    return new Stripe(key, { apiVersion: '2025-12-15.clover' as any });
};

export const createDonationIntent = onCall({ secrets: [stripeSecretKey] }, async (request) => {
    if (!request.auth) {
        // Optional: Support guest donations? 
    }

    const { amount, tipAmount, churchId, campaign } = request.data;

    if (!amount || isNaN(amount) || amount < 50) { // Min 50 cents
        throw new HttpsError('invalid-argument', 'Invalid donation amount');
    }

    const tip = tipAmount && !isNaN(tipAmount) ? tipAmount : 0;
    const totalAmount = amount + tip; // In cents

    const db = admin.firestore();
    const churchDoc = await db.collection('churches').doc(churchId || 'default_church').get();
    const churchData = churchDoc.data();

    if (!churchData?.stripeAccountId) {
        throw new HttpsError('failed-precondition', 'Church is not connected to Stripe.');
    }

    const stripe = getStripe();

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            application_fee_amount: tip, // The tip goes to the Platform
            transfer_data: {
                destination: churchData.stripeAccountId, // The donation goes to the Church
            },
            on_behalf_of: churchData.stripeAccountId, // Church is the Merchant of Record (for 501c3 rates & receipts)
            description: `Donation to Bethel Church (${campaign || 'General'})`,
            statement_descriptor_suffix: 'DONATION',
            metadata: {
                churchId: churchId || 'default_church',
                donorId: request.auth?.uid || 'guest',
                donationAmount: amount,
                tipAmount: tip,
                campaign: campaign || 'General Fund', // Store the campaign
                type: 'donation'
            }
        });

        return {
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        };
    } catch (error: any) {
        console.error('Donation Intent Error:', error);
        throw new HttpsError('internal', error.message);
    }
});
