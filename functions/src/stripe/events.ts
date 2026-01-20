
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

export const createEventPaymentIntent = onCall({ secrets: [stripeSecretKey] }, async (request) => {
    // 1. Validate Input
    const { amount, tipAmount, churchId, eventId, ticketType, quantity, registrationData } = request.data;
    // registrationData can include name, email, answers, etc.

    if (!amount || isNaN(amount) || amount < 0) {
        throw new HttpsError('invalid-argument', 'Invalid amount');
    }
    if (!eventId) throw new HttpsError('invalid-argument', 'Missing Event ID');

    // 2. Setup Stripe & Firestore
    const db = admin.firestore();
    const stripe = getStripe();

    // Get Church Stripe Account
    const churchDoc = await db.collection('churches').doc(churchId || 'default_church').get();
    const churchData = churchDoc.data();

    if (!churchData?.stripeAccountId) {
        throw new HttpsError('failed-precondition', 'Church is not connected to Stripe.');
    }

    const tip = tipAmount && !isNaN(tipAmount) ? tipAmount : 0;
    const totalAmount = amount + tip; // In cents for Stripe

    try {
        // 3. Create Pending Registration Document
        // We create the registration *first* with status 'pending_payment'.
        // If payment fails, we have the record (abandoned cart).
        // If payment succeeds, webhook updates it to 'confirmed'.

        const regRef = db.collection('events').doc(eventId).collection('registrations').doc();

        // Basic registration data structure
        const pendingRegData = {
            eventId: eventId,
            userId: request.auth?.uid || null, // Can be null for guest checkout
            status: 'pending_payment', // PENDING STATUS
            ticketType: ticketType || 'general',
            quantity: quantity || 1,
            paymentStatus: 'pending',
            amountPaid: totalAmount / 100, // In dollars
            tipAmount: tip / 100, // In dollars
            currency: 'usd',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            userName: registrationData?.name || request.auth?.token?.name || 'Guest',
            userEmail: registrationData?.email || request.auth?.token?.email || null,
            answers: registrationData?.answers || {}, // Form answers
            stripePaymentIntentId: null, // To be filled
        };

        await regRef.set(pendingRegData);

        // 4. Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount, // cents
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            application_fee_amount: tip, // Tip goes to Platform
            transfer_data: {
                destination: churchData.stripeAccountId, // Ticket revenue goes to Church
            },
            on_behalf_of: churchData.stripeAccountId,
            description: `Event Ticket: ${eventId} (${quantity}x ${ticketType})`,
            metadata: {
                type: 'event_registration',
                eventId: eventId,
                registrationId: regRef.id, // CRITICAL: Link PI to Registration
                userId: request.auth?.uid || 'guest',
                churchId: churchId || 'default_church',
                ticketType: ticketType || 'general',
            }
        });

        // 5. Update Registration with PI ID
        await regRef.update({
            stripePaymentIntentId: paymentIntent.id
        });

        return {
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id,
            registrationId: regRef.id
        };

    } catch (error: any) {
        console.error('Event Payment Intent Error:', error);
        throw new HttpsError('internal', error.message);
    }
});
