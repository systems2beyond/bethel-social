import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Trigger: When a new meeting is created in 'meetings/{meetingId}'
export const onMeetingCreated = onDocumentCreated('meetings/{meetingId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return; // No data
    }

    const meetingData = snapshot.data();
    const attendeeUids = meetingData.attendeeUids;

    if (!attendeeUids || !Array.isArray(attendeeUids) || attendeeUids.length === 0) {
        console.log('No attendee UIDs found for meeting:', event.params.meetingId);
        return;
    }

    // Get the creator's name (optional optimization: store creatorName in meeting doc to avoid fetch)
    // For now, let's assume "A new meeting" if not available, or fetch briefly.
    // To keep it fast, we'll just say "You're invited!" or fetch user if critical.
    let creatorName = 'Someone';
    if (meetingData.createdBy) {
        const userSnap = await admin.firestore().collection('users').doc(meetingData.createdBy).get();
        if (userSnap.exists) {
            creatorName = userSnap.data()?.displayName || 'Someone';
        }
    }

    const payload = {
        notification: {
            title: 'New Meeting Invitation',
            body: `${creatorName} invited you to "${meetingData.title || 'a meeting'}"`,
            icon: '/icon.png', // Ensure this exists in public/
            click_action: `/fellowship` // Open the Fellowship page
        },
        data: {
            meetingId: event.params.meetingId,
            url: `/fellowship`
        }
    };

    const tokensToSend: string[] = [];

    // Fetch tokens for all attendees
    // Note: In a real app, use Promise.all or batching.
    for (const uid of attendeeUids) {
        const tokensSnap = await admin.firestore().collection('users').doc(uid).collection('fcmTokens').get();
        tokensSnap.forEach(doc => {
            const token = doc.data().token;
            if (token) tokensToSend.push(token);
        });
    }

    if (tokensToSend.length > 0) {
        // Send Multicast
        const response = await admin.messaging().sendEachForMulticast({
            tokens: tokensToSend,
            notification: payload.notification,
            data: payload.data
        });
        console.log(`Sent ${response.successCount} messages; ${response.failureCount} failed.`);
    } else {
        console.log('No registered FCM tokens found for attendees.');
    }
});
