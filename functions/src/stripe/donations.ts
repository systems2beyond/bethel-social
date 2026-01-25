
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

    const { amount, tipAmount, churchId, campaign, donorName, donorEmail } = request.data;

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

        // Create Pending Firestore Document
        const donationRef = db.collection('donations').doc();
        const pendingDonationData = {
            churchId: churchId || 'default_church',
            donorId: request.auth?.uid || 'guest',
            donorName: donorName || 'Anonymous', // Save name
            donorEmail: donorEmail || request.auth?.token?.email || null, // Save email
            amount: amount,
            tipAmount: tip,
            totalAmount: totalAmount / 100, // Stored in dollars
            amountCents: totalAmount,
            campaign: campaign || 'General Fund',
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            stripePaymentIntentId: null, // Will be updated
        };

        await donationRef.set(pendingDonationData);

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
                donorName: donorName || 'Anonymous', // Pass to metadata
                donorEmail: donorEmail || request.auth?.token?.email || 'N/A', // Pass to metadata
                donationAmount: amount,
                tipAmount: tip,
                campaign: campaign || 'General Fund', // Store the campaign
                type: 'donation',
                donationDocId: donationRef.id // Pass the Doc ID to Stripe
            }
        });

        // Update the pending doc with the PI ID
        await donationRef.update({
            stripePaymentIntentId: paymentIntent.id
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

export const verifyDonationStatus = onCall({ secrets: [stripeSecretKey], cors: true }, async (request) => {
    // Only allow admins
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { donationId } = request.data;
    if (!donationId) throw new HttpsError('invalid-argument', 'Missing donationId');

    const db = admin.firestore();
    const donationRef = db.collection('donations').doc(donationId);
    const donationDoc = await donationRef.get();

    if (!donationDoc.exists) throw new HttpsError('not-found', 'Donation not found');

    const donationData = donationDoc.data();
    if (!donationData?.stripePaymentIntentId) {
        throw new HttpsError('failed-precondition', 'No Stripe PaymentIntent ID linked to this donation.');
    }

    const stripe = getStripe();
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(donationData.stripePaymentIntentId);

        let newStatus = donationData.status;

        if (paymentIntent.status === 'succeeded') {
            newStatus = 'paid';
        } else if (paymentIntent.status === 'canceled') {
            newStatus = 'failed'; // or canceled
        } else if (paymentIntent.status === 'requires_payment_method') {
            // Keeps pending or failed
        }

        if (newStatus !== donationData.status) {
            await donationRef.update({
                status: newStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, status: newStatus, updated: true };
        }

        return { success: true, status: donationData.status, updated: false };
    } catch (error: any) {
        console.error('Verify Donation Error:', error);
        throw new HttpsError('internal', error.message);
    }
});
