import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

// Ensure admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Saves an event (create or update) via server-side execution.
 * This bypasses client-side ad-blockers that might block firestore.googleapis.com
 */
export const saveEvent = onRequest({ cors: true }, async (req, res) => {
    try {
        // 1. Validate Method
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        // 2. Validate Auth Token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing token' });
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];
        try {
            await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }

        // 3. Authorization Check (Optional: Check custom claims like 'admin')
        // For now, we assume any authenticated user can create events (or check decodedToken.admin)
        // const isUnknownUser = !decodedToken.email; // Basic check

        // 4. Extract Data
        const { event, eventId } = req.body;
        if (!event) {
            res.status(400).json({ error: 'Missing event data' });
            return;
        }

        // 5. Perform Database Operation
        const db = admin.firestore();
        const collectionRef = db.collection('events');

        // Add timestamp if creating, or update updatedAt
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // Helper to convert strings or objects to Timestamps
        const toTimestamp = (val: any) => {
            if (!val) return null;
            if (typeof val === 'string') return admin.firestore.Timestamp.fromDate(new Date(val));
            if (typeof val === 'object' && typeof val.seconds === 'number') {
                return new admin.firestore.Timestamp(val.seconds, val.nanoseconds || 0);
            }
            return val;
        };

        const eventData = {
            ...event,
            updatedAt: timestamp,
        };

        if (eventData.startDate) eventData.startDate = toTimestamp(eventData.startDate);
        if (eventData.endDate) eventData.endDate = toTimestamp(eventData.endDate);

        if (!eventId) {
            // CREATE
            eventData.createdAt = timestamp;
            const docRef = await collectionRef.add(eventData);
            res.status(200).json({ success: true, id: docRef.id, message: 'Event created successfully' });
        } else {
            // UPDATE
            await collectionRef.doc(eventId).set(eventData, { merge: true });
            res.status(200).json({ success: true, id: eventId, message: 'Event updated successfully' });
        }

    } catch (error: any) {
        console.error('Error in saveEvent:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});
