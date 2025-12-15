import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

// Ensure Firebase Admin is initialized (shared instance)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Initialize Google Auth
const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/meetings.space.created']
});

export const createMeeting = onCall({ timeoutSeconds: 60 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to schedule a meeting.');
    }

    try {
        const { topic, startTime, requestId, attendees, description } = request.data;
        const startDateTime = new Date(startTime).toISOString();
        const endDateTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(); // Default 1h

        let meetLink = '';
        let eventId = '';

        try {
            const client = await auth.getClient();
            const calendar = google.calendar({ version: 'v3', auth: client as any });

            // Basic HTML strip for description context (Note: Google Calendar description supports limited HTML, but safer to be clean or raw)
            // For now, we'll prefix it.
            let finalDescription = '';
            if (description) {
                // Simple regex strip (not perfect but decent for context)
                const stripped = description.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();
                finalDescription = `\n\n--- Meeting Context (Notes) ---\n${stripped}`;
            }

            const eventBody: any = {
                summary: topic || 'New Meeting',
                description: finalDescription,
                start: { dateTime: startDateTime },
                end: { dateTime: endDateTime },
                conferenceData: {
                    createRequest: {
                        requestId: requestId || Math.random().toString(36),
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            };

            // Add attendees if present
            if (attendees && Array.isArray(attendees) && attendees.length > 0) {
                eventBody.attendees = attendees.map((email: string) => ({ email: email.trim() }));
            }

            const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: eventBody,
                conferenceDataVersion: 1,
                sendUpdates: 'all' // CRITICAL: This triggers Google to send email invitations
            });

            meetLink = res.data.hangoutLink || '';
            eventId = res.data.id || '';
            console.log('Google Calendar Event Created:', eventId, meetLink);

        } catch (calError: any) {
            console.warn('Google Calendar API failed (Service Account Limit likely):', calError.message);
            // Fallback: Generate a placeholder or generic link since Service Accounts often lack Meet License
            meetLink = 'https://meet.google.com/lookup/bethel-' + Math.random().toString(36).substring(7);
            eventId = 'manual-' + Date.now();
        }

        // PERSISTENCE: Save to Firestore 'meetings' collection
        // This ensures it shows up on the Events Page
        const meetingDoc = {
            title: topic || 'New Meeting',
            date: startDateTime,
            meetLink: meetLink,
            eventId: eventId,
            type: 'general', // Default category
            createdBy: request.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('meetings').add(meetingDoc);

        return {
            meetingId: docRef.id,
            meetLink: meetLink,
            success: true
        };

    } catch (error: any) {
        console.error('Error creating meeting:', error);
        throw new HttpsError('internal', 'Failed to create meeting: ' + error.message);
    }
});
