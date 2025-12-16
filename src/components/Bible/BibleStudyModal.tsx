'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, BookOpen, Search as SearchIcon, Maximize2, Minimize2, Loader2, ChevronDown, Edit3, RotateCw, History, TrendingUp, Clock, ArrowRight, Youtube, Globe, Users, Plus, LayoutGrid, ExternalLink, Mic, Book } from 'lucide-react';
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
import FellowshipView from './FellowshipView';

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
    const [detailedResults, setDetailedResults] = useState<UnifiedSearchResults & { web?: any[], topics?: any[], videos?: any[] }>({ bible: [], sermons: [], notes: [], web: [], topics: [], videos: [] });
    // Video Focus State
    const [selectedVideo, setSelectedVideo] = useState<{ videoId: string, title: string } | null>(null);
    const [quickNoteContent, setQuickNoteContent] = useState('');
    const [isBibleExpanded, setIsBibleExpanded] = useState(false);
    // UI State
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false); // Kept for legacy ref, can remove if unused
    const [createMeetingState, setCreateMeetingState] = useState<{ isOpen: boolean, topic?: string, date?: string }>({ isOpen: false });

    const [isSearching, setIsSearching] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false); // New state for loading index
    const [rightPaneView, setRightPaneView] = useState<'notes' | 'fellowship' | 'search'>('notes');
    const showResults = rightPaneView === 'search'; // Derived for backward compat in render


    // Autocomplete & History
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    // Unified Suggestions State
    const [unifiedSuggestions, setUnifiedSuggestions] = useState<UnifiedSearchResults>({ bible: [], sermons: [], notes: [] });

    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchResultsContainerRef = useRef<HTMLDivElement>(null);

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

            // Backward compatibility for old "searchResults" if any legacy prop needs it (none should)
            setSearchResults(results.bible); // Still update this for any legacy code we missed

        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
            setIsIndexing(false);
        }
    };

    const handleSearchSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!searchQuery.trim()) return;

        // Force close dropdown immediately
        setShowSuggestions(false);

        bibleSearch.saveSearchToHistory(searchQuery);
        setSearchHistory(bibleSearch.getSearchHistory());
        setIsSearching(true);
        setRightPaneView('search'); // FORCE SEARCH PANE

        try {
            await performSearch(searchQuery);
            // "Pane (larger pane) should slide up to close [dropdown]... and switch to larger search"
            // Setting splitRatio to small value (e.g. 0.2) maximizes the Bottom Pane (Results).
            // This creates the "Slide Up" effect the user described.
            setSplitRatio(0.2);
            setShowSuggestions(false); // Force close dropdown (it "slides to close" visually via AnimatePresence usually, or just disappears)
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
            searchInputRef.current?.blur();
        }
    };

    const handleQuickNoteSave = () => {
        if (!quickNoteContent.trim() || !user) return;

        // Use existing handleAddToNotes or manual save
        handleAddToNotes(`<p><strong>Note from Video (${selectedVideo?.title}):</strong></p><p>${quickNoteContent}</p>`);
        setQuickNoteContent('');
        // toast.success("Note saved!"); 
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

    // Memoized User for Tiptap to prevent re-renders
    const tiptapUser = useMemo(() => ({
        name: userData?.displayName || 'Anonymous',
        color: userData?.photoURL ? '#3b82f6' : '#a855f7'
    }), [userData?.displayName, userData?.photoURL]);



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
        if (rightPaneView === 'search') setRightPaneView('notes');
    };

    const handleNoteChange = (content: string) => {
        setNotes(content);
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

            // Snap logic - Prevent full closure of bottom pane as per user request
            // Max 0.9 keeps the "Note Title"/Header visible
            if (newRatio > 0.9) newRatio = 0.9;
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

    // isFellowshipMode merged into rightPaneView

    const [isAiChatOpen, setIsAiChatOpen] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiAutoSend, setAiAutoSend] = useState(false);
    const [aiMessages, setAiMessages] = useState<any[]>([]); // Restored for chat persistence


    const handleAskAi = (prompt: string, autoSend: boolean = true) => {
        setAiQuery(prompt);
        setAiAutoSend(autoSend);
        setIsAiChatOpen(true);
    };

    const handleAddToNotes = (text: string) => {
        console.log("BibleStudyModal: handleAddToNotes called with text length:", text?.length);

        const performFallback = () => {
            console.warn("BibleStudyModal: Performing fallback append (Editor invalid/crashed).");
            const newContent = notes + text;
            setNotes(newContent);
            handleSaveNotes(newContent);
        };

        if (editor && !editor.isDestroyed) {
            console.log("BibleStudyModal: Editor instance exists. Trying insert...");
            try {
                // Try-catch wrapped insert. If ANYTHING fails (focus or insert), we go to catch -> fallback.
                try {
                    editor.commands.focus('end');
                } catch (focusErr) {
                    // Just warn for focus, might still be able to insert?
                    // Actually, if focus fails due to view issues, insert might too.
                    console.warn("BibleStudyModal: Focus failed", focusErr);
                }

                editor.commands.insertContent(text);
                const newContent = editor.getHTML();
                handleSaveNotes(newContent);
                console.log("BibleStudyModal: Content inserted via Editor.");
            } catch (err) {
                console.error("BibleStudyModal: Editor insert crashed:", err);
                performFallback();
            }
        } else {
            console.warn("BibleStudyModal: Editor missing or destroyed.", { exists: !!editor, destroyed: editor?.isDestroyed });
            performFallback();
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
                className="relative w-full max-w-[95vw] sm:max-w-7xl h-[96vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col pb-12 sm:pb-0"
            >
                {/* Fixed Header with Search - Added Glass Effect to connect visual to pane */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-[60] shrink-0 relative gap-4">

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
                                        {customSources?.map((s: any) => (
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
                                    {/* QUICK FILTERS (Only show if NO query or NO matches yet) */}
                                    {!searchQuery.trim() && (
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
                                        </div>
                                    )}

                                    {/* TOP MATCHES / LIVE SEARCH (Show if query exists) */}
                                    {searchQuery.trim() && (
                                        <>
                                            {/* Web Search Option */}
                                            <div className="border-b border-gray-100 dark:border-zinc-800 mb-1">
                                                <button
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleWebSearch(searchQuery);
                                                    }}
                                                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group"
                                                >
                                                    <div className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-md group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                                                        <Globe className="w-4 h-4 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                                                    </div>
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        Search Google for <span className="font-semibold">"{searchQuery}"</span>
                                                    </span>
                                                </button>
                                            </div>

                                            <div className="py-0">
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
                                                            {unifiedSuggestions?.bible?.slice(0, 3)?.map((hit: any, i: number) => (
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
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setShowSuggestions(false); // Explicitly close dropdown
                                                                    handleSearchSubmit();
                                                                }}
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
                                        </>
                                    )}
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
                                setRightPaneView(prev => prev === 'fellowship' ? 'notes' : 'fellowship');
                                // Ensure split ratio is visible
                                if (splitRatio > 0.3) setSplitRatio(0.2); // Ensure pane is expanded (0.2 = bottom pane takes 80%)
                                else if (splitRatio < 0.1) setSplitRatio(0.2); // If hidden, show it
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-500 font-medium text-xs sm:text-sm shadow-sm ${rightPaneView === 'fellowship'
                                ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-[length:200%_200%] animate-gradient-xy text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] border-transparent'
                                : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${rightPaneView === 'fellowship' ? 'text-white animate-pulse' : 'text-gray-500 dark:text-gray-400'}`} />
                            <span className="hidden sm:inline">{rightPaneView === 'fellowship' ? 'Fellowshipping...' : 'Fellowship'}</span>
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
                        style={{
                            height: splitRatio > 0.9 ? '100%' : `${splitRatio * 100}%`,
                            // Remove minHeight logic from here, we control bottom pane now
                        }}
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
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 cursor-pointer pointer-events-auto group"
                                >
                                    <div className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg shadow-blue-500/20 flex items-center gap-2 text-xs font-bold hover:scale-105 active:scale-95 transition-transform">
                                        <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                                            {detailedResults.bible.length + detailedResults.sermons.length + detailedResults.notes.length + (detailedResults.web?.length || 0)}
                                        </span>
                                        <span>Results Found below</span>
                                        <ChevronDown className="w-4 h-4 animate-bounce" />
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
                                "relative z-50 flex items-center justify-center cursor-row-resize py-3 -my-3 group select-none touch-none",
                                // Active/Hover State for Aurora Effect
                                "active:z-[60]"
                            )}
                    >
                        {/* Visual Bar Container - INCREASED HIT AREA */}
                        <div className="absolute inset-x-0 h-4 bg-transparent hover:bg-gradient-to-b hover:from-transparent hover:via-blue-50/50 hover:to-transparent dark:hover:via-blue-900/10 flex items-center justify-center cursor-row-resize z-50">
                            {/* Aurora Neon Glow Indicator - INCREASED VISUAL SIZE */}
                            <div className={
                                cn(
                                    "w-32 h-1.5 bg-gray-300 dark:bg-zinc-600 rounded-full transition-all duration-500 ease-out relative",
                                    // Aurora Logic: Active or Special State
                                    "group-hover:bg-blue-400 dark:group-hover:bg-blue-500 group-hover:w-40 group-hover:h-2 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
                                    "group-active:w-80 group-active:h-2.5 group-active:bg-blue-500 group-active:shadow-[0_0_30px_10px_rgba(59,130,246,0.6)]"
                                )
                            } />
                        </div>

                        {/* Bouncing Chevron Cue if results hidden */}
                        {
                            (showResults && splitRatio > 0.9) && (
                                <div className="absolute -bottom-6 text-blue-500 animate-bounce pointer-events-none">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            )
                        }
                    </div>

                    {/* BOTTOM PANE: Explicit Switch for View Modes */}
                    <div
                        className={cn(
                            "flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 overflow-hidden",
                            // STRICT COLLAPSE LOGIC: If split ratio > 0.9, force height to 32px (Title Only)
                            splitRatio > 0.9 && "flex-none !h-[32px]"
                        )}
                    >
                        {rightPaneView === 'search' ? (
                            selectedVideo ? (
                                /* --- VIDEO FOCUS VIEW --- */
                                <div className="flex-1 flex flex-col min-h-0 bg-black relative">
                                    {/* Header / Back */}
                                    <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
                                        <button
                                            onClick={() => setSelectedVideo(null)}
                                            className="flex items-center gap-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-full backdrop-blur transition-all text-sm font-medium"
                                        >
                                            <ArrowRight className="w-4 h-4 rotate-180" />
                                            Back to Results
                                        </button>
                                    </div>

                                    {/* Video Player (Full Height) */}
                                    <div className="flex-1 w-full bg-black flex items-center justify-center">
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1`}
                                            title={selectedVideo.title}
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="w-full h-full"
                                        />
                                    </div>

                                    {/* Quick Note Overlay (Bottom) */}
                                    <div className="bg-gray-900/95 backdrop-blur border-t border-gray-800 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <Edit3 className="w-3 h-3" />
                                                Quick Notes
                                            </h4>
                                            {quickNoteContent.trim() && (
                                                <span className="text-[10px] text-green-400">Drafting...</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <textarea
                                                value={quickNoteContent}
                                                onChange={(e) => setQuickNoteContent(e.target.value)}
                                                placeholder="Jot down thoughts... (Saved to your main notes)"
                                                className="flex-1 bg-gray-800 text-gray-200 text-sm rounded-lg border-gray-700 focus:ring-purple-500 focus:border-purple-500 p-2 resize-none h-16"
                                            />
                                            <button
                                                onClick={handleQuickNoteSave}
                                                disabled={!quickNoteContent.trim()}
                                                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 flex flex-col items-center justify-center gap-1 transition-colors min-w-[60px]"
                                            >
                                                <Plus className="w-5 h-5" />
                                                <span className="text-[10px] font-bold">ADD</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* --- SEARCH VIEW --- */
                                <div ref={searchResultsContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50/50 dark:bg-zinc-900/50">
                                    <div id="search-results-top" className="flex items-center justify-between mb-4 sticky top-0 bg-gray-50/95 dark:bg-zinc-900/95 backdrop-blur z-10 py-2 border-b border-transparent">
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
                                            <button onClick={() => setRightPaneView('notes')} className="text-xs text-blue-600 hover:underline font-medium">
                                                Close Results
                                            </button>
                                        </div>
                                    </div>

                                    {isSearching ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                                            <RotateCw className="w-6 h-6 animate-spin" />
                                            <p>{isIndexing ? `Indexing ${searchVersion.toUpperCase()}... (First run only)` : 'Searching...'}</p>
                                        </div>
                                    ) : (detailedResults.bible.length > 0 || detailedResults.sermons.length > 0 || detailedResults.notes.length > 0 || (detailedResults.web && detailedResults.web.length > 0) || (detailedResults.topics && detailedResults.topics.length > 0)) ? (
                                        <div className="space-y-8 pb-12">
                                            {/* SECTION 1: BIBLE (Use First) */}
                                            {detailedResults.bible.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                            <Book className="w-4 h-4" />
                                                            Scripture Matches ({detailedResults.bible.length})
                                                        </h4>
                                                        {detailedResults.bible.length > 3 && (
                                                            <button
                                                                onClick={() => setIsBibleExpanded(!isBibleExpanded)}
                                                                className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-wider"
                                                            >
                                                                {isBibleExpanded ? 'Show Less' : `Show All (${detailedResults.bible.length})`}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grid gap-2">
                                                        {(isBibleExpanded ? detailedResults.bible : detailedResults.bible.slice(0, 3)).map((verse, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={() => {
                                                                    openBible({ book: verse.metadata.book, chapter: verse.metadata.chapter, verse: verse.metadata.verse }, true);
                                                                }}
                                                                className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700/50 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer group"
                                                            >
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                                                                        {verse.title}
                                                                    </span>
                                                                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                                                </div>
                                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-serif">
                                                                    {verse.text || verse.description || verse.content || "Text unavailable"}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* Fade out indicator if collapsed and more exist */}
                                                    {!isBibleExpanded && detailedResults.bible.length > 3 && (
                                                        <div
                                                            onClick={() => setIsBibleExpanded(true)}
                                                            className="mt-2 text-center text-xs text-gray-400 hover:text-blue-500 cursor-pointer transition-colors border-t border-dashed border-gray-200 dark:border-zinc-800 pt-2"
                                                        >
                                                            + {detailedResults.bible.length - 3} more verses
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* SECTION 2: WEB VISUALS */}
                                            {detailedResults.web && detailedResults.web.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h4 className="text-xs font-bold text-pink-500 uppercase tracking-widest flex items-center gap-2">
                                                            <Globe className="w-4 h-4" />
                                                            Web Visuals
                                                        </h4>
                                                        <span className="text-[10px] text-gray-400 italic">Click to add to notes</span>
                                                    </div>
                                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                                        {detailedResults.web.map((img, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={() => {
                                                                    if (editor) {
                                                                        editor.chain().focus().setImage({ src: img.url }).run();
                                                                        // toast.success("Image added to notes");
                                                                    }
                                                                }}
                                                                className="relative rounded-lg overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-zinc-800 h-24 sm:h-20"
                                                            >
                                                                <img src={img.url} alt={img.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span className="text-[9px] text-white font-medium truncate w-full leading-tight">{img.title}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SECTION 2.5: VIDEOS (New) */}
                                            {detailedResults.videos && detailedResults.videos.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                                                            <Globe className="w-4 h-4" />
                                                            Videos
                                                        </h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {detailedResults.videos.map((video, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={() => setSelectedVideo({ videoId: video.videoId, title: video.title })}
                                                                className="flex gap-3 bg-white dark:bg-zinc-800 p-3 rounded-xl border border-gray-100 dark:border-zinc-700/50 shadow-sm hover:shadow-md cursor-pointer group transition-all"
                                                            >
                                                                <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                                                                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                                        <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm group-hover:bg-red-600 transition-colors">
                                                                            <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                    <h5 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1 leading-tight line-clamp-2 group-hover:text-red-500 transition-colors">
                                                                        {video.title}
                                                                    </h5>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{video.snippet}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SECTION 3: WEB INSIGHTS & TOPICS */}
                                            {detailedResults.topics && detailedResults.topics.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h4 className="text-xs font-bold text-teal-500 uppercase tracking-widest flex items-center gap-2">
                                                            <LayoutGrid className="w-4 h-4" />
                                                            Web Insights & Topics
                                                        </h4>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {detailedResults.topics.map((topic, i) => (
                                                            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700/50 p-4 shadow-sm">
                                                                <h5 className="font-bold text-gray-900 dark:text-white mb-1">{topic.title}</h5>
                                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">{topic.summary}</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {topic.sources?.map((source: any, j: number) => (
                                                                        <a
                                                                            key={j}
                                                                            href={source.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-zinc-700/50 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 rounded-md border border-gray-100 dark:border-zinc-700 transition-colors"
                                                                        >
                                                                            <span>{source.name}</span>
                                                                            <ExternalLink className="w-3 h-3" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SECTION 4: NOTES (Personal) */}
                                            {detailedResults.notes.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                                                            <Edit3 className="w-4 h-4" />
                                                            Your Notes
                                                        </h4>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        {detailedResults.notes.map((note, i) => (
                                                            <div
                                                                key={i}
                                                                className="p-4 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-900/30 hover:shadow-md transition-all cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500">
                                                                        {new Date(note.timestamp || Date.now()).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                <div className="prose prose-sm dark:prose-invert line-clamp-2 text-xs" dangerouslySetInnerHTML={{ __html: note.content || '' }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SECTION 5: SERMONS */}
                                            {detailedResults.sermons.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <h4 className="text-xs font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2">
                                                            <Mic className="w-4 h-4" />
                                                            Relevant Sermons
                                                        </h4>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        {detailedResults.sermons.map((sermon, i) => (
                                                            <div
                                                                key={i}
                                                                className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700/50 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-700 transition-all cursor-pointer group"
                                                            >
                                                                <h5 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1 group-hover:text-purple-600 transition-colors">
                                                                    {sermon.title}
                                                                </h5>
                                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                                    <span>{sermon.speaker || 'Unknown Speaker'}</span>
                                                                    <span>•</span>
                                                                    <span>{new Date(sermon.date || Date.now()).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* DYNAMIC AI SUMMARY */}
                                            <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-zinc-900 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-3 opacity-5 dark:opacity-10">
                                                    <Sparkles className="w-24 h-24" />
                                                </div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                    </div>
                                                    <h4 className="font-bold text-gray-800 dark:text-white text-sm">AI Pulse</h4>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed relative z-10">
                                                    Based on your search for <span className="font-medium text-gray-900 dark:text-white">"{searchQuery}"</span>, we found <strong>{detailedResults.bible.length}</strong> scriptures, <strong>{detailedResults.sermons.length}</strong> sermons, and <strong>{(detailedResults.web?.length || 0) + (detailedResults.topics?.length || 0)}</strong> web insights.
                                                    {(detailedResults.topics && detailedResults.topics.length > 0) && (
                                                        <span> Top resources include <em>"{detailedResults.topics[0].title}"</em> and others.</span>
                                                    )}
                                                    <span className="block mt-2 text-indigo-600 dark:text-indigo-400 font-medium">Click "Explore Rabbit Hole" to uncover hidden theological connections.</span>
                                                </p>
                                                <div className="mt-4 flex gap-2 relative z-10">
                                                    <button
                                                        onClick={() => handleAskAi(`I want to go down a biblical rabbit hole regarding "${searchQuery}". Connect this to detailed theology, original Hebrew/Greek nuances, historic context, and unexpected cross-references. I want to explore the deep connections.`)}
                                                        className="text-xs bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 transition-colors flex items-center gap-1 font-medium"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        Explore Rabbit Hole
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            searchResultsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        className="text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-3 py-1.5 rounded-full hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 text-gray-500"
                                                    >
                                                        View Sources
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 text-gray-400">
                                            <p>No results found for "{searchQuery}"</p>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : rightPaneView === 'fellowship' ? (
                            /* --- FELLOWSHIP VIEW --- */
                            <FellowshipView
                                editorProps={{
                                    content: '',
                                    onChange: (html: string) => { }, // Read-only from this level in theory, but Tiptap handles real-time
                                    collaborationId: `fellowship-${tabs.find(t => t.id === activeTabId)?.reference.book}-${tabs.find(t => t.id === activeTabId)?.reference.chapter}`,
                                    user: tiptapUser,
                                    onAskAi: handleAskAi
                                }}
                                scrollId={tabs.find(t => t.id === activeTabId)?.reference.book + ' ' + tabs.find(t => t.id === activeTabId)?.reference.chapter}
                            />
                        ) : (
                            /* --- PERSONAL NOTES VIEW --- */
                            /* --- PERSONAL NOTES VIEW --- */
                            <div className="h-full flex flex-col overflow-hidden">
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
                                <div
                                    className="h-full overflow-y-auto px-4 pt-4 pb-48 custom-scrollbar cursor-text"
                                    onClick={() => {
                                        // Safely focus editor if available
                                        if (editor && !editor.isDestroyed) {
                                            editor.chain().focus().run();
                                        }
                                    }}
                                >
                                    <TiptapEditor
                                        content={notes}
                                        onChange={handleNoteChange}
                                        placeholder="Write your study notes here..."
                                        className="min-h-full focus:outline-none max-w-none prose prose-sm dark:prose-invert text-gray-900 dark:text-gray-100"
                                        onEditorReady={setEditor}
                                        onAskAi={handleAskAi}
                                        onLinkClick={handleLinkClick}
                                        showToolbar={true} // Use internal sticky toolbar
                                        // Ensure collaborationId is undefined for personal notes
                                        collaborationId={undefined}
                                        user={tiptapUser}
                                    />
                                </div>
                            </div>
                        )}
                    </div >
                </div >

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
                        setCreateMeetingState({
                            isOpen: true,
                            topic: topic || '',
                            date: new Date().toISOString()
                        });
                        setIsAiChatOpen(false); // Close chat to show meeting modal
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
                    initialTopic={createMeetingState.topic || ''}
                    initialDate={createMeetingState.date}
                    initialDescription={editor ? editor.getHTML() : ''}
                />

            </motion.div >
        </div >
    );
}
