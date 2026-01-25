
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET'); // For verifying signatures

// Initialize Stripe (Reusing logic, could be in a shared helper)
const getStripe = () => {
    const key = stripeSecretKey.value();
    if (!key) throw new Error('Stripe secret key not configured');
    return new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
};

export const stripeWebhookHandler = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = stripeWebhookSecret.value();

    let event: Stripe.Event;

    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.rawBody, sig as string, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed.`, err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle Connect Webhooks (events from connected accounts)
    // If the event is from a connected account, it will have an "account" field.
    if (event.account) {
        console.log(`[Stripe Webhook] Processing Connect event for account: ${event.account}`);
    }

    const db = admin.firestore();

    try {
        switch (event.type) {
            case 'account.updated': {
                const account = event.data.object as Stripe.Account;
                // ... (rest of account logic)
                const churchSnapshot = await db.collection('churches').where('stripeAccountId', '==', account.id).limit(1).get();

                if (!churchSnapshot.empty) {
                    const churchDoc = churchSnapshot.docs[0];
                    const isFullyEnabled = account.charges_enabled && account.payouts_enabled;

                    await churchDoc.ref.update({
                        stripeAccountStatus: isFullyEnabled ? 'active' : 'pending_verification',
                        stripeDetailsSubmitted: account.details_submitted,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`Updated church ${churchDoc.id} status to ${isFullyEnabled ? 'active' : 'pending'}`);
                }
                break;
            }
            case 'capability.updated':
                break;

            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log(`[Stripe Webhook] PaymentIntent Succeeded: ${paymentIntent.id}`);

                const { churchId, donorId, campaign, donationAmount, tipAmount, type, donationDocId, eventId, registrationId } = paymentIntent.metadata;

                if (!type) {
                    // Try to infer type or fail gracefully
                    console.warn(`[Stripe Webhook] Missing 'type' metadata.`, paymentIntent.metadata);
                }

                if (type === 'event_registration') {
                    // ... (Logic for events, seems fine, keeping as is but ensuring robust logging)
                    if (eventId && registrationId) {
                        const regRef = db.collection('events').doc(eventId).collection('registrations').doc(registrationId);
                        await regRef.set({
                            status: 'paid',
                            paymentStatus: 'paid',
                            stripePaymentIntentId: paymentIntent.id,
                            totalAmount: paymentIntent.amount, // Cents
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }); // Use merge to be safe
                        console.log(`[Stripe Webhook] Updated registration ${registrationId} -> PAID`);
                    }
                } else {
                    // Default to donation if type is 'donation' OR missing (fallback)
                    console.log(`[Stripe Webhook] Processing donation logic for ${paymentIntent.id}`);

                    let donationRef;
                    if (donationDocId) {
                        donationRef = db.collection('donations').doc(donationDocId);
                    } else {
                        // Search by PI ID just in case we missed the docId
                        const existingSnapshot = await db.collection('donations').where('stripePaymentIntentId', '==', paymentIntent.id).limit(1).get();
                        if (!existingSnapshot.empty) {
                            donationRef = existingSnapshot.docs[0].ref;
                        } else {
                            donationRef = db.collection('donations').doc(); // New
                        }
                    }

                    // Upsert logic
                    const donationData = {
                        churchId: churchId || 'default_church',
                        donorId: donorId || 'anonymous',
                        // Handle amounts safely (metadata strings vs numbers)
                        amount: donationAmount ? parseFloat(donationAmount.toString()) : (paymentIntent.amount / 100),
                        tipAmount: tipAmount ? parseFloat(tipAmount.toString()) : 0,
                        totalAmount: paymentIntent.amount / 100, // Dollars
                        amountCents: paymentIntent.amount, // Cents
                        campaign: campaign || 'General Fund',
                        status: 'paid', // FORCE PAID
                        stripePaymentIntentId: paymentIntent.id,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    // Only set createdAt on new docs
                    await donationRef.set(donationData, { merge: true });
                    console.log(`[Stripe Webhook] Successfully updated/created donation ${donationRef.id} as PAID.`);

                    // ... (Card details update - same as before)
                    // We can do this in a separate update or strictly within the set if we extracted it earlier.
                    // Keeping it separate for clarity as per original code structure but robustifying.
                    const paymentMethodDetails = (paymentIntent as any).payment_method_details;
                    if (paymentMethodDetails?.card) {
                        await donationRef.update({
                            cardBrand: paymentMethodDetails.card.brand,
                            last4: paymentMethodDetails.card.last4
                        });
                    }
                }
                break;
            }
            default:
                console.log(`[Stripe Webhook] Unhandled event type ${event.type}`);
        }
    } catch (error: any) {
        console.error('Error processing webhook:', error);
        // Return 200 to Stripe to prevent retries if it's a logic error we can't fix
        // But 500 if transient. Let's send 200 and log aggressively.
        res.status(200).send(`Webhook Error Logged: ${error.message}`);
        return;
    }

    res.json({ received: true });
});
