const { initializeApp: initClient, deleteApp } = require('firebase/app');
const { getAuth, signInAnonymously, signOut } = require('firebase/auth');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Client Config (Public)
const clientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

async function testSecurityRules() {
    console.log('🔒 Starting Security Rules Test (Anonymous Auth)...\n');

    // 1. Initialize Client App
    const clientApp = initClient(clientConfig, 'clientApp');
    const auth = getAuth(clientApp);
    const db = getFirestore(clientApp);

    try {
        // --- TEST CASE 1: User A accessing User A's data (Should SUCCEED) ---
        console.log('\n[Test 1] User A accessing their own data...');
        const userACred = await signInAnonymously(auth);
        const userA_UID = userACred.user.uid;
        console.log(`User A signed in: ${userA_UID}`);

        const userADocRef = doc(db, 'users', userA_UID);
        const userAChatRef = doc(db, 'users', userA_UID, 'chats', 'chat1');

        try {
            await setDoc(userADocRef, { name: 'User A', createdAt: new Date() });
            console.log('✅ WRITE SUCCESS: User A wrote to users/' + userA_UID);
        } catch (e) {
            console.error('❌ WRITE FAILED: User A could not write to own profile', e.message);
        }

        try {
            await setDoc(userAChatRef, { title: 'My Chat' });
            console.log('✅ WRITE SUCCESS: User A wrote to users/' + userA_UID + '/chats/chat1');
        } catch (e) {
            console.error('❌ WRITE FAILED: User A could not write to own chat', e.message);
        }

        // --- TEST CASE 2: User B accessing User A's data (Should FAIL) ---
        console.log('\n[Test 2] User B accessing User A\'s data...');
        await signOut(auth);

        const userBCred = await signInAnonymously(auth);
        const userB_UID = userBCred.user.uid;
        console.log(`User B signed in: ${userB_UID}`);

        try {
            await getDoc(userADocRef);
            console.error('❌ READ FAILED: User B was ABLE to read User A\'s profile (Should have been denied)');
        } catch (e) {
            if (e.code === 'permission-denied') {
                console.log('✅ READ DENIED: User B cannot read users/' + userA_UID);
            } else {
                console.error('❓ UNEXPECTED ERROR:', e);
            }
        }

        try {
            await setDoc(userAChatRef, { title: 'Hacked Chat' });
            console.error('❌ WRITE FAILED: User B was ABLE to write to User A\'s chat (Should have been denied)');
        } catch (e) {
            if (e.code === 'permission-denied') {
                console.log('✅ WRITE DENIED: User B cannot write to users/' + userA_UID + '/chats/chat1');
            } else {
                console.error('❓ UNEXPECTED ERROR:', e);
            }
        }

        // --- TEST CASE 3: User B accessing User B's data (Should SUCCEED) ---
        console.log('\n[Test 3] User B accessing their own data...');
        const userBDocRef = doc(db, 'users', userB_UID);
        try {
            await setDoc(userBDocRef, { name: 'User B' });
            console.log('✅ WRITE SUCCESS: User B wrote to users/' + userB_UID);
        } catch (e) {
            console.error('❌ WRITE FAILED: User B could not write to own profile', e.message);
        }

    } catch (error) {
        console.error('Test Suite Error:', error);
    } finally {
        // Cleanup
        console.log('\nCleaning up...');
        await deleteApp(clientApp);
        console.log('Done.');
        process.exit(0);
    }
}

testSecurityRules();
