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

const BIBLE_BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const getBookOrder = (book: string) => {
    const norm = book.toLowerCase().replace(/\./g, '');
    const idx = BIBLE_BOOKS.findIndex(b => b.toLowerCase().startsWith(norm));
    if (idx !== -1) return idx;
    // Fallback for partial matches if needed, otherwise strict
    return 999;
};

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
                    const res = await fetch(`/data/bible/${version}.json`);
                    if (!res.ok) throw new Error(`Version ${version} not found`);
                    data = await res.json();
                }

                const db = await this.createIndex(version);
                const documents: any[] = [];

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

                await insertMultiple(db, documents, 5000);
                this.indexes.set(version, db);
                console.timeEnd(`idx-${version}`);

            } catch (e) {
                console.error(`Failed to load version ${version}:`, e);
                this.loadPromises.delete(version);
                throw e;
            }
        };

        const promise = loadTask();
        this.loadPromises.set(version, promise);
        await promise;
    }

    async search(query: string, version: string = 'kjv', options: { limit?: number, threshold?: number } = {}) {
        await this.loadVersion(version);
        const db = this.indexes.get(version);
        if (!db) return [];

        const trimmed = query.trim();

        // Regex Definitions
        // 1. Cross-Chapter Range: "Proverbs 1:6-5:2" -> Book, C1, V1, C2, V2
        const rangeCrossRegex = /^((?:\d\s*)?[a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s+(\d+):(\d+)\s*-\s*(\d+):(\d+)$/;

        // 2. Same-Chapter Range: "John 3:16-18" -> Book, C1, V1, V2
        const rangeSameRegex = /^((?:\d\s*)?[a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s+(\d+):(\d+)\s*-\s*(\d+)$/;

        // 3. Single Ref: "John 3:16" or "John 3"
        const refRegex = /^((?:\d\s*)?[a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s+(\d+)(?::(\d+))?$/;

        let results;
        let hits: any[] = [];

        const matchCross = trimmed.match(rangeCrossRegex);
        const matchSame = trimmed.match(rangeSameRegex);
        const matchRef = trimmed.match(refRegex);

        const searchBook = async (bookName: string) => {
            return search(db, {
                term: bookName,
                properties: ['book'],
                limit: 10000,
                threshold: 0.2
            });
        };

        if (matchCross) {
            const [_, bookName, c1, v1, c2, v2] = matchCross;
            const startC = parseInt(c1), startV = parseInt(v1);
            const endC = parseInt(c2), endV = parseInt(v2);

            results = await searchBook(bookName);
            hits = results.hits.map(h => h.document).filter((doc: any) => {
                // Check Chapter Bounds
                if (doc.chapter < startC || doc.chapter > endC) return false;
                // Check Verse Bounds
                if (doc.chapter === startC && doc.verse < startV) return false;
                if (doc.chapter === endC && doc.verse > endV) return false;
                return true;
            });

        } else if (matchSame) {
            const [_, bookName, c1, v1, v2] = matchSame;
            const chapter = parseInt(c1);
            const startV = parseInt(v1), endV = parseInt(v2);

            results = await searchBook(bookName);
            hits = results.hits.map(h => h.document).filter((doc: any) => {
                if (doc.chapter !== chapter) return false;
                if (doc.verse < startV || doc.verse > endV) return false;
                return true;
            });

        } else if (matchRef) {
            const [_, bookName, c1, v1] = matchRef;
            const chapter = parseInt(c1);
            const verse = v1 ? parseInt(v1) : undefined;

            results = await searchBook(bookName);
            hits = results.hits.map(h => h.document).filter((doc: any) => {
                if (doc.chapter !== chapter) return false;
                if (verse && doc.verse !== verse) return false;
                return true;
            });
            // Cap single reference searches slightly to avoid spamming "Verse 1" of every book if fuzzy match behaves loosely
            // But strict filtering above should handle it.

        } else {
            // Full Text Search
            results = await search(db, {
                term: trimmed,
                limit: options.limit || 50, // Increased limit to allow sorting to work better
                tolerance: 1,
                threshold: options.threshold || 0,
                properties: ['text', 'book'],
                boost: { book: 2 }
            });
            hits = results.hits.map(h => ({ ...h.document as any, score: h.score }));
        }

        // --- GLOBAL SORTING ---
        // Always return canonical order: Book -> Chapter -> Verse
        hits.sort((a, b) => {
            const orderA = getBookOrder(a.book);
            const orderB = getBookOrder(b.book);
            if (orderA !== orderB) return orderA - orderB;
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            return a.verse - b.verse;
        });

        // Add score back if needed, currently mapping hits returns objects.
        // If it was a text search, relevance might be important, BUT user complained about order.
        // Compromise: For specific text searches (not refs), maybe we should preserve relevance?
        // User said: "Proverbs 1:1, 25:1..." -> specific complaint about a BOOK search ("Proverbs") returning weird order.
        // If they search "Love", maybe they want relevance?
        // But usually Bible apps list "Genesis x:y" before "Revelation x:y" even for keyword searches.
        // I will stick to Canonical Sort for now as it feels "safer" for a Bible app.

        return hits.map(h => ({
            ...h,
            score: h.score || 1.0
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

    getSearchHistory(): string[] {
        if (typeof window === 'undefined') return [];
        try {
            const history = localStorage.getItem('bible_search_history');
            return history ? JSON.parse(history) : [];
        } catch (e) {
            return [];
        }
    }

    saveSearchToHistory(term: string) {
        if (typeof window === 'undefined' || !term.trim()) return;
        try {
            let history = this.getSearchHistory();
            history = history.filter(h => h.toLowerCase() !== term.toLowerCase());
            history.unshift(term.trim());
            history = history.slice(0, 5);
            localStorage.setItem('bible_search_history', JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save search history', e);
        }
    }
}

export const bibleSearch = new BibleSearchService();
