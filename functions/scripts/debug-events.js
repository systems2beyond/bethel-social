const admin = require('firebase-admin');

// Initialize Firebase
try {
    admin.initializeApp();
} catch (e) {
    console.error('Failed to init admin:', e);
    process.exit(1);
}

const db = admin.firestore();

async function debugEvents() {
    console.log('Querying events...');
    try {
        const snapshot = await db.collection('events').get();
        if (snapshot.empty) {
            console.log('No events found.');
            return;
        }

        console.log(`Found ${snapshot.size} events.`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`\nEvent [${doc.id}]:`);
            console.log(`- Data Keys: ${Object.keys(data).join(', ')}`);

            if (data.startDate) {
                console.log(`- startDate (Raw):`, data.startDate);
                if (data.startDate.toDate) {
                    console.log(`- startDate (Timestamp): ${data.startDate.toDate()}`);
                } else {
                    console.log(`- startDate (Type): ${typeof data.startDate} (Constructor: ${data.startDate.constructor.name})`);
                    console.log(`- startDate (JSON): ${JSON.stringify(data.startDate)}`);
                }
            } else {
                console.log(`- startDate: MISSING`);
                // Check for 'date' field
                if (data.date) {
                    console.log(`- date (Legacy):`, data.date);
                }
            }
        });

    } catch (error) {
        console.error('Error querying events:', error);
    }
}

debugEvents();
