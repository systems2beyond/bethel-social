import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

// Initialize admin if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Automates Group Creation when a Ticketed/RSVP Event is created or updated.
 * Trigger: events/{eventId}
 */
export const onEventWritten = onDocumentWritten('events/{eventId}', async (event) => {
    // 1. Check if document was deleted
    if (!event.data?.after.exists) return;

    const eventData = event.data.after.data();
    const eventId = event.params.eventId;

    // 2. Check Conditions for Group Creation
    // - Must have registration enabled
    // - Must NOT already have a linked group
    // - Must NOT be disabled explictly
    // - Must NOT be a draft (optional, but good practice to wait for publish? User didn't specify, safest is "published" or valid config)
    // - Let's do: Registration Enabled AND No Group ID.

    const registrationEnabled = eventData?.registrationConfig?.enabled === true || !!eventData?.ticketConfig;
    const hasGroup = !!eventData?.linkedGroupId;

    console.log(`[EventGroup] Evaluating Event ${eventId}:`, {
        title: eventData?.title,
        registrationConfig: eventData?.registrationConfig,
        ticketConfig: eventData?.ticketConfig,
        registrationEnabled,
        hasGroup,
        willCreate: registrationEnabled && !hasGroup
    });

    if (registrationEnabled && !hasGroup) {
        console.log(`[EventGroup] Event ${eventId} requires a group. Creating...`);

        try {
            // Create Group
            const groupData = {
                name: eventData?.title || 'Event Group',
                description: `Community group for ${eventData?.title}`,
                bannerImage: eventData?.imageUrl || eventData?.media?.[0]?.url || null,
                type: 'community',
                privacy: 'public', // Public for events so people can see posts
                status: 'active',
                tags: ['event'],
                memberCount: 0,
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: eventData?.createdBy || 'system', // Use event creator if available
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                linkedEventId: eventId,
                settings: {
                    postingPermission: 'everyone',
                    invitePermission: 'everyone', // Let anyone invite
                    joinPolicy: 'open' // Auto-join logic handles it, but manual joins should be open
                }
            };

            const groupRef = await db.collection('groups').add(groupData);
            const groupId = groupRef.id;

            console.log(`[EventGroup] Created Group ${groupId} for Event ${eventId}. Linking...`);

            // Link Event to Group (this will trigger this function again, but 'hasGroup' check prevents infinite loop)
            await event.data.after.ref.update({
                linkedGroupId: groupId
            });

        } catch (error) {
            console.error(`[EventGroup] Failed to create group for event ${eventId}:`, error);
        }
    }
});

/**
 * Automates Adding User to Group when they Register.
 * Trigger: events/{eventId}/registrations/{regId}
 */
/**
 * Automates Adding User to Group when they Register.
 * Trigger: events/{eventId}/registrations/{regId}
 * Listens for Writes (Create or Update) to handle payment confirmation updates.
 */
export const onRegistrationCreated = onDocumentWritten('events/{eventId}/registrations/{regId}', async (event) => {
    // 1. Check if document exists (not deleted)
    if (!event.data?.after.exists) return;

    const regData = event.data.after.data();
    // const prevData = event.data.before.exists ? event.data.before.data() : null;
    const eventId = event.params.eventId;

    if (!regData) return;

    // 2. Status Check
    // Only proceed if status is 'confirmed' or 'paid'
    const validStatuses = ['confirmed', 'paid'];
    const isConfirmed = validStatuses.includes(regData.status);
    // const wasConfirmed = prevData ? validStatuses.includes(prevData.status) : false;

    // If not confirmed/paid, OR if it was already confirmed/paid (idempotency/avoid re-runs), skip.
    // However, if the user wasn't in the group for some reason (manual removal?), maybe we should retry?
    // Let's stick to status transition or fresh confirmed creation.
    if (!isConfirmed) {
        // console.log(`[EventGroup] Registration ${event.params.regId} status is '${regData.status}'. Waiting for confirmation.`);
        return;
    }

    // if (wasConfirmed) -> We might want to re-check group membership just in case?
    // For now, let's treat every write in 'confirmed' state as a potential "ensure group membership"
    // But to save reads, maybe only if it wasn't confirmed before?
    // Let's allow re-checks for robustness, checking existence is cheap.

    // 3. User Check
    if (!regData.userId) {
        console.log(`[EventGroup] Registration ${event.params.regId} has no userId. Skipping group addition.`);
        return;
    }

    try {
        // 4. Get Event to find linked Group
        // Optimization: Maybe store linkedGroupId on registration? No, it's on the event.
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return;

        const eventData = eventDoc.data();
        const groupId = eventData?.linkedGroupId;

        if (!groupId) {
            console.log(`[EventGroup] Event ${eventId} has no linked group.`);
            return;
        }

        // 5. Add User to Group
        // Check if already in group
        const memberRef = db.collection('groups').doc(groupId).collection('members').doc(regData.userId);
        const memberDoc = await memberRef.get();

        if (!memberDoc.exists) {
            console.log(`[EventGroup] Adding user ${regData.userId} to group ${groupId} (Status: ${regData.status})`);
            await memberRef.set({
                userId: regData.userId,
                groupId: groupId,
                role: 'member',
                status: 'active',
                joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                user: {
                    displayName: regData.userName || 'Member',
                }
            });

            // Increment member count
            await db.collection('groups').doc(groupId).update({
                memberCount: admin.firestore.FieldValue.increment(1)
            });
        }
    } catch (error) {
        console.error(`[EventGroup] Failed to add user to group:`, error);
    }
});
