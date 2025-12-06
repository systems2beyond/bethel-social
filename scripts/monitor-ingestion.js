const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin with ADC
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'bethel-metro-social'
    });
}

const db = getFirestore();

async function monitorProgress() {
    console.log('Initializing monitor...');

    // Get total posts count
    const postsSnapshot = await db.collection('posts').count().get();
    const totalPosts = postsSnapshot.data().count;

    // Start time: Look for chunks created/updated in the last 15 minutes
    // (Since we just triggered the backfill)
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 15);

    console.log(`Tracking ingestion for ${totalPosts} posts...`);
    console.log(`Looking for updates since: ${startTime.toLocaleTimeString()}`);

    const progressBarWidth = 40;

    const timer = setInterval(async () => {
        try {
            // Count completed chunks (recent createdAt)
            const completedSnapshot = await db.collection('sermon_chunks')
                .where('createdAt', '>', startTime)
                .count()
                .get();

            const completed = completedSnapshot.data().count;
            const percent = Math.min(100, Math.round((completed / totalPosts) * 100));

            // Render progress bar
            const filledWidth = Math.round((progressBarWidth * percent) / 100);
            const emptyWidth = progressBarWidth - filledWidth;
            const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);

            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`Progress: [${bar}] ${percent}% (${completed}/${totalPosts})`);

            if (completed >= totalPosts) {
                console.log('\n\n✅ Ingestion Complete!');
                clearInterval(timer);
                process.exit(0);
            }
        } catch (e) {
            console.error('\nError monitoring progress:', e);
            clearInterval(timer);
            process.exit(1);
        }
    }, 2000); // Update every 2 seconds
}

monitorProgress();
