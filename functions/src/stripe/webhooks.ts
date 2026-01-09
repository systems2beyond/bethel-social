
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

    const db = admin.firestore();

    try {
        switch (event.type) {
            case 'account.updated': {
                const account = event.data.object as Stripe.Account;
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
            case 'capability.updated': {
                // Additional logic if needed
                break;
            }
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                const { churchId, donorId, campaign, donationAmount, tipAmount, type } = paymentIntent.metadata;

                if (type === 'donation') {
                    // Create donation record
                    const donationData = {
                        churchId: churchId || 'default_church',
                        donorId: donorId || 'anonymous',
                        amount: parseFloat(donationAmount),
                        tipAmount: parseFloat(tipAmount),
                        totalAmount: paymentIntent.amount / 100,
                        amountCents: paymentIntent.amount,
                        campaign: campaign || 'General Fund',
                        status: 'paid',
                        stripePaymentIntentId: paymentIntent.id,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    await db.collection('donations').add(donationData);
                    console.log(`Recorded donation ${paymentIntent.id} for ${campaign}`);

                    // Outgoing Webhook to CMS
                    try {
                        const targetChurchId = churchId || 'default_church';
                        const churchDoc = await db.collection('churches').doc(targetChurchId).get();
                        const churchData = churchDoc.data();

                        if (churchData?.webhookUrl) {
                            console.log(`Sending webhook to ${churchData.webhookUrl}`);

                            // Construct payload - convert timestamp to ISO string for portability
                            const payload = {
                                ...donationData,
                                createdAt: new Date().toISOString(), // Approximate match
                                eventType: 'donation.created',
                                paymentMethod: 'card' // Simplified
                            };

                            const response = await fetch(churchData.webhookUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'User-Agent': 'BethelSocial/1.0'
                                },
                                body: JSON.stringify(payload)
                            });

                            if (!response.ok) {
                                console.error(`CMS Webhook failed: ${response.status} ${response.statusText}`);
                            } else {
                                console.log('CMS Webhook sent successfully');
                            }
                        }
                    } catch (webhookError) {
                        console.error('Error sending CMS webhook:', webhookError);
                        // Do not fail the request if webhook fails, just log it
                    }
                }
                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal Server Error');
        return;
    }

    res.json({ received: true });
});
