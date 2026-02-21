import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * sendPushNotification
 * 
 * Triggers when a new notification document is created.
 * Reads the target user's FCM tokens and sends a push notification
 * to all registered devices. Automatically cleans up invalid tokens.
 */
export const sendPushNotification = onDocumentCreated(
    'notifications/{notificationId}',
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return null;

        const notification = snapshot.data();
        const userId = notification.toUserId;

        if (!userId) {
            console.log('[Push] No toUserId in notification:', event.params.notificationId);
            return null;
        }

        // Get user's FCM tokens from the user document
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        const userData = userDoc.data();
        const tokens: string[] = userData?.fcmTokens || [];

        if (tokens.length === 0) {
            console.log('[Push] No FCM tokens for user:', userId);
            return null;
        }

        // Build notification payload
        const payload: admin.messaging.MulticastMessage = {
            tokens,
            notification: {
                title: notification.title || 'Bethel Social',
                body: notification.message || 'You have a new notification',
            },
            data: {
                type: notification.type || '',
                resourceId: notification.resourceId || '',
                resourceType: notification.resourceType || '',
                ministryId: notification.ministryId || '',
                groupId: notification.groupId || '',
                conversationId: notification.conversationId || '',
                tag: `${notification.type || 'notification'}-${notification.resourceId || event.params.notificationId}`,
            },
            webpush: {
                fcmOptions: {
                    link: getNotificationUrl(notification),
                },
            },
        };

        try {
            // Send to all user's devices
            const response = await admin.messaging().sendEachForMulticast(payload);
            console.log(
                `[Push] Sent to ${userId}: ${response.successCount} success, ${response.failureCount} failed`
            );

            // Remove invalid tokens
            const tokensToRemove: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (
                    !resp.success &&
                    (resp.error?.code === 'messaging/invalid-registration-token' ||
                        resp.error?.code === 'messaging/registration-token-not-registered')
                ) {
                    tokensToRemove.push(tokens[idx]);
                }
            });

            if (tokensToRemove.length > 0) {
                await admin.firestore().collection('users').doc(userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove),
                });
                console.log(`[Push] Removed ${tokensToRemove.length} invalid tokens for user ${userId}`);
            }

            return { success: response.successCount, failure: response.failureCount };
        } catch (error) {
            console.error('[Push] Error sending notification:', error);
            return null;
        }
    }
);

/**
 * Determine the deep-link URL based on notification type
 */
function getNotificationUrl(notification: Record<string, any>): string {
    switch (notification.type) {
        case 'ministry_assignment':
            return '/fellowship?tab=tasks';
        case 'direct_message':
        case 'message':
            return '/fellowship?tab=community';
        case 'group_post':
        case 'group_comment':
            return notification.groupId ? `/groups/${notification.groupId}` : '/groups';
        case 'invitation':
            return '/fellowship?tab=studies';
        case 'event_reminder':
            return notification.eventId ? `/events/${notification.eventId}` : '/events';
        case 'volunteer_schedule':
            return '/admin/ministries';
        default:
            return '/notifications';
    }
}
