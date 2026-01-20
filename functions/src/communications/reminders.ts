
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { sendEmail, EmailSettings } from './email';

/**
 * Runs every hour to check for events starting in the next 24 (23.5-24.5) hours 
 * that haven't had a reminder sent yet.
 */
export const scheduleEventReminders = onSchedule({
    schedule: 'every 1 hours',
}, async (event) => {
    // 0. Fetch Global Settings (Tenant-aware in future)
    const settingsDoc = await admin.firestore().collection('settings').doc('communications').get();
    const settings = settingsDoc.exists ? (settingsDoc.data() as EmailSettings) : null;

    if (!settings) {
        console.warn('Skipping Valid Reminders: No SMTP Settings Configured.');
        // We do typically CONTINUE here in case we want to mark them as 'skipped' or just retry next hour?
        // Actually if we return, they will be retried next hour. If settings are still missing, we loop.
    }

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowStart = new Date(twentyFourHoursFromNow.getTime() - 30 * 60 * 1000); // 23.5h
    const windowEnd = new Date(twentyFourHoursFromNow.getTime() + 30 * 60 * 1000);   // 24.5h

    try {
        // Query events starting in the window that haven't sent reminders
        const eventsSnap = await admin.firestore().collection('events')
            .where('startDate', '>=', windowStart)
            .where('startDate', '<=', windowEnd)
            .where('remindersSent', '!=', true) // Relies on index or missing field
            .get();

        if (eventsSnap.empty) {
            console.log('No upcoming events needing reminders.');
            return;
        }

        for (const eventDoc of eventsSnap.docs) {
            const eventData = eventDoc.data();

            // Double check to be safe (idempotency)
            if (eventData.remindersSent) continue;

            console.log(`Sending reminders for event: ${eventData.title} (${eventDoc.id})`);

            // Fetch registrations
            const registrationsSnap = await eventDoc.ref.collection('registrations')
                // .where('status', '==', 'confirmed') // Optional: only confirmed?
                .get();

            if (registrationsSnap.empty) {
                console.log(`No registrations for event ${eventDoc.id}`);
                // Mark as sent anyway so we don't retry forever? 
                // Yes, or we might miss late registers. But this is a "24h ahead" one-time blast.
                await eventDoc.ref.update({ remindersSent: true });
                continue;
            }

            const emailSubject = `Reminder: ${eventData.title} is tomorrow!`;
            // Simple text template
            const emailBody = `Hi there,\n\nThis is a friendly reminder that "${eventData.title}" is coming up tomorrow at ${eventData.startTime}.\n\nLocation: ${eventData.location}\n\nWe look forward to seeing you!\n\nView details: https://bethel-social.web.app/events/${eventDoc.id}`;

            const emailPromises = registrationsSnap.docs.map(regDoc => {
                const reg = regDoc.data();
                if (!reg.userEmail) return Promise.resolve();

                return sendEmail(settings, {
                    to: reg.userEmail,
                    subject: emailSubject,
                    text: emailBody,
                }).catch(err => {
                    console.error(`Failed to send reminder to ${reg.userEmail}`, err);
                    return null;
                });
            });

            await Promise.all(emailPromises);

            // Mark event as processed
            await eventDoc.ref.update({
                remindersSent: true,
                remindersSentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Reminders sent for ${eventDoc.id}`);
        }

    } catch (error) {
        console.error('Error in scheduleEventReminders:', error);
    }
});
