import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { sendEmail, EmailSettings } from '../communications/email';

const db = admin.firestore();

async function getEmailSettings(): Promise<EmailSettings | null> {
    const doc = await db.collection('settings').doc('communications').get();
    if (!doc.exists) return null;
    return doc.data() as EmailSettings;
}

// Helper to get users who opted in
// Caution: This scales poorly. For 1000+ users, replace with Pub/Sub or batching.
async function getOptedInEmails(type: 'posts' | 'sermons' | 'messages'): Promise<string[]> {
    const snapshot = await db.collection('users').get();

    return snapshot.docs
        .filter(doc => {
            const data = doc.data();
            if (!data.email) return false;
            const settings = data.notificationSettings;
            // Default to TRUE if setting is undefined
            return !settings || settings[type] !== false;
        })
        .map(doc => doc.data().email);
}

/**
 * Notify Users of New Posts
 */
export const onPostCreated = onDocumentCreated('posts/{postId}', async (event) => {
    const post = event.data?.data();
    if (!post) return;

    // Filter: Only invoke for manually created posts or announcements, prevent loop?
    // And ensure logic is sound.

    console.log(`[Notifications] New Post ${event.params.postId}. Preparing broadcast...`);

    const [settings, emails] = await Promise.all([
        getEmailSettings(),
        getOptedInEmails('posts')
    ]);

    if (!settings) {
        console.log('[Notifications] No SMTP settings found. Skipping post broadcast.');
        return;
    }
    if (emails.length === 0) return;

    try {
        await sendEmail(settings, {
            bcc: emails,
            subject: `New Post from ${post.author?.name || 'Bethel Social'}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>New Post</h2>
                    <p><strong>${post.author?.name || 'Someone'}</strong> just posted:</p>
                    <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #ccc; margin: 20px 0;">
                        ${post.content || '(Media Content)'}
                    </blockquote>
                    ${post.mediaUrl ? `<p><a href="${post.mediaUrl}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Media</a></p>` : ''}
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">
                        <a href="https://bethel-metro-social.web.app/feed">View in App</a> | 
                        <a href="https://bethel-metro-social.web.app/settings/notifications">Manage Notifications</a>
                    </p>
                </div>
            `
        });
        console.log(`[Notifications] Post notification sent to ${emails.length} users.`);
    } catch (err) {
        console.error('[Notifications] Failed to send post broadcast:', err);
    }
});

/**
 * Notify Users of New Sermons
 */
export const onSermonCreated = onDocumentCreated('sermons/{sermonId}', async (event) => {
    const sermon = event.data?.data();
    if (!sermon) return;

    console.log(`[Notifications] New Sermon ${event.params.sermonId}. Preparing broadcast...`);

    const [settings, emails] = await Promise.all([
        getEmailSettings(),
        getOptedInEmails('sermons')
    ]);

    if (!settings) return;
    if (emails.length === 0) return;

    try {
        await sendEmail(settings, {
            bcc: emails,
            subject: `New Sermon: ${sermon.title}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>New Sermon Available</h2>
                    <h3>${sermon.title}</h3>
                    <p>${sermon.summary || ''}</p>
                    <p>
                        <a href="https://bethel-metro-social.web.app/sermons/${event.params.sermonId}" style="display: inline-block; background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Watch Now
                        </a>
                    </p>
                     <p style="margin-top: 20px; color: #666; font-size: 12px;">
                        <a href="https://bethel-metro-social.web.app/settings/notifications">Manage Notifications</a>
                    </p>
                </div>
            `
        });
        console.log(`[Notifications] Sermon notification sent to ${emails.length} users.`);
    } catch (err) {
        console.error('[Notifications] Failed to send sermon broadcast:', err);
    }
});

/**
 * Notify Users of New Messages (DM)
 */
export const onMessageCreated = onDocumentCreated('chats/{chatId}/messages/{msgId}', async (event) => {
    const msg = event.data?.data();
    const chatId = event.params.chatId;
    if (!msg) return;

    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) return;

    // Get settings first
    const settings = await getEmailSettings();
    if (!settings) return;

    const participants = chatDoc.data()?.participants || [];
    const recipients = participants.filter((uid: string) => uid !== msg.senderId);

    for (const userId of recipients) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) continue;

        const userData = userDoc.data();
        if (!userData?.email) continue;

        const notificationSettings = userData.notificationSettings;
        if (notificationSettings && notificationSettings.messages === false) continue;

        try {
            await sendEmail(settings, {
                to: userData.email,
                subject: `New Message from ${msg.senderName || 'User'}`,
                html: `
                    <div style="font-family: sans-serif;">
                        <p><strong>${msg.senderName || 'Someone'}</strong> sent you a message:</p>
                        <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #007bff;">
                            ${msg.content || '(Attachment)'}
                        </blockquote>
                        <p><a href="https://bethel-metro-social.web.app/messages/${chatId}">Reply in App</a></p>
                    </div>
                `
            });
            console.log(`[Notifications] Message notification sent to ${userData.email}`);
        } catch (err) {
            console.error(`[Notifications] Failed to send DM to ${userData.email}:`, err);
        }
    }
});
