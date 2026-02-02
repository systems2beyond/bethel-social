import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Resolves the Church ID based on the current window hostname (subdomain).
 * 
 * Logic:
 * 1. Parse hostname (e.g. "bethel.myapp.com" -> "bethel")
 * 2. Query 'churches' collection where 'subdomain' == parsed_subdomain
 * 3. Return church ID if found.
 * 
 * Fallback:
 * - If localhost, defaults to 'default_church' (or env var) for dev convenience.
 * - If not found, returns null (should block signup or show error).
 */
export async function resolveChurchIdFromHostname(hostname: string): Promise<string | null> {

    // 1. Handle Development / Localhost
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        console.log('[Tenant] Development environment detected. Defaulting to: default_church');
        return process.env.NEXT_PUBLIC_DEV_DEFAULT_CHURCH_ID || 'default_church';
    }

    // 2. Extract Subdomain
    // Assumption: Format is [subdomain].domain.com
    // So parts[0] is subdomain.
    const parts = hostname.split('.');

    // Safety check for bare domains or www
    if (parts.length < 3 || parts[0] === 'www') {
        // This is likely the main marketing site or invalid.
        return null;
    }

    const subdomain = parts[0];

    // [FIX] Explicit mapping for the main Netlify deployment
    if (subdomain === 'bethel-metro-social') {
        return 'bethel-metro';
    }

    // 3. Query Firestore
    try {
        const q = query(
            collection(db, 'churches'),
            where('subdomain', '==', subdomain),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }
    } catch (error) {
        console.error('[Tenant] Error resolving church from subdomain:', error);
    }

    return null;
}
