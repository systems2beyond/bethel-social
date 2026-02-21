import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { sendEmail, EmailSettings } from '../communications/email';

const db = admin.firestore();

async function getEmailSettings(): Promise<EmailSettings | null> {
    const doc = await db.collection('settings').doc('communications').get();
    if (!doc.exists) return null;
    return doc.data() as EmailSettings;
}

/**
 * Notify User when they are scheduled for a service
 */
export const onVolunteerScheduled = onDocumentCreated('volunteerSchedules/{scheduleId}', async (event) => {
    const schedule = event.data?.data();
    if (!schedule) return;

    // Only notify on initial pending status (or if they are already scheduled)
    // we assume new creations are notifications.
    const userId = schedule.userId;
    const serviceId = schedule.serviceId;
    const ministryId = schedule.ministryId;

    if (!userId || !serviceId) return;

    try {
        // Fetch necessary data
        const [userDoc, serviceDoc, ministryDoc, settings] = await Promise.all([
            db.collection('users').doc(userId).get(),
            db.collection('ministryServices').doc(serviceId).get(),
            ministryId ? db.collection('ministries').doc(ministryId).get() : Promise.resolve(null),
            getEmailSettings()
        ]);

        if (!userDoc.exists || !serviceDoc.exists) return;

        const userData = userDoc.data();
        const serviceData = serviceDoc.data();
        const ministryData = ministryDoc?.exists ? ministryDoc.data() : null;

        if (!userData || !serviceData) return;

        const serviceName = serviceData.name || 'a Service';
        const roleName = schedule.role || 'Volunteer';
        const ministryName = ministryData?.name || 'your Ministry';

        const serviceDateDisplay = serviceData.date?.toDate
            ? serviceData.date.toDate().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
            : 'upcoming date';

        const timeDisplay = serviceData.startTime ? ` at ${serviceData.startTime}` : '';

        // 1. Create In-App Notification
        await db.collection('notifications').add({
            toUserId: userId,
            type: 'volunteer_schedule',
            title: `Schedule Request: ${serviceName}`,
            message: `You have been scheduled as ${roleName} on ${serviceDateDisplay}${timeDisplay}.`,
            resourceId: event.params.scheduleId,
            resourceType: 'volunteerSchedules',
            ministryId: ministryId || '',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Scheduling] In-App notification created for ${userId}`);

        // 2. Send Email Notification
        if (settings && userData.email) {
            // Check if user turned off scheduling emails
            const notificationSettings = userData.notificationSettings;
            if (notificationSettings && notificationSettings.scheduling === false) {
                console.log(`[Scheduling] User ${userId} opted out of scheduling emails.`);
                return;
            }

            // Quick hack for the URL: assuming regular members access the same UI 
            // or we at least send them to the root / if they aren't admins.
            // Ideally we'd have a non-admin dashboard for this, but pointing them to the app works.
            const appUrl = 'https://bethel-metro-social.web.app/admin/ministries';

            await sendEmail(settings, {
                to: userData.email,
                subject: `Serving Request: ${serviceName}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #059669;">Volunteer Schedule Request</h2>
                        <p>Hi ${userData.firstName || 'there'},</p>
                        <p>You have been scheduled to serve with <strong>${ministryName}</strong>.</p>
                        
                        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0;">
                            <h3 style="margin-top: 0; margin-bottom: 8px;">${serviceName}</h3>
                            <p style="margin: 0 0 4px 0;"><strong>Role:</strong> ${roleName}</p>
                            <p style="margin: 0 0 4px 0;"><strong>Date:</strong> ${serviceDateDisplay}</p>
                            <p style="margin: 0 0 0 0;"><strong>Time:</strong> ${serviceData.startTime || 'TBD'} - ${serviceData.endTime || 'TBD'}</p>
                        </div>

                        <p>Please log in to accept or decline this request so your leader knows if you are available.</p>
                        
                        <div style="margin: 32px 0;">
                            <a href="${appUrl}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                                View and Respond to Schedule
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                            You are receiving this because you are part of the ${ministryName} team at Bethel Social.<br>
                            <a href="https://bethel-metro-social.web.app/settings/notifications" style="color: #6b7280;">Manage Notification Preferences</a>
                        </p>
                    </div>
                `
            });
            console.log(`[Scheduling] Email sent to ${userData.email}`);
        }

    } catch (err) {
        console.error('[Scheduling] Failed to process scheduling notification:', err);
    }
});
