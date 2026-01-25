import { collection, query, where, getDocs, limit, orderBy, startAt, endAt } from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
    uid: string;
    displayName: string;
    photoURL?: string;
    email?: string;
    churchId?: string; // [MULTI-CHURCH]
}

export const UsersService = {
    /**
     * Search users by displayName (prefix search)
     * Note: Firestore text search is limited. We use startAt/endAt for prefix matching.
     * Case sensitivity depends on how data is stored.
     */
    searchUsers: async (searchTerm: string): Promise<UserProfile[]> => {
        if (!searchTerm || searchTerm.length < 2) return [];

        const usersRef = collection(db, 'users');
        const results = new Map<string, UserProfile>();

        // 1. Email Search (Partial/Prefix)
        // If it looks like an email part (contains @ or is likely the start of one)
        // We'll perform a prefix search on the email field.
        const emailPromise = (async () => {
            if (searchTerm.includes('@')) {
                const q = query(
                    usersRef,
                    orderBy('email'),
                    startAt(searchTerm),
                    endAt(searchTerm + '\uf8ff'),
                    limit(5)
                );
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(doc => {
                    results.set(doc.id, {
                        uid: doc.id,
                        displayName: doc.data().displayName || 'Unknown',
                        photoURL: doc.data().photoURL,
                        email: doc.data().email
                    });
                });
            }
        })();

        // 2. Name Search (Case-Insensitive Heuristic)
        // Since we don't have a lowercase_name field, we'll try:
        // A. Exact match of search term
        // B. Capitalized match (e.g. "ryan" -> "Ryan")
        const namePromise = (async () => {
            // Helper to fetch and add to results
            const runQuery = async (term: string) => {
                const q = query(
                    usersRef,
                    orderBy('displayName'),
                    startAt(term),
                    endAt(term + '\uf8ff'),
                    limit(5)
                );
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(doc => {
                    if (!results.has(doc.id)) {
                        results.set(doc.id, {
                            uid: doc.id,
                            displayName: doc.data().displayName || 'Unknown',
                            photoURL: doc.data().photoURL,
                            email: doc.data().email
                        });
                    }
                });
            };

            await runQuery(searchTerm);

            // If the search term is all lowercase, try capitalizing the first letter
            // e.g. user types "john", we also search "John"
            if (searchTerm[0] === searchTerm[0].toLowerCase() && searchTerm[0] !== searchTerm[0].toUpperCase()) {
                const capitalized = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
                await runQuery(capitalized);
            }
        })();

        await Promise.all([emailPromise, namePromise]);

        return Array.from(results.values()).slice(0, 10);
    }
};
