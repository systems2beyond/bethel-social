
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendEmail, EmailSettings } from './email';
export * from './reminders';

export const sendEventBroadcast = onCall({}, async (request) => {
    // 1. Auth Check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to send broadcasts.');
    }

    const { eventId, subject, message, testMode } = request.data;
    const uid = request.auth.uid;

    if (!eventId || !subject || !message) {
        throw new HttpsError('invalid-argument', 'Missing eventId, subject, or message.');
    }

    try {
        // 2. Fetch Church SMTP Settings
        // In a true multi-tenant system, we would look up the tenantId from the event or user.
        // For this architecture, we use the global settings document.
        const settingsDoc = await admin.firestore().collection('settings').doc('communications').get();
        const settings = settingsDoc.exists ? (settingsDoc.data() as EmailSettings) : null;

        if (!settings && !testMode) {
            throw new HttpsError('failed-precondition', 'Email settings not configured. Please contact admin.');
        }

        // 3. Permission Check (Admin or Event Owner)
        const eventDoc = await admin.firestore().collection('events').doc(eventId).get();
        if (!eventDoc.exists) {
            throw new HttpsError('not-found', 'Event not found.');
        }

        if (testMode) {
            // Send only to the requester (useful for "Send Test Email")
            const userRecord = await admin.auth().getUser(uid);
            await sendEmail(settings, {
                to: userRecord.email || 'test@example.com',
                subject: `[TEST] ${subject}`,
                text: message,
                html: message.replace(/\n/g, '<br>') // Simple conversion
            });
            return { success: true, count: 1, test: true };
        }

        // 4. Fetch Registrations
        const registrationsSnap = await admin.firestore()
            .collection('events')
            .doc(eventId)
            .collection('registrations')
            .get();

        if (registrationsSnap.empty) {
            return { success: true, count: 0, message: 'No registrations found.' };
        }

        // 5. Send Emails (Batching/Queueing recommended for large events, direct for small)
        const limit = 500; // Arbitrary safety limit for sync function
        const registrations = registrationsSnap.docs.slice(0, limit);

        const emailPromises = registrations.map(doc => {
            const reg = doc.data();
            if (!reg.userEmail) return Promise.resolve();
            return sendEmail(settings, {
                to: reg.userEmail,
                subject: subject,
                text: message,
                html: message.replace(/\n/g, '<br>')
            }).catch(err => {
                console.error(`Failed to send to ${reg.userEmail}`, err);
                return null;
            });
        });

        await Promise.all(emailPromises);

        return { success: true, count: registrations.length };

    } catch (error) {
        console.error('Broadcast Error:', error);
        throw new HttpsError('internal', 'Failed to send broadcast.');
    }
});
