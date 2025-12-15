'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Copy, Edit3, Check, BookOpen, PenLine, X, Plus, Sparkles } from 'lucide-react';
import { useBible } from '@/context/BibleContext';
import { cn } from '@/lib/utils';

// Bible Data Structure
interface BibleBook {
    id: string;
    name: string;
    chapters: number;
}

// Simplified list of books for dropdown (could be fetched, but static is faster)
const BIBLE_BOOKS: BibleBook[] = [
    { id: 'GEN', name: 'Genesis', chapters: 50 },
    { id: 'EXO', name: 'Exodus', chapters: 40 },
    { id: 'LEV', name: 'Leviticus', chapters: 27 },
    { id: 'NUM', name: 'Numbers', chapters: 36 },
    { id: 'DEU', name: 'Deuteronomy', chapters: 34 },
    { id: 'JOS', name: 'Joshua', chapters: 24 },
    { id: 'JDG', name: 'Judges', chapters: 21 },
    { id: 'RUT', name: 'Ruth', chapters: 4 },
    { id: '1SA', name: '1 Samuel', chapters: 31 },
    { id: '2SA', name: '2 Samuel', chapters: 24 },
    { id: '1KI', name: '1 Kings', chapters: 22 },
    { id: '2KI', name: '2 Kings', chapters: 25 },
    { id: '1CH', name: '1 Chronicles', chapters: 29 },
    { id: '2CH', name: '2 Chronicles', chapters: 36 },
    { id: 'EZR', name: 'Ezra', chapters: 10 },
    { id: 'NEH', name: 'Nehemiah', chapters: 13 },
    { id: 'EST', name: 'Esther', chapters: 10 },
    { id: 'JOB', name: 'Job', chapters: 42 },
    { id: 'PSA', name: 'Psalms', chapters: 150 },
    { id: 'PRO', name: 'Proverbs', chapters: 31 },
    { id: 'ECC', name: 'Ecclesiastes', chapters: 12 },
    { id: 'SNG', name: 'Song of Solomon', chapters: 8 },
    { id: 'ISA', name: 'Isaiah', chapters: 66 },
    { id: 'JER', name: 'Jeremiah', chapters: 52 },
    { id: 'LAM', name: 'Lamentations', chapters: 5 },
    { id: 'EZK', name: 'Ezekiel', chapters: 48 },
    { id: 'DAN', name: 'Daniel', chapters: 12 },
    { id: 'HOS', name: 'Hosea', chapters: 14 },
    { id: 'JOL', name: 'Joel', chapters: 3 },
    { id: 'AMO', name: 'Amos', chapters: 9 },
    { id: 'OBA', name: 'Obadiah', chapters: 1 },
    { id: 'JON', name: 'Jonah', chapters: 4 },
    { id: 'MIC', name: 'Micah', chapters: 7 },
    { id: 'NAM', name: 'Nahum', chapters: 3 },
    { id: 'HAB', name: 'Habakkuk', chapters: 3 },
    { id: 'ZEP', name: 'Zephaniah', chapters: 3 },
    { id: 'HAG', name: 'Haggai', chapters: 2 },
    { id: 'ZEC', name: 'Zechariah', chapters: 14 },
    { id: 'MAL', name: 'Malachi', chapters: 4 },
    { id: 'MAT', name: 'Matthew', chapters: 28 },
    { id: 'MRK', name: 'Mark', chapters: 16 },
    { id: 'LUK', name: 'Luke', chapters: 24 },
    { id: 'JHN', name: 'John', chapters: 21 },
    { id: 'ACT', name: 'Acts', chapters: 28 },
    { id: 'ROM', name: 'Romans', chapters: 16 },
    { id: '1CO', name: '1 Corinthians', chapters: 16 },
    { id: '2CO', name: '2 Corinthians', chapters: 13 },
    { id: 'GAL', name: 'Galatians', chapters: 6 },
    { id: 'EPH', name: 'Ephesians', chapters: 6 },
    { id: 'PHP', name: 'Philippians', chapters: 4 },
    { id: 'COL', name: 'Colossians', chapters: 4 },
    { id: '1TH', name: '1 Thessalonians', chapters: 5 },
    { id: '2TH', name: '2 Thessalonians', chapters: 3 },
    { id: '1TI', name: '1 Timothy', chapters: 6 },
    { id: '2TI', name: '2 Timothy', chapters: 4 },
    { id: 'TIT', name: 'Titus', chapters: 3 },
    { id: 'PHM', name: 'Philemon', chapters: 1 },
    { id: 'HEB', name: 'Hebrews', chapters: 13 },
    { id: 'JAS', name: 'James', chapters: 5 },
    { id: '1PE', name: '1 Peter', chapters: 5 },
    { id: '2PE', name: '2 Peter', chapters: 3 },
    { id: '1JN', name: '1 John', chapters: 5 },
    { id: '2JN', name: '2 John', chapters: 1 },
    { id: '3JN', name: '3 John', chapters: 1 },
    { id: 'JUD', name: 'Jude', chapters: 1 },
    { id: 'REV', name: 'Revelation', chapters: 22 },
];

// Supported Versions (Free/Public Domain)
const BIBLE_VERSIONS = [
    { id: 'kjv', name: 'King James Version (KJV)' },
    { id: 'web', name: 'World English Bible (WEB)' },
    { id: 'asv', name: 'American Standard Version (ASV)' },
];

interface BibleReaderProps {
    onInsertNote?: (text: string) => void;
    onAskAi?: (query: string) => void;
}

export default function BibleReader({ onInsertNote, onAskAi }: BibleReaderProps) {
    const {
        reference, setReference, version, setVersion,
        openStudy, isStudyOpen, openBible,
        tabs, activeTabId, setActiveTab, addTab, closeTab
    } = useBible();

    const [text, setText] = useState<{ verse: number, text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Persist scroll position when switching tabs
    useEffect(() => {
        // Restore scroll when active tab changes
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab && currentTab.scrollPosition && contentRef.current) {
            contentRef.current.scrollTop = currentTab.scrollPosition;
        }
    }, [activeTabId, tabs]);

    // Fetch Bible Text
    useEffect(() => {
        const fetchChapter = async () => {
            if (!reference.book || !reference.chapter) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Map ID to Name for API if needed
                const bookName = BIBLE_BOOKS.find(b => b.name === reference.book || b.id === reference.book)?.name || reference.book;
                const safeBook = encodeURIComponent(bookName);

                // Use direct API call to support static export
                const res = await fetch(`https://bible-api.com/${safeBook}+${reference.chapter}?translation=${version.toLowerCase()}`);

                if (!res.ok) throw new Error('Failed to fetch');

                const data = await res.json();

                if (data && data.verses) {
                    setText(data.verses);
                } else {
                    setText([]);
                }

            } catch (error) {
                console.error("Failed to fetch Bible text:", error);
                setText([]);
            } finally {
                setLoading(false);
            }
        };

        fetchChapter();
        setSelectedVerses([]);
    }, [reference.book, reference.chapter, version, activeTabId]); // Re-fetch on tab switch if needed (ref changes)

    // Scroll to specific verse if requested
    useEffect(() => {
        if (!loading && reference.verse && scrollRef.current) {
            const verseEl = document.getElementById(`verse-${reference.verse}`);
            if (verseEl) {
                verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Auto-select the verse range if deep-linked
                if (reference.endVerse) {
                    const range = [];
                    for (let i = reference.verse; i <= reference.endVerse; i++) {
                        range.push(i);
                    }
                    setSelectedVerses(range);
                } else {
                    setSelectedVerses([reference.verse]);
                }
            }
        }
    }, [loading, reference.verse, reference.endVerse]);

    const handleVerseClick = (verseNum: number) => {
        if (selectedVerses.includes(verseNum)) {
            setSelectedVerses(selectedVerses.filter(v => v !== verseNum));
        } else {
            setSelectedVerses([...selectedVerses, verseNum].sort((a, b) => a - b));
        }
    };

    const handleNextChapter = () => {
        const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.name === reference.book || b.id === reference.book);
        const currentBook = BIBLE_BOOKS[currentBookIndex];

        if (reference.chapter < currentBook.chapters) {
            setReference({ ...reference, chapter: reference.chapter + 1, verse: undefined });
        } else if (currentBookIndex < BIBLE_BOOKS.length - 1) {
            // Next Book
            setReference({ book: BIBLE_BOOKS[currentBookIndex + 1].name, chapter: 1, verse: undefined });
        }
    };

    const handlePrevChapter = () => {
        if (reference.chapter > 1) {
            setReference({ ...reference, chapter: reference.chapter - 1, verse: undefined });
        } else {
            // Previous Book
            const currentBookIndex = BIBLE_BOOKS.findIndex(b => b.name === reference.book || b.id === reference.book);
            if (currentBookIndex > 0) {
                const prevBook = BIBLE_BOOKS[currentBookIndex - 1];
                setReference({ book: prevBook.name, chapter: prevBook.chapters, verse: undefined });
            }
        }
    };

    const handleAddToNotes = () => {
        if (!onInsertNote || selectedVerses.length === 0) return;

        // Format selected verses
        const selectedText = text
            .filter(t => selectedVerses.includes(t.verse))
            .map(t => `<sup style="font-size: 0.7em; color: #9ca3af;">${t.verse}</sup> ${t.text}`)
            .join(' ');

        const referenceText = `${reference.book} ${reference.chapter}:${selectedVerses[0]}${selectedVerses.length > 1 ? `-${selectedVerses[selectedVerses.length - 1]}` : ''}`;

        const html = `<blockquote><p>${selectedText}</p><p><strong>— ${referenceText} (${version.toUpperCase()})</strong></p></blockquote><p></p>`;

        // Open in new tab implicitly by inserting (user might want to keep reading)
        // But for now just insert
        onInsertNote(html);
        setSelectedVerses([]); // Clear selection after adding
    };

    useEffect(() => {
        console.log(`[BibleReader] BibleTabs Rendered. Count: ${tabs.length}, Active: ${activeTabId}`);
    }, [tabs, activeTabId]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 relative rounded-lg border border-gray-200 dark:border-zinc-800">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 backdrop-blur-sm">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[calc(100%-120px)]">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                console.log(`[BibleReader] Clicked tab: ${tab.id}`);
                                setActiveTab(tab.id);
                            }}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                ${activeTabId === tab.id
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                }
                            `}
                        >
                            <span>{tab.reference.book} {tab.reference.chapter}</span>
                            {tabs.length > 1 && (
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        closeTab(tab.id);
                                    }}
                                    className="ml-1 opacity-60 hover:opacity-100 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <X className="w-3 h-3" />
                                </span>
                            )}
                        </button>
                    ))}
                    <button
                        onClick={() => openBible(undefined, true)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="New Tab"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <button onClick={handlePrevChapter} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-500">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Version Selector */}
                    <select
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="bg-transparent font-bold text-blue-600 dark:text-blue-400 text-sm focus:outline-none cursor-pointer uppercase tracking-wider"
                    >
                        {BIBLE_VERSIONS.map(v => (
                            <option key={v.id} value={v.id}>{v.id.toUpperCase()}</option>
                        ))}
                    </select>

                    <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700 mx-1" />

                    {/* Book Selector */}
                    <select
                        value={reference.book}
                        onChange={(e) => setReference({ ...reference, book: e.target.value, chapter: 1 })}
                        className="bg-transparent font-semibold text-gray-900 dark:text-white text-sm focus:outline-none cursor-pointer max-w-[100px] sm:max-w-none truncate"
                    >
                        {BIBLE_BOOKS.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                    </select>

                    {/* Chapter Selector */}
                    <select
                        value={reference.chapter}
                        onChange={(e) => setReference({ ...reference, chapter: parseInt(e.target.value) })}
                        className="bg-transparent font-semibold text-gray-900 dark:text-white text-sm focus:outline-none cursor-pointer"
                    >
                        {(() => {
                            const currentBook = BIBLE_BOOKS.find(b => b.name === reference.book || b.id === reference.book);
                            return Array.from({ length: currentBook?.chapters || 1 }, (_, i) => i + 1).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ));
                        })()}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleNextChapter} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-500">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Text Display */}
            <div ref={contentRef} className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar bg-white dark:bg-zinc-900">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-1">
                        <h3 className="text-3xl font-serif font-bold text-center mb-10 text-gray-900 dark:text-white">
                            {reference.book} {reference.chapter}
                        </h3>
                        <div className="leading-[2.2] text-xl font-serif text-gray-800 dark:text-gray-200">
                            {text.map((verse) => {
                                const isSelected = selectedVerses.includes(verse.verse);
                                // Check for paragraph breaks (double newline usually means new paragraph)
                                const parts = verse.text.split(/\n\s*\n/);

                                return (
                                    <React.Fragment key={verse.verse}>
                                        <span
                                            id={`verse-${verse.verse}`}
                                            onClick={() => handleVerseClick(verse.verse)}
                                            className={cn(
                                                "relative cursor-pointer transition-colors duration-200 px-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800",
                                                isSelected && "bg-amber-200 dark:bg-amber-900/50 text-gray-900 dark:text-white decoration-clone"
                                            )}
                                        >
                                            <sup className="text-[0.6em] font-sans text-gray-400 mr-1 select-none font-bold align-top top-[-0.2em] relative">{verse.verse}</sup>
                                            {verse.text}
                                        </span>
                                        {/* Add spacing if the verse text ends with a newline or has one */}
                                        {verse.text.includes('\n') && <span className="block h-4" />}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Read & Study Button (Only in Quick View) */}
                {!isStudyOpen && !loading && text.length > 0 && (
                    <div className="max-w-xl mx-auto mt-12 mb-8 px-4">
                        <button
                            onClick={openStudy}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <BookOpen className="w-5 h-5" />
                            Open in Read & Study Mode
                        </button>
                        <p className="text-center text-xs text-gray-500 mt-2">
                            Open full screen with study notes and search tools.
                        </p>
                    </div>
                )}
            </div>

            {/* Floating Action Bar (Selection) */}
            {selectedVerses.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-full shadow-xl flex items-center gap-4 z-20 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <span className="text-sm font-medium whitespace-nowrap">
                        {selectedVerses.length} selected
                    </span>
                    <div className="h-4 w-px bg-white/20 dark:bg-black/10" />

                    {onInsertNote && (
                        <button
                            onClick={handleAddToNotes}
                            className="flex items-center gap-2 text-sm font-medium hover:text-amber-400 dark:hover:text-amber-600 transition-colors"
                        >
                            <PenLine className="w-4 h-4" />
                            Add to Notes
                        </button>
                    )}

                    <button
                        onClick={() => {
                            const selectedText = text
                                .filter(t => selectedVerses.includes(t.verse))
                                .map(t => `${t.verse} ${t.text}`)
                                .join(' ');

                            // Call parent handler
                            if (onAskAi) {
                                onAskAi(`"${selectedText}"\n\n`);
                            }
                        }}
                        className="flex items-center gap-2 text-sm font-medium hover:text-purple-400 dark:hover:text-purple-300 transition-colors"
                    >
                        <Sparkles className="w-4 h-4" />
                        Ask AI
                    </button>

                    <div className="h-4 w-px bg-white/20 dark:bg-black/10" />

                    <button
                        onClick={() => {
                            // Simple copy to clipboard
                            const selectedText = text
                                .filter(t => selectedVerses.includes(t.verse))
                                .map(t => `${t.verse} ${t.text}`)
                                .join('\n');
                            navigator.clipboard.writeText(`${reference.book} ${reference.chapter}:${selectedVerses.join(',')}\n${selectedText}`);
                            setSelectedVerses([]);
                        }}
                        className="flex items-center gap-2 text-sm font-medium hover:text-amber-400 dark:hover:text-amber-600 transition-colors"
                    >
                        <Copy className="w-4 h-4" />
                        Copy
                    </button>
                </div>
            )}
        </div>
    );
}
