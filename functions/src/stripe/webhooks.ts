
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

    console.log(`[Stripe Webhook] Received request. Headers: ${JSON.stringify(req.headers)}`);

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
                const { churchId, donorId, campaign, donationAmount, tipAmount, type, donationDocId } = paymentIntent.metadata;

                if (!type) {
                    console.log(`[Stripe Webhook] Warning: Missing 'type' metadata. Metadata: ${JSON.stringify(paymentIntent.metadata)}`);
                }

                if (type === 'donation') {
                    const db = admin.firestore();
                    let donationRef;

                    if (donationDocId) {
                        donationRef = db.collection('donations').doc(donationDocId);
                        const docSnap = await donationRef.get();

                        if (docSnap.exists) {
                            await donationRef.update({
                                status: 'paid',
                                stripePaymentIntentId: paymentIntent.id
                            });
                            console.log(`Updated donation ${donationDocId} to paid`);
                        } else {
                            // Fallback if doc was deleted or not found
                            console.warn(`Pending donation ${donationDocId} not found, creating new record.`);
                            donationRef = db.collection('donations').doc();
                            await donationRef.set({
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
                            });
                        }
                    } else {
                        // Historical fallback (no doc ID in metadata)
                        // Create donation record
                        donationRef = db.collection('donations').doc();
                        await donationRef.set({
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
                        });
                        console.log(`Created new donation record ${donationRef.id} (legacy flow)`);
                    }

                    // donationRef is now guaranteed to be the document we just updated/created
                    const paymentMethodDetails = (paymentIntent as any).payment_method_details;
                    const cardDetails = paymentMethodDetails?.card ? {
                        cardBrand: paymentMethodDetails.card.brand,
                        last4: paymentMethodDetails.card.last4,
                    } : {};

                    await donationRef.update({
                        ...cardDetails,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    const donationDataForWebhook = (await donationRef.get()).data();


                    // Outgoing Webhook to CMS
                    try {
                        const targetChurchId = churchId || 'default_church';
                        const churchDoc = await db.collection('churches').doc(targetChurchId).get();
                        const churchData = churchDoc.data();

                        if (churchData?.webhookUrl) {
                            console.log(`Sending webhook to ${churchData.webhookUrl}`);

                            // Construct payload - convert timestamp to ISO string for portability
                            const payload = {
                                ...donationDataForWebhook,
                                id: donationRef.id,
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
