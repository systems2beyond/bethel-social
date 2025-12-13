import { create, insertMultiple, search, Orama, TypedDocument } from '@orama/orama';
import { stemmer } from '@orama/stemmers/english';

export type BibleVersion = 'kjv' | 'web' | string;

const schema = {
    book: 'string',
    chapter: 'number',
    verse: 'number',
    text: 'string',
    version: 'string',
} as const;

type BibleDoc = TypedDocument<Orama<typeof schema>>;

// Internal structure of our JSONs
interface BibleJsonBook {
    name: string;
    abbrev?: string;
    chapters: string[][]; // array of chapters, each containing array of verse strings
}

class BibleSearchService {
    private indexes: Map<string, Orama<any>> = new Map();
    private loadPromises: Map<string, Promise<void>> = new Map();
    private customSources: Map<string, string> = new Map();

    private async createIndex(version: string): Promise<Orama<any>> {
        return create({
            schema,
            components: {
                tokenizer: {
                    stemming: true,
                    stemmer: stemmer
                }
            }
        });
    }

    async loadVersion(version: string, customUrl?: string) {
        if (this.indexes.has(version)) return;
        if (this.loadPromises.has(version)) return this.loadPromises.get(version);

        const loadTask = async () => {
            console.time(`idx-${version}`);
            try {
                let data: BibleJsonBook[];

                if (version === 'custom' || customUrl) {
                    const url = customUrl || this.customSources.get('custom');
                    if (!url) throw new Error('No custom source URL provided');

                    const res = await fetch(url);
                    if (!res.ok) throw new Error('Failed to fetch custom source');
                    data = await res.json();
                } else {
                    // Dynamic import based on version to split bundles
                    // Note: This relies on build tool (Next.js/Webpack) handling dynamic imports of JSON
                    // We might need to fetch from public/ if imports are too heavy
                    // For now, let's try assuming they are in public/data/bible/ or imported
                    // IMPORTANT: Dynamic import of large JSONs can be slow.
                    // Better to fetch() them if they are in /public.

                    // Let's assume we moved the JSONs to public/data/bible/
                    const res = await fetch(`/data/bible/${version}.json`);
                    if (!res.ok) throw new Error(`Version ${version} not found`);
                    data = await res.json();
                }

                const db = await this.createIndex(version);
                const documents: any[] = []; // Orama insertMultiple takes loosely typed docs

                data.forEach((book) => {
                    book.chapters.forEach((verses, cIndex) => {
                        verses.forEach((text, vIndex) => {
                            documents.push({
                                book: book.name,
                                chapter: cIndex + 1,
                                verse: vIndex + 1,
                                text: text,
                                version: version
                            });
                        });
                    });
                });

                // Batch insert for performance
                await insertMultiple(db, documents, 5000); // 5000 batch size
                this.indexes.set(version, db);
                console.timeEnd(`idx-${version}`);

            } catch (e) {
                console.error(`Failed to load version ${version}:`, e);
                this.loadPromises.delete(version);
                throw e; // Propagate error
            }
        };

        const promise = loadTask();
        this.loadPromises.set(version, promise);
        await promise;
    }

    async search(query: string, version: string = 'kjv', options: { limit?: number, threshold?: number } = {}) {
        await this.loadVersion(version);
        const db = this.indexes.get(version);
        if (!db) return []; // Should not happen

        const results = await search(db, {
            term: query,
            limit: options.limit || 10,
            tolerance: 1, // Typo tolerance
            threshold: options.threshold || 0,
            properties: ['text', 'book'], // Search in text and book name
            boost: {
                book: 2 // Boost book name matches
            }
        });

        return results.hits.map(hit => ({
            ...(hit.document as any), // Cast to any or helper type
            score: hit.score
        }));
    }

    // Helper to add a user-defined source
    async registerCustomSource(name: string, url: string) {
        this.customSources.set(name, url);
        // Force reload if exists
        this.indexes.delete(name);
        this.loadPromises.delete(name);
        await this.loadVersion(name, url);
        return true;
    }

    hasCustomSource(): boolean {
        return this.customSources.has('custom');
    }
    /**
     * Get search history from localStorage
     */
    getSearchHistory(): string[] {
        if (typeof window === 'undefined') return [];
        try {
            const history = localStorage.getItem('bible_search_history');
            return history ? JSON.parse(history) : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Save a search term to history (max 5 items)
     */
    saveSearchToHistory(term: string) {
        if (typeof window === 'undefined' || !term.trim()) return;
        try {
            let history = this.getSearchHistory();
            // Remove if exists to push to top
            history = history.filter(h => h.toLowerCase() !== term.toLowerCase());
            // Add to front
            history.unshift(term.trim());
            // Keep max 5
            history = history.slice(0, 5);
            localStorage.setItem('bible_search_history', JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save search history', e);
        }
    }
}

export const bibleSearch = new BibleSearchService();
