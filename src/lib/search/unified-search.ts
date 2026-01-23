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
    // UI Extras
    text?: string;
    speaker?: string;
    date?: string | number | Date;
    content?: string;
    timestamp?: number | Date;
}

export interface UnifiedSearchResults {
    bible: SearchResult[];
    sermons: SearchResult[];
    notes: SearchResult[];
    web?: any[];
    topics?: any[];
    videos?: any[];
}

export class UnifiedSearchService {

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
                (s.title?.toLowerCase() || '').includes(lowerTerm) ||
                (s.summary && s.summary.toLowerCase().includes(lowerTerm)) ||
                (s.outline && Array.isArray(s.outline) && s.outline.some(o => (o || '').toLowerCase().includes(lowerTerm)))
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
                    (n.title?.toLowerCase() || '').includes(term.toLowerCase()) ||
                    (n.content?.toLowerCase() || '').includes(term.toLowerCase())
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

        // 1. Bible Search (Orama) - Increase limit to 50 for better context
        const biblePromise = bibleSearch.search(term, version, { limit: 50 }).then(hits =>
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

        // 4. Web Search (Cloud Function)
        const webPromise = (async () => {
            try {
                // lazy import to avoid build issues if firebase not init
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions();
                const searchFn = httpsCallable(functions, 'search');

                // Standard Web Search
                const res = await searchFn({ query: term }) as any;
                const results = res.data.results || [];

                // Process into visuals (web) and topics
                const web = results.filter((r: any) => r.thumbnail).map((r: any) => ({
                    title: r.title,
                    url: r.thumbnail, // Use thumbnail as the main visual url
                    link: r.link
                }));

                // Simple clustering for topics (mock logic for now or deriving from results)
                const topics = results.slice(0, 3).map((r: any) => ({
                    title: r.title,
                    summary: r.snippet,
                    sources: [{ name: r.displayLink || 'Web', url: r.link }]
                }));

                return { web, topics };
            } catch (err) {
                console.error("Web search error", err);
                return { web: [], topics: [] };
            }
        })();

        // 5. Video Search (Cloud Function)
        const videoPromise = (async () => {
            try {
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions();
                const searchFn = httpsCallable(functions, 'search');

                // Video Search
                const res = await searchFn({ query: term, type: 'video' }) as any;
                console.log("[UnifiedSearch] Video Results:", res.data?.results?.length, res.data?.results);
                return res.data.results || [];
            } catch (err) {
                console.error("Video search error", err);
                return [];
            }
        })();

        const [bible, sermons, notes, webData, videos] = await Promise.all([biblePromise, sermonsPromise, notesPromise, webPromise, videoPromise]);

        return {
            bible,
            sermons,
            notes,
            web: webData.web,
            topics: webData.topics,
            videos
        };
    }
}

export const unifiedSearch = new UnifiedSearchService();
