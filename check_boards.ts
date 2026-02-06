
import { db } from './src/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

async function listBoards() {
    console.log('Fetching pipeline boards...');
    try {
        const q = query(collection(db, 'pipelineBoards'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('No boards found.');
        } else {
            console.log(`Found ${snapshot.size} boards:`);
            snapshot.forEach(doc => {
                console.log(`ID: ${doc.id}, Name: ${doc.data().name}, isDefault: ${doc.data().isDefault}`);
            });
        }
    } catch (error) {
        console.error('Error fetching boards:', error);
    }
    process.exit();
}

listBoards();
