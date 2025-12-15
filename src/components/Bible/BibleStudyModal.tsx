'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, BookOpen, Search as SearchIcon, Maximize2, Minimize2, Loader2, ChevronDown, Edit3, RotateCw, History, TrendingUp, Clock, ArrowRight, Youtube, Globe, Users, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useBible } from '@/context/BibleContext';
import TiptapEditor, { EditorToolbar } from '../Editor/TiptapEditor';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import BibleReader from './BibleReader';
import BibleAiChatModal from './BibleAiChatModal';
import { bibleSearch } from '@/lib/search/bible-index';
import { unifiedSearch, type UnifiedSearchResults } from '@/lib/search/unified-search';
import AiLessonCreator from './AiLessonCreator';
import CreateMeetingModal from '../Meeting/CreateMeetingModal';

interface BibleStudyModalProps {
    onClose: () => void;
}

export default function BibleStudyModal({ onClose }: BibleStudyModalProps) {
    const { user } = useAuth();
    const [isLessonCreatorOpen, setIsLessonCreatorOpen] = useState(false);
    const {
        isStudyOpen, closeStudy,
        onInsertNote, registerInsertHandler,
        openBible,
        tabs,
        activeTabId,
        searchVersion,
        setSearchVersion
    } = useBible();
    const [editor, setEditor] = useState<any>(null);
    const [notes, setNotes] = useState('');
    const [noteTitle, setNoteTitle] = useState('General Bible Study');
    const [savingNotes, setSavingNotes] = useState(false);

    // Prevent background scroll when open
    useEffect(() => {
        if (isStudyOpen) {
            document.body.classList.add('prevent-scroll');
            document.body.classList.add('modal-open'); // Marker for nested modals
        } else {
            document.body.classList.remove('prevent-scroll');
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.classList.remove('prevent-scroll');
            document.body.classList.remove('modal-open');
        };
    }, [isStudyOpen]);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]); // Deprecated, but keeping for compatibility if needed? No, let's switch.
    const [detailedResults, setDetailedResults] = useState<UnifiedSearchResults>({ bible: [], sermons: [], notes: [] });
    // UI State
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false); // Kept for legacy ref, can remove if unused
    const [createMeetingState, setCreateMeetingState] = useState<{ isOpen: boolean, topic?: string, date?: string }>({ isOpen: false });

    const [isSearching, setIsSearching] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false); // New state for loading index
    const [showResults, setShowResults] = useState(false);

    // Autocomplete & History
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    // Unified Suggestions State
    const [unifiedSuggestions, setUnifiedSuggestions] = useState<UnifiedSearchResults>({ bible: [], sermons: [], notes: [] });

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Load history on mount
    useEffect(() => {
        setSearchHistory(bibleSearch.getSearchHistory());
    }, []);

    // Debounced Search for Predictions
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim()) {
                // Perform Unified Search for Predictions
                const results = await unifiedSearch.search(searchQuery, user?.uid, searchVersion);
                setUnifiedSuggestions(results);
            } else {
                setUnifiedSuggestions({ bible: [], sermons: [], notes: [] });
            }
        }, 200); // Fast debounce for type-ahead
        return () => clearTimeout(timer);
    }, [searchQuery, user?.uid, searchVersion]);

    // Main Search (Detailed Results)
    const performSearch = async (query: string) => {
        if (!query.trim()) return;
        setIsSearching(true);
        try {
            // Updated: Fetch detailed results from Unified Search
            const results = await unifiedSearch.search(query, user?.uid, searchVersion);
            setDetailedResults(results);

            // Backward compatibility for old "searchResults" if any legacy prop needs it (none should)
            setSearchResults(results.bible); // Still update this for any legacy code we missed

        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
            setIsIndexing(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            bibleSearch.saveSearchToHistory(searchQuery);
            setSearchHistory(bibleSearch.getSearchHistory());
            performSearch(searchQuery);
            setShowResults(true); // Trigger view switch here
            if (splitRatio < 0.1 || splitRatio > 0.9) setSplitRatio(0.5); // Ensure pane is visible
            setShowSuggestions(false);
            searchInputRef.current?.blur();
        }
    };

    const handleHistoryClick = (term: string) => {
        setSearchQuery(term);
        bibleSearch.saveSearchToHistory(term);
        setSearchHistory(bibleSearch.getSearchHistory());
        performSearch(term);
        setShowSuggestions(false);
    };

    const handleWebSearch = (term: string) => {
        if (!term.trim()) return;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(term)}`, '_blank');
        setShowSuggestions(false);
    };

    const toggleSuggestions = (show: boolean) => {
        // slight delay to allow click events to propagate
        setTimeout(() => setShowSuggestions(show), 200);
    };

    const { userData } = useAuth(); // Need to see available custom sources


    // Load Notes on Mount
    useEffect(() => {
        if (!user) return;
        const notesRef = doc(db, 'users', user.uid, 'notes', 'bible-study-general');
        const unsubscribe = onSnapshot(notesRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.content && data.content !== notes) {
                    // Only update if significantly different to avoid cursor jumps?
                    // Tiptap handles content updates well if we don't force it on every keystroke.
                    // But for initial load, it's fine.
                    // actually, we should only setNotes if we don't have local changes?
                    // For now, let's just set on initial load.
                    if (!editor) setNotes(data.content);
                }
                if (data.title) setNoteTitle(data.title);
            } else {
                // If new, set default title based on current context
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab) {
                    setNoteTitle(`Study: ${activeTab.reference.book} ${activeTab.reference.chapter}`);
                }
            }
        });
        return () => unsubscribe();
    }, [user, editor]); // Depend on editor so we don't overwrite user typing if we add conflict logic later

    const handleSaveNotes = async (content: string, titleOverride?: string) => {
        if (!user) return;
        setSavingNotes(true);
        try {
            const notesRef = doc(db, 'users', user.uid, 'notes', 'bible-study-general');
            await setDoc(notesRef, {
                title: titleOverride || noteTitle,
                content,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving notes:', error);
        } finally {
            setTimeout(() => setSavingNotes(false), 1000);
        }
    };

    const handleTitleChange = (newTitle: string) => {
        setNoteTitle(newTitle);
        // Save immediately (debounced ideally, but direct for now)
        if (editor) {
            handleSaveNotes(editor.getHTML(), newTitle);
        }
    };

    // Old handleSearch removed in favor of proper separate functions
    // kept performSearch above

    // Get custom sources for dropdown
    const customSources: any[] = userData?.customBibleSources || [];

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
    };

    // Refs
    const modalContainerRef = useRef<HTMLDivElement>(null);
    const videoPlaceholderRef = useRef<HTMLDivElement>(null);

    // Register Bible Insert Handler
    useEffect(() => {
        registerInsertHandler((html) => {
            if (editor) {
                // Focus end to ensure valid selection target
                editor.commands.focus('end');
                editor.commands.insertContent(html);
                const newContent = editor.getHTML();
                handleSaveNotes(newContent);
            }
        });
        return () => registerInsertHandler(null);
    }, [editor, registerInsertHandler]);

    // Ratio-based Resizing Logic (0.0 to 1.0)
    // 1.0 = Full Reader (Notes Hidden)
    // 0.0 = Full Notes (Reader Hidden)
    // 0.5 = 50/50 Split
    const [splitRatio, setSplitRatio] = useState(0.5);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [lastSplitRatio, setLastSplitRatio] = useState(0.5);

    // Maximize/Minimize toggles
    // If ratio > 0.9, we consider it "Reader Maximized"
    const isReaderMaximized = splitRatio > 0.95;
    // If ratio < 0.1, we consider it "Notes Maximized"
    const isNotesMaximized = splitRatio < 0.05;

    const toggleReaderMaximize = () => {
        if (isReaderMaximized) {
            // Restore to last non-maximized state (or default 0.5)
            setSplitRatio(lastSplitRatio > 0.9 ? 0.5 : lastSplitRatio);
        } else {
            setLastSplitRatio(splitRatio);
            setSplitRatio(1.0);
        }
    };

    const toggleNotesMaximize = () => {
        if (isNotesMaximized) {
            setSplitRatio(lastSplitRatio < 0.1 ? 0.5 : lastSplitRatio);
        } else {
            setLastSplitRatio(splitRatio);
            setSplitRatio(0.0);
        }
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleDrag = (e: MouseEvent | TouchEvent) => {
            if (!isDragging || !containerRef.current) return;

            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const rect = containerRef.current.getBoundingClientRect();
            const relativeY = clientY - rect.top;
            const containerHeight = rect.height;

            // Calculate ratio (clamped 0 to 1)
            // relativeY is the bottom of the reader portion
            let newRatio = relativeY / containerHeight;
            newRatio = Math.max(0, Math.min(newRatio, 1));

            // Snap logic
            if (newRatio > 0.95) newRatio = 1.0;
            if (newRatio < 0.05) newRatio = 0.0;

            setSplitRatio(newRatio);
        };

        const handleDragEnd = () => {
            setIsDragging(false);
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDrag);
            window.removeEventListener('touchend', handleDragEnd);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleDrag);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDrag);
            window.addEventListener('touchend', handleDragEnd);
        };

        return () => {
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDrag);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging]);

    const [isFellowshipMode, setIsFellowshipMode] = useState(false);
    const [isAiChatOpen, setIsAiChatOpen] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiAutoSend, setAiAutoSend] = useState(false);
    const [aiMessages, setAiMessages] = useState<any[]>([]); // Restored for chat persistence
    const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
    const [createMeetingDefaultTopic, setCreateMeetingDefaultTopic] = useState('');

    const handleAskAi = (query: string, autoSend: boolean = false) => {
        setAiQuery(query);
        setAiAutoSend(autoSend);
        setIsAiChatOpen(true);
    };

    const handleAddToNotes = (text: string) => {
        if (editor) {
            // Focus end to ensure valid selection target for block insertion
            editor.commands.focus('end');
            editor.commands.insertContent(text);
            const newContent = editor.getHTML();
            handleSaveNotes(newContent);
        }
    };

    const handleLinkClick = (href: string) => {
        console.log("BibleStudyModal: handleLinkClick fired", href);
        if (href.startsWith('verse://')) {
            const ref = decodeURIComponent(href.replace('verse://', ''));
            console.log("BibleStudyModal: Parsed Ref", ref);
            // Regex matches: "Book Chapter[:Verse[-EndVerse]]"
            const match = ref.match(/(.+?)\s(\d+)(?::(\d+)(?:-(\d+))?)?$/);
            console.log("BibleStudyModal: Match", match);

            if (match) {
                const book = match[1].trim();
                const chapter = parseInt(match[2]);
                // match[3] is startVerse (optional), match[4] is endVerse (optional)
                const startVerse = match[3] ? parseInt(match[3]) : undefined;
                const endVerse = match[4] ? parseInt(match[4]) : undefined;

                console.log("BibleStudyModal: Opening Bible", { book, chapter, startVerse, endVerse });
                openBible({ book, chapter, verse: startVerse, endVerse }, true);
            } else {
                // Fallback if regex fails (should catch most things now)
                console.warn("Could not parse verse ref:", ref);
            }
        } else {
            console.log("Opening external link", href);
            window.open(href, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-3" ref={modalContainerRef}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                onTouchMove={(e) => e.preventDefault()}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm touch-none"
            />

            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-[95vw] sm:max-w-7xl h-[96vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Fixed Header with Search */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-20 shrink-0 relative gap-4">

                    {/* Title + Icon (Compact) */}
                    <div className="flex items-center gap-3 shrink-0 hidden sm:flex">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">Bible Study</h2>
                    </div>

                    {/* Centered Search Bar with "Google-Like" Dropdown */}
                    <div className="flex-1 max-w-xl mx-auto relative z-50">
                        <form onSubmit={handleSearchSubmit} className="relative shadow-sm rounded-lg">
                            <div className="flex items-center gap-2 relative bg-gray-100 dark:bg-zinc-800 rounded-lg pr-2 border-transparent focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                {/* Version Selector */}
                                <div className="relative border-r border-gray-300 dark:border-zinc-700">
                                    <select
                                        value={searchVersion}
                                        onChange={(e) => setSearchVersion(e.target.value)}
                                        className="text-xs font-bold bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-300 cursor-pointer py-2.5 pl-3 pr-7 appearance-none outline-none"
                                    >
                                        <option value="kjv" className="text-black dark:text-white">KJV</option>
                                        <option value="web" className="text-black dark:text-white">WEB</option>
                                        {customSources.map((s: any) => (
                                            <option key={s.name} value={s.name} className="text-black dark:text-white">
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                </div>

                                {/* Input */}
                                <div className="relative flex-1">
                                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowSuggestions(true);
                                            // Do NOT show results pane yet, keep it in Notes view
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => toggleSuggestions(false)} // Delay hide
                                        placeholder="Search verses, sermons, notes..."
                                        className="w-full pl-9 pr-10 py-2.5 bg-transparent border-none outline-none text-base sm:text-sm text-gray-900 dark:text-white placeholder-gray-500"
                                        autoComplete="off"
                                    />
                                    {searchQuery ? (
                                        <button
                                            type="button"
                                            onClick={clearSearch}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                                        >
                                            <X className="w-3 h-3 text-gray-500" />
                                        </button>
                                    ) : null}
                                </div>
                                <button type="submit" disabled={!searchQuery.trim()} className="p-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0 mr-1">
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </form>

                        <AnimatePresence>
                            {showSuggestions && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-[60]"
                                >
                                    {/* Quick Filters */}
                                    <div>
                                        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                            <TrendingUp className="w-3 h-3" />
                                            Quick Access
                                        </div>
                                        <div className="flex flex-wrap gap-2 px-3 pb-2">
                                            {['Gospels', 'Paul\'s Letters', 'Psalms', 'Proverbs', 'Genesis'].map(tag => (
                                                <button
                                                    key={tag}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleHistoryClick(tag);
                                                    }}
                                                    className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Web Search Option */}
                                        {searchQuery && (
                                            <div className="border-t border-gray-100 dark:border-zinc-800 mt-1 pt-1">
                                                <button
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleWebSearch(searchQuery);
                                                    }}
                                                    className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group"
                                                >
                                                    <div className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-md group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                                                        <Globe className="w-4 h-4 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                                                    </div>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        Search Google for <span className="font-semibold">"{searchQuery}"</span>
                                                    </span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* STATE 2: Typing -> Live Results Preview (Only when Suggestions are hidden or just separate? Usually separate) */}
                            {/* Actually, if we have a query, we typically show RESULTS, not suggestions. */}
                            {/* But here we want the "Dropdown" effect. */}
                            {/* Let's wrap this in a separate conditional or merge logic if needed. */}
                            {/* For now, just fixing the syntax. */}
                            {searchQuery.trim() && !showSuggestions && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-[60]"
                                >
                                    <div className="py-2">
                                        {isSearching ? (
                                            <div className="flex items-center justify-center py-4 text-gray-400 gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-sm">Searching...</span>
                                            </div>
                                        ) : unifiedSuggestions.bible.length > 0 || unifiedSuggestions.sermons.length > 0 ? (
                                            <>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800/50">
                                                    <span>Top Matches</span>
                                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                                        {unifiedSuggestions.bible.length + unifiedSuggestions.sermons.length}
                                                    </span>
                                                </div>
                                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                                                    {/* Bible Hits */}
                                                    {unifiedSuggestions.bible.slice(0, 3).map((hit: any, i: number) => (
                                                        <button
                                                            key={`bible-${i}`}
                                                            onClick={() => {
                                                                const meta = hit.metadata;
                                                                openBible({ book: meta.book, chapter: meta.chapter, verse: meta.verse }, true);
                                                                setShowSuggestions(false);
                                                                bibleSearch.saveSearchToHistory(searchQuery);
                                                                setSplitRatio(1.0); // Auto-minimize results
                                                            }}
                                                            className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-colors group mb-1"
                                                        >
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                                                                    {hit.title}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                                                {hit.description}
                                                            </p>
                                                        </button>
                                                    ))}

                                                    {/* View All */}
                                                    <button
                                                        onClick={handleSearchSubmit}
                                                        className="w-full text-center py-3 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline border-t border-gray-100 dark:border-zinc-800 mt-2"
                                                    >
                                                        View all results
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-8 text-gray-400">
                                                <p className="text-sm">No matches found</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>


                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">

                        <button
                            onClick={() => handleAskAi('')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors font-medium text-xs sm:text-sm"
                        >
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Ask AI</span>
                            <span className="inline sm:hidden">AI</span>
                        </button>

                        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800 mx-1" />

                        <button
                            onClick={() => {
                                console.log('[BibleStudyModal] Toggling Fellowship. Current:', isFellowshipMode);
                                setIsFellowshipMode(!isFellowshipMode);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 font-medium text-xs sm:text-sm shadow-sm ${isFellowshipMode
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40 animate-pulse-slow'
                                : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">{isFellowshipMode ? 'Fellowshipping...' : 'Fellowship'}</span>
                        </button>

                        <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800 mx-1" />

                        <button
                            onClick={toggleReaderMaximize}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500"
                            title={isReaderMaximized ? "Restore Split View" : "Full Screen Reader"}
                        >
                            {isReaderMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Container (Flex Column) */}
                <div className="flex-1 overflow-hidden relative flex flex-col overscroll-contain">

                    {/* TOP PANE: Bible Reader */}
                    <div
                        style={{ height: `${splitRatio * 100}%`, minHeight: 0 }}
                        className={
                            cn(
                                "w-full border-b border-gray-200 dark:border-zinc-800 overflow-hidden relative",
                                !isDragging && "transition-[height] duration-75 ease-out", // Only animate when NOT dragging
                                splitRatio === 0 && "invisible border-none" // Completely hide if ratio is 0
                            )}
                    >
                        <BibleReader onInsertNote={onInsertNote || undefined} onAskAi={handleAskAi} />

                        {/* Visual Cue for Search Results when Reader is dominant */}
                        <AnimatePresence>
                            {showResults && (detailedResults.bible.length > 0 || detailedResults.sermons.length > 0 || detailedResults.notes.length > 0) && splitRatio > 0.8 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    onClick={() => setSplitRatio(0.5)}
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-20 flex items-center gap-2 cursor-pointer hover:bg-blue-700 transition-colors"
                                >
                                    <span>{detailedResults.bible.length + detailedResults.sermons.length + detailedResults.notes.length} results found below</span>
                                    <div className="animate-bounce mt-1">
                                        <ChevronDown className="w-3 h-3" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* DRAG HANDLE */}
                    <div
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                        className={
                            cn(
                                "z-50 bg-gray-50 dark:bg-zinc-950 border-y border-gray-200 dark:border-zinc-800 py-1.5 flex items-center justify-center cursor-row-resize hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group relative shrink-0",
                                (splitRatio === 0 || splitRatio === 1) && "py-2" // Slightly larger hit area when snapped
                            )}
                    >
                        {/* Visual Drag Handle Indicator */}
                        < div className={
                            cn(
                                "w-12 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full transition-all duration-300",
                                (showResults && splitRatio > 0.8) ? "bg-blue-400 dark:bg-blue-500 w-16 h-1.5 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "group-hover:bg-blue-400 dark:group-hover:bg-blue-600"
                            )} />

                        {/* Bouncing Chevron Cue if results hidden */}
                        {
                            (showResults && splitRatio > 0.9) && (
                                <div className="absolute -bottom-6 text-blue-500 animate-bounce">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            )
                        }
                    </div>

                    {/* BOTTOM PANE: Notes / Unified Results */}
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 overflow-hidden">
                        {
                            showResults ? (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50/50 dark:bg-zinc-900/50" >
                                    <div className="flex items-center justify-between mb-4 sticky top-0 bg-gray-50/95 dark:bg-zinc-900/95 backdrop-blur z-10 py-2 border-b border-transparent">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Search Results</h3>
                                            <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full font-medium">
                                                {detailedResults.bible.length + detailedResults.sermons.length + detailedResults.notes.length}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Toggle Full Screen for Results */}
                                            <button
                                                onClick={toggleNotesMaximize}
                                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                                title={isNotesMaximized ? "Restore View" : "Full Screen Results"}
                                            >
                                                {isNotesMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                            </button>
                                            <button onClick={() => setShowResults(false)} className="text-xs text-blue-600 hover:underline font-medium">
                                                Close Results
                                            </button>
                                        </div>
                                    </div>

                                    {isSearching ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                                            <RotateCw className="w-6 h-6 animate-spin" />
                                            <p>{isIndexing ? `Indexing ${searchVersion.toUpperCase()}... (First run only)` : 'Searching...'}</p>
                                        </div>
                                    ) : (detailedResults.bible.length > 0 || detailedResults.sermons.length > 0 || detailedResults.notes.length > 0) ? (
                                        <div className="space-y-8">
                                            {/* SECTION 1: SERMONS (High Relevance) */}
                                            {detailedResults.sermons.length > 0 && (
                                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75">
                                                    <h4 className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 pl-1">
                                                        <Youtube className="w-4 h-4" /> Related Sermons
                                                    </h4>
                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                        {detailedResults.sermons.map((sermon: any) => (
                                                            <div key={sermon.id} className="bg-white dark:bg-zinc-950 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/30 hover:border-purple-300 transition-colors group cursor-pointer active:scale-95 duration-100" onClick={() => {
                                                                // Handle open sermon
                                                                window.open(`/sermons/${sermon.id}`, '_blank');
                                                                setSplitRatio(1.0); // Auto-minimize
                                                            }}>
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg group-hover:bg-purple-200 transition-colors">
                                                                        <Youtube className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-500 px-2 py-0.5 rounded-full">
                                                                        {sermon.subtitle}
                                                                    </div>
                                                                </div>
                                                                <h5 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 transition-colors">{sermon.title}</h5>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{sermon.description}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SECTION 2: NOTES (Personal) */}
                                            {detailedResults.notes.length > 0 && (
                                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
                                                    <h4 className="flex items-center gap-2 text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-3 pl-1">
                                                        <Edit3 className="w-4 h-4" /> Your Notes
                                                    </h4>
                                                    <div className="grid gap-3">
                                                        {detailedResults.notes.map((note: any) => (
                                                            <div key={note.id} className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 hover:border-yellow-300 transition-colors cursor-pointer" onClick={() => {
                                                                // Open note context?
                                                                setNotes(note.content); // Simplified preview
                                                                setSplitRatio(1.0); // Auto-minimize
                                                            }}>
                                                                <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-1">{note.title}</h5>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: note.description || '' }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SECTION 3: SCRIPTURE (Bulk Matches) */}
                                            {detailedResults.bible.length > 0 && (
                                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                                                    <h4 className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 pl-1">
                                                        <BookOpen className="w-4 h-4" /> Scripture Matches
                                                    </h4>
                                                    <div className="grid gap-3">
                                                        {detailedResults.bible.map((verse: any, idx: number) => (
                                                            <div
                                                                key={`verse-${idx}`}
                                                                onClick={() => {
                                                                    const meta = verse.metadata;
                                                                    openBible({ book: meta.book, chapter: meta.chapter, verse: meta.verse }, true);
                                                                    setSplitRatio(1.0); // Auto-minimize
                                                                }}
                                                                className="relative p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md group bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-800"
                                                            >
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                                                        {verse.title}
                                                                    </span>
                                                                </div>
                                                                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed font-serif">
                                                                    {verse.description}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 text-gray-400">
                                            <p>No results found for "{searchQuery}"</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col">
                                    {/* Toolbar Header */}
                                    <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-4 py-2 flex items-center justify-between shrink-0">
                                        <div className="flex flex-col gap-0.5 flex-1 mr-4">
                                            <div className="flex items-center gap-2">
                                                <Edit3 className="w-4 h-4 text-blue-500 shrink-0" />
                                                <input
                                                    type="text"
                                                    value={noteTitle}
                                                    onChange={(e) => handleTitleChange(e.target.value)}
                                                    className="bg-transparent border-none p-0 text-base sm:text-sm font-bold text-gray-800 dark:text-white focus:ring-0 w-full placeholder-gray-400"
                                                    placeholder="Note Title..."
                                                />
                                            </div>
                                            {savingNotes && <span className="text-[10px] text-green-600 animate-pulse font-medium ml-6">Saving...</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Toggle Full Screen for Notes */}
                                            <button
                                                onClick={toggleNotesMaximize}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                                title={isNotesMaximized ? "Restore View" : "Full Screen Notes"}
                                            >
                                                {isNotesMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="border-b border-gray-100 dark:border-zinc-800 px-2 bg-gray-50/50 dark:bg-zinc-900/50">
                                        <EditorToolbar
                                            editor={editor}
                                            className="border-none shadow-none bg-transparent mb-0 pb-0 justify-center scale-90 origin-left"
                                        />
                                    </div>

                                    {/* Scrollable Editor Area */}
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-gray-50 dark:bg-zinc-900/50">
                                        <div className="max-w-4xl mx-auto border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden min-h-full bg-white dark:bg-zinc-950 shadow-sm relative">
                                            <TiptapEditor
                                                content={notes}
                                                onChange={(content) => handleSaveNotes(content)}
                                                className="p-6 min-h-[500px] prose dark:prose-invert max-w-none focus:outline-none"
                                                showToolbar={false}
                                                onEditorReady={setEditor}
                                                onAskAi={handleAskAi}
                                                onLinkClick={handleLinkClick}
                                                collaborationId={isFellowshipMode ? `fellowship-${tabs.find(t => t.id === activeTabId)?.reference.book}-${tabs.find(t => t.id === activeTabId)?.reference.chapter}` : undefined}
                                                user={{ name: userData?.displayName || 'Anonymous', color: '#3b82f6' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                            )}
                    </div>
                </div>

                <BibleAiChatModal
                    isOpen={isAiChatOpen}
                    onClose={() => {
                        setIsAiChatOpen(false);
                        setAiAutoSend(false);
                    }}
                    contextId={`${tabs.find(t => t.id === activeTabId)?.reference.book} ${tabs.find(t => t.id === activeTabId)?.reference.chapter}`}
                    contextTitle={`Bible Study: ${tabs.find(t => t.id === activeTabId)?.reference.book} ${tabs.find(t => t.id === activeTabId)?.reference.chapter}`}
                    initialQuery={aiQuery}
                    autoSend={aiAutoSend}
                    messages={aiMessages}
                    onMessagesChange={setAiMessages}
                    onInsertToNotes={handleAddToNotes}
                    onCreateMeeting={(topic) => {
                        setCreateMeetingDefaultTopic(topic || '');
                        setIsCreateMeetingOpen(true);
                    }}
                    preserveScrollLockOnClose={true}
                />

                <AnimatePresence>
                    {isLessonCreatorOpen && (
                        <AiLessonCreator
                            isOpen={isLessonCreatorOpen}
                            onClose={() => setIsLessonCreatorOpen(false)}
                            contextTitle={`${tabs.find(t => t.id === activeTabId)?.reference.book} ${tabs.find(t => t.id === activeTabId)?.reference.chapter}`}
                            onInsert={handleAddToNotes}
                        />
                    )}
                </AnimatePresence>

                <CreateMeetingModal
                    isOpen={createMeetingState.isOpen}
                    onClose={() => setCreateMeetingState({ isOpen: false })}
                    initialTopic={createMeetingState.topic || createMeetingDefaultTopic}
                    initialDate={createMeetingState.date}
                    initialDescription={editor ? editor.getHTML() : ''}
                />

            </motion.div >
        </div >
    );
}
