import { bibleSearch } from './bible-index';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, limit, orderBy } from 'firebase/firestore';
import { Sermon } from '@/types';

export interface SearchResult {
    id: string;
    type: 'bible' | 'sermon' | 'note';
    title: string;
    subtitle?: string;
    description?: string; // snippets
    url?: string; // for navigation
    metadata?: any;
    score?: number;
}

export interface UnifiedSearchResults {
    bible: SearchResult[];
    sermons: SearchResult[];
    notes: SearchResult[];
}

class UnifiedSearchService {

    // Cache for Sermon Metadata (Title, ID, Description, Date)
    // We don't want to re-fetch this on every keystroke
    private sermonCache: Sermon[] | null = null;
    private sermonCacheTimestamp: number = 0;
    private CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

    private async getSermons(): Promise<Sermon[]> {
        const now = Date.now();
        if (this.sermonCache && (now - this.sermonCacheTimestamp < this.CACHE_DURATION)) {
            return this.sermonCache;
        }

        try {
            const q = query(collection(db, 'sermons'), orderBy('date', 'desc'), limit(100)); // Limit for perf
            const snap = await getDocs(q);
            this.sermonCache = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sermon));
            this.sermonCacheTimestamp = now;
            return this.sermonCache;
        } catch (e) {
            console.error("Failed to fetch sermons for index", e);
            return [];
        }
    }

    private async searchSermons(term: string): Promise<SearchResult[]> {
        const sermons = await this.getSermons();
        const lowerTerm = term.toLowerCase();

        return sermons
            .filter(s =>
                s.title.toLowerCase().includes(lowerTerm) ||
                (s.summary && s.summary.toLowerCase().includes(lowerTerm)) ||
                (s.outline && s.outline.some(o => o.toLowerCase().includes(lowerTerm)))
            )
            .slice(0, 3) // Top 3
            .map(s => ({
                id: s.id,
                type: 'sermon',
                title: s.title,
                subtitle: s.date ? (typeof s.date === 'string' ? s.date : new Date(s.date.seconds * 1000).toLocaleDateString()) : undefined,
                description: s.summary,
                metadata: s
            }));
    }

    private async searchNotes(term: string, userId: string): Promise<SearchResult[]> {
        if (!userId) return [];
        // Searching Firestore strings startsWith is easy, 'includes' is hard/impossible without full text search like Algolia.
        // For "Raycast feel" on small datasets, we can fetch user's recent notes.
        // Assuming user has < 100 notes, we can fetch all metadata and filter client-side.

        try {
            const notesRef = collection(db, 'users', userId, 'notes');
            // Fetch validation needs index, so keep it simple for now: fetch recent modified
            const q = query(notesRef, limit(50));
            const snap = await getDocs(q);

            return snap.docs
                .map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        type: 'note' as const,
                        title: data.title || 'Untitled Note',
                        subtitle: 'Personal Note',
                        description: data.content?.substring(0, 100), // Snippet
                        content: data.content || '',
                        metadata: data
                    };
                })
                .filter(n =>
                    n.title.toLowerCase().includes(term.toLowerCase()) ||
                    n.content.toLowerCase().includes(term.toLowerCase())
                )
                .slice(0, 3)
                .map(({ content, ...rest }) => rest); // Remove full content from result

        } catch (e) {
            console.error("Failed to search notes", e);
            return [];
        }
    }

    async search(term: string, userId?: string, version: string = 'kjv'): Promise<UnifiedSearchResults> {
        if (!term.trim()) return { bible: [], sermons: [], notes: [] };

        // 1. Bible Search (Orama)
        const biblePromise = bibleSearch.search(term, version, { limit: 5 }).then(hits =>
            hits.map(h => ({
                id: `${h.book}-${h.chapter}-${h.verse}`,
                type: 'bible' as const,
                title: `${h.book} ${h.chapter}:${h.verse}`,
                subtitle: h.text, // Full text as subtitle or desc
                description: h.text,
                metadata: h
            }))
        );

        // 2. Sermons
        const sermonsPromise = this.searchSermons(term);

        // 3. User Notes
        const notesPromise = userId ? this.searchNotes(term, userId) : Promise.resolve([]);

        const [bible, sermons, notes] = await Promise.all([biblePromise, sermonsPromise, notesPromise]);

        return { bible, sermons, notes };
    }
}

export const unifiedSearch = new UnifiedSearchService();
