'use client';

import React, { useEffect, useState, useRef } from 'react';
import { X, Calendar, PlayCircle, Sparkles, Send, ChevronDown, ChevronUp, Edit3, FileText, Maximize2, Minimize2, Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Plus, Image as ImageIcon, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { doc, onSnapshot, query, collection, orderBy, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { Sermon } from '@/types';
import TiptapEditor from '@/components/Editor/TiptapEditor';
import AiNotesModal from './AiNotesModal';

interface SermonModalProps {
    sermon: Sermon;
    initialMode: 'watch' | 'ai';
    onClose: () => void;
}

export default function SermonModal({ sermon, initialMode, onClose }: SermonModalProps) {
    const { user, userData } = useAuth();
    const [isAiOpen, setIsAiOpen] = useState(initialMode === 'ai');
    const [notes, setNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showSummarySuggestion, setShowSummarySuggestion] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [isAiNotesModalOpen, setIsAiNotesModalOpen] = useState(false);
    const [initialAiQuery, setInitialAiQuery] = useState('');

    // Scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Register Context Handler for Global Chat
    const { registerContextHandler } = useChat();

    // Register handler whenever SermonModal is open so the global bar can trigger the AI modal
    useEffect(() => {
        registerContextHandler((msg) => handleOpenAiNotes(msg));
        return () => registerContextHandler(null);
    }, [registerContextHandler]); // Removed isAiNotesModalOpen dependency

    useEffect(() => {
        if (isAiOpen) {
            scrollToBottom();
        }
    }, [messages, isAiOpen]);

    // Fetch User Notes & Chat History
    useEffect(() => {
        if (!user || !sermon.id) return;

        const noteId = `sermon_${sermon.id}`;

        // 1. Fetch Notes
        const noteRef = doc(db, 'users', user.uid, 'notes', noteId);
        const unsubscribeNotes = onSnapshot(noteRef, (doc) => {
            if (doc.exists()) {
                // Handle both 'content' (new unified) and 'notes' (legacy) fields if needed
                // But for now we just set content.
                setNotes(doc.data().content || '');
            }
        });

        // 2. Fetch Chat History (Subcollection of the note)
        const chatQuery = query(
            collection(db, 'users', user.uid, 'notes', noteId, 'chat'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setMessages(msgs);
        });

        return () => {
            unsubscribeNotes();
            unsubscribeChat();
        };
    }, [user, sermon.id]);

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Save Notes (Debounced)
    const handleSaveNotes = (newNotes: string) => {
        setNotes(newNotes);
        setSavingNotes(true);

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            if (!user || !sermon.id) return;

            try {
                const noteId = `sermon_${sermon.id}`;
                const noteRef = doc(db, 'users', user.uid, 'notes', noteId);
                await setDoc(noteRef, {
                    title: `Notes: ${sermon.title}`,
                    content: newNotes,
                    sermonId: sermon.id,
                    sermonTitle: sermon.title,
                    sermonDate: sermon.date,
                    type: 'sermon',
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            } catch (error) {
                console.error('Error saving notes:', error);
            } finally {
                setSavingNotes(false);
            }
        }, 1500); // 1.5s debounce
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Handle AI Chat
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || aiLoading || !user) return;

        const userMsg = input;
        setInput('');
        setAiLoading(true);
        setShowSummarySuggestion(false); // Reset suggestion on new message

        const noteId = `sermon_${sermon.id}`;

        try {
            await addDoc(collection(db, 'users', user.uid, 'notes', noteId, 'chat'), {
                role: 'user',
                content: userMsg,
                createdAt: serverTimestamp()
            });

            const chatFn = httpsCallable(functions, 'chat');
            const result = await chatFn({
                message: userMsg,
                history: messages.map(m => ({ role: m.role, content: m.content })),
                userName: userData?.displayName || user.displayName,
                sermonId: sermon.id
            }) as any;

            let aiResponse = result.data.response;
            let hasSuggestion = false;

            // Check for Summary Suggestion Tag
            if (aiResponse.includes('<SUGGEST_SUMMARY>')) {
                setShowSummarySuggestion(true);
                hasSuggestion = true;
                aiResponse = aiResponse.replace('<SUGGEST_SUMMARY>', '').trim();
            }

            await addDoc(collection(db, 'users', user.uid, 'notes', noteId, 'chat'), {
                role: 'model',
                content: aiResponse,
                hasSuggestion: hasSuggestion,
                createdAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error chatting with AI:', error);
        } finally {
            setAiLoading(false);
        }
    };

    // Handle opening AI Notes Modal
    const handleOpenAiNotes = (query?: string) => {
        setInitialAiQuery(query || '');
        setIsAiNotesModalOpen(true);
    };

    // Helper to get YouTube ID
    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const videoId = getYoutubeId(sermon.videoUrl);

    // Helper to format AI response (Markdown to HTML)
    const formatAiResponse = (text: string) => {
        const lines = text.split('\n');
        let html = '';
        let inList = false;

        // Shared Header Style
        const headerStyle = "background-color: rgba(168, 85, 247, 0.15); padding: 4px 8px; border-radius: 6px; display: inline-block; margin-top: 24px; margin-bottom: 8px; color: #9333ea; font-weight: 600;";

        lines.forEach((line, index) => {
            let processedLine = line.trim();
            if (!processedLine) return;

            // Detect "Pseudo-Headers" (Lines that are just bold text)
            // e.g. "**Title**" or "**Title:**"
            const isBoldHeader = /^\*\*(.*?)\*\*[:]?$/.test(processedLine);

            if (isBoldHeader) {
                const headerText = processedLine.replace(/^\*\*/, '').replace(/\*\*[:]?$/, '');
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3 style="${headerStyle}">${headerText}</h3>`;
                return;
            }

            // Bold
            processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // Italic
            processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');

            // Headers (Highlighter Style + Spacing)
            // We use inline styles to ensure Tiptap/HTML renders it correctly without needing new CSS classes
            // const headerStyle = "background-color: rgba(168, 85, 247, 0.15); padding: 4px 8px; border-radius: 6px; display: inline-block; margin-top: 24px; margin-bottom: 8px; color: #9333ea;"; // Purple-600-ish
            const darkHeaderStyle = "background-color: rgba(168, 85, 247, 0.2); color: #d8b4fe;"; // Purple-300-ish for dark mode (handled via CSS classes usually, but inline is tricky. Let's stick to a neutral highlight or rely on Tiptap's prose classes if possible. 
            // Actually, let's use a generic highlight that works in both or just standard spacing if we can't do dark mode inline easily.
            // The user liked the "digital note" look which had colorful highlights. Let's try a soft purple highlight.

            if (processedLine.startsWith('### ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3 style="${headerStyle}">${processedLine.substring(4)}</h3>`;
            } else if (processedLine.startsWith('## ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h2 style="${headerStyle} font-size: 1.2em;">${processedLine.substring(3)}</h2>`;
            } else if (processedLine.startsWith('# ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h1 style="${headerStyle} font-size: 1.4em;">${processedLine.substring(2)}</h1>`;
            }
            // List Items
            else if (processedLine.startsWith('* ') || processedLine.startsWith('- ')) {
                if (!inList) { html += '<ul style="margin-bottom: 16px; padding-left: 20px;">'; inList = true; }
                html += `<li style="margin-bottom: 4px;">${processedLine.substring(2)}</li>`;
            }
            // Regular Text
            else {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<p style="margin-bottom: 12px; line-height: 1.6;">${processedLine}</p>`;
            }
        });

        if (inList) { html += '</ul>'; }

        return html;
    };

    // Add content to notes
    const handleAddToNotes = (contentToAdd: string) => {
        // If content looks like markdown (has ** or * or #), format it. 
        // Otherwise, if it's already HTML (has <), leave it. 
        // Or just run it through formatter if it's not an image tag.

        let formattedContent = contentToAdd;
        if (!contentToAdd.trim().startsWith('<')) {
            formattedContent = formatAiResponse(contentToAdd);
        }

        const newNotes = notes ? `${notes}${formattedContent}` : `${formattedContent}`;
        handleSaveNotes(newNotes);
    };

    // Summarize Chat
    const handleSummarizeChat = async () => {
        if (messages.length === 0 || aiLoading || !user) return;
        setAiLoading(true);
        setShowSummarySuggestion(false); // Hide suggestion after clicking

        try {
            const chatFn = httpsCallable(functions, 'chat');
            const result = await chatFn({
                message: "Summarize the conversation.", // Message is less important now, intent drives the behavior
                history: messages.map(m => ({ role: m.role, content: m.content })),
                userName: userData?.displayName || user.displayName,
                sermonId: sermon.id,
                intent: 'summarize_notes'
            }) as any;

            const summary = result.data.response;
            const headerStyle = "background-color: rgba(168, 85, 247, 0.15); padding: 4px 8px; border-radius: 6px; display: inline-block; margin-top: 24px; margin-bottom: 8px; color: #9333ea; font-weight: 600;";

            // Add summary to notes
            handleAddToNotes(`<h3 style="${headerStyle}">Chat Summary:</h3>${formatAiResponse(summary)}`);

            // Optionally add the summary as a new AI message too
            const noteId = `sermon_${sermon.id}`;
            await addDoc(collection(db, 'users', user.uid, 'notes', noteId, 'chat'), {
                role: 'model',
                content: `I've added a summary of our chat to your notes!`,
                createdAt: serverTimestamp()
            });
            setMessages(prev => [...prev, { id: 'temp-summary', role: 'model', content: "I've added a summary of our chat to your notes!" }]);


        } catch (error) {
            console.error('Error summarizing chat:', error);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10">
                    <h2 className="font-semibold text-gray-900 dark:text-white truncate pr-4">{sermon.title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col min-h-full">
                        {/* Layout: Video/Info Top, Notes/Chat Bottom */}

                        {/* Top: Video & Info */}
                        <div className="bg-black/5 dark:bg-black/20">
                            {/* Video Player */}
                            <div className="aspect-video bg-black w-full mx-auto max-w-5xl">
                                {videoId ? (
                                    <iframe
                                        className="w-full h-full"
                                        src={`https://www.youtube.com/embed/${videoId}`}
                                        title={sermon.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white">Video unavailable</div>
                                )}
                            </div>

                            <div className="p-6 space-y-6 max-w-4xl mx-auto">
                                {/* Metadata */}
                                <div>
                                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        {sermon.date ? (
                                            typeof sermon.date === 'string'
                                                ? format(new Date(sermon.date), 'MMMM d, yyyy')
                                                : format(new Date(sermon.date.seconds * 1000), 'MMMM d, yyyy')
                                        ) : 'Unknown Date'}
                                    </div>
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{sermon.summary}</p>
                                </div>

                                {/* Outline */}
                                {sermon.outline && sermon.outline.length > 0 && (
                                    <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-6 border border-gray-100 dark:border-zinc-800">
                                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-500" />
                                            Sermon Outline
                                        </h3>
                                        <ul className="space-y-3">
                                            {sermon.outline.map((point, idx) => (
                                                <li key={idx} className="flex gap-3 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                                        {idx + 1}
                                                    </span>
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom: Notes & AI Workspace */}
                        <div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                            <div className="max-w-4xl mx-auto">
                                <div className="flex flex-col bg-gray-200 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-800">

                                    {/* Notes Section */}
                                    <div className="bg-white dark:bg-zinc-900 flex flex-col min-h-[500px] border-b border-gray-200 dark:border-zinc-800">
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
                                            <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Edit3 className="w-4 h-4 text-blue-500" />
                                                My Notes
                                            </label>
                                            <div className="flex items-center gap-2">
                                                {savingNotes && <span className="text-xs text-green-600 animate-pulse">Saving...</span>}
                                                <button
                                                    onClick={() => handleOpenAiNotes()}
                                                    className="text-xs flex items-center gap-1 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full hover:bg-purple-100 transition-colors"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    Ask AI
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                            <TiptapEditor
                                                content={notes}
                                                onChange={handleSaveNotes}
                                                className="min-h-[400px]"
                                                onAskAi={handleOpenAiNotes}
                                            />
                                        </div>
                                    </div>

                                    {/* Chat Section Removed */}

                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </motion.div>

            {/* AI Notes Modal */}
            <AiNotesModal
                isOpen={isAiNotesModalOpen}
                onClose={() => setIsAiNotesModalOpen(false)}
                sermonId={sermon.id}
                sermonTitle={sermon.title}
                initialQuery={initialAiQuery}
                onInsertToNotes={(content) => {
                    handleAddToNotes(content);
                    setIsAiNotesModalOpen(false);
                }}
            />
        </div>
    );
}

// Helper Component for Search Popover
function SearchPopover({ initialQuery, onAddToNotes }: { initialQuery: string, onAddToNotes: (html: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Auto-search on first open
    useEffect(() => {
        if (isOpen && !hasSearched && initialQuery) {
            handleSearch();
        }
    }, [isOpen]);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const searchFn = httpsCallable(functions, 'search');
            const res = await searchFn({ query }) as any;
            setResults(res.data.results || []);
            setHasSearched(true);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 text-gray-400 hover:text-purple-600 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-gray-100 dark:border-zinc-700"
                title="View Related Media"
            >
                <ImageIcon className="w-3.5 h-3.5" />
            </button>

            {isOpen && (
                <div className="absolute right-full mr-2 top-0 w-72 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 p-3 z-50">
                    <div className="flex items-center gap-2 mb-3">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="flex-1 text-xs bg-gray-100 dark:bg-zinc-800 border-none rounded-md px-2 py-1.5 focus:ring-1 focus:ring-purple-500"
                            placeholder="Search images..."
                        />
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md hover:bg-purple-200"
                        >
                            {loading ? <Sparkles className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {results.map((img, idx) => (
                            <div key={idx} className="group relative aspect-square bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all">
                                <img src={img.thumbnail} alt={img.title} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => {
                                        onAddToNotes(`<img src="${img.link}" alt="${img.title}" style="max-width: 100%; border-radius: 8px; margin: 24px 0;" /><p class="text-xs text-gray-500 text-center mb-6">${img.title}</p>`);
                                        setIsOpen(false);
                                    }}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium text-xs"
                                >
                                    Add
                                </button>
                            </div>
                        ))}
                        {!loading && results.length === 0 && hasSearched && (
                            <div className="col-span-2 text-center text-xs text-gray-400 py-4">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
