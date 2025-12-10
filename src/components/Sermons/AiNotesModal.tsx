'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Plus, Image as ImageIcon, Search, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { formatAiResponse } from '@/lib/utils/ai-formatting';

interface AiNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    sermonId: string;
    sermonTitle: string;
    initialQuery?: string;
    onInsertToNotes: (content: string) => void;
}

export default function AiNotesModal({ isOpen, onClose, sermonId, sermonTitle, initialQuery, onInsertToNotes }: AiNotesModalProps) {
    const { user, userData } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial Query Handling
    useEffect(() => {
        if (isOpen && initialQuery) {
            handleSendMessage(undefined, initialQuery);
        }
    }, [isOpen, initialQuery]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent, overrideInput?: string) => {
        if (e) e.preventDefault();
        const msgText = overrideInput || input;
        if (!msgText.trim() || isLoading || !user) return;

        const userMsg = { role: 'user', content: msgText };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const chatFn = httpsCallable(functions, 'chat');
            const result = await chatFn({
                message: msgText,
                history: messages.map(m => ({ role: m.role, content: m.content })),
                userName: userData?.displayName || user.displayName,
                sermonId: sermonId,
                intent: 'notes_assistant'
            }) as any;

            let aiResponse = result.data.response;

            // Strip SUGGEST_SUMMARY tag if present (though less likely to be used here, good to be safe)
            aiResponse = aiResponse.replace(/<SUGGEST_SUMMARY>/g, '').trim();

            setMessages(prev => [...prev, { role: 'model', content: aiResponse }]);

        } catch (error) {
            console.error('Error chatting with AI:', error);
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSummarize = async () => {
        if (isLoading || !user) return;
        setIsLoading(true);
        // Add a system message or user message to show action
        setMessages(prev => [...prev, { role: 'user', content: "Summarize this sermon for my notes." }]);

        try {
            const chatFn = httpsCallable(functions, 'chat');
            const result = await chatFn({
                message: "Summarize the sermon for my notes.",
                history: [], // We might want sermon history? Or just pure summarization of the transcript.
                userName: userData?.displayName || user.displayName,
                sermonId: sermonId,
                intent: 'summarize_notes'
            }) as any;

            const summary = result.data.response;
            setMessages(prev => [...prev, { role: 'model', content: summary }]);
        } catch (error) {
            console.error('Error summarizing:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
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
                className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">Notes Assistant</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-mono">v1.1</span>
                        {messages.length > 0 && (
                            <button
                                onClick={handleSummarize}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                            >
                                <Sparkles className="w-3 h-3" />
                                Save this conversation to notes?
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-zinc-900/50">
                    {messages.length === 0 && (
                        <div className="text-center space-y-4 py-8">
                            <p className="text-gray-500 dark:text-gray-400">
                                Ask Matthew to help you write notes, find scriptures, or summarize key points.
                            </p>
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={handleSummarize}
                                    className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Summarize Sermon
                                </button>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
                            <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === 'user'
                                ? 'bg-purple-600 text-white rounded-br-none'
                                : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-zinc-700 rounded-bl-none'
                                }`}>
                                {msg.role === 'model' ? (
                                    <>
                                        {/* Debug Log */}
                                        {console.log('AI Msg Content:', msg.content)}
                                        <div dangerouslySetInnerHTML={{ __html: formatAiResponse(msg.content) }} />
                                    </>
                                ) : (
                                    msg.content
                                )}

                                {/* Search Results (If search tag detected) */}
                                {msg.role === 'model' && msg.content.includes('<SEARCH>') && (
                                    <div className="mt-4">
                                        <SearchResults
                                            initialQuery={msg.content.match(/<SEARCH>([\s\S]*?)<\/SEARCH>/)?.[1]?.trim() || ''}
                                            onInsertToNotes={onInsertToNotes}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Insert Button for AI messages */}
                            {msg.role === 'model' && (
                                <button
                                    onClick={() => {
                                        onInsertToNotes(msg.content);
                                        // Optional: Show toast or feedback
                                    }}
                                    className="text-xs flex items-center gap-1 text-gray-500 hover:text-purple-600 transition-colors px-2"
                                >
                                    <Plus className="w-3 h-3" />
                                    Insert into Notes
                                </button>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-bl-none px-4 py-2.5 text-sm border border-gray-100 dark:border-zinc-700 text-gray-500 flex items-center gap-2">
                                <Sparkles className="w-3 h-3 animate-spin" />
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800">
                    <form onSubmit={(e) => handleSendMessage(e)} className="relative">
                        <input
                            id="ai-notes-input"
                            name="ai-notes-input"
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a question or type @matt..."
                            className="w-full pl-4 pr-10 py-3 bg-gray-100 dark:bg-zinc-800 rounded-full border-none focus:ring-2 focus:ring-purple-500 text-sm"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-1.5 top-1.5 p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}

// Perplexity-style Search Results Component
function SearchResults({ initialQuery, onInsertToNotes }: { initialQuery: string, onInsertToNotes: (html: string) => void }) {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (initialQuery) {
            handleSearch();
        }
    }, [initialQuery]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const searchFn = httpsCallable(functions, 'search');
            const res = await searchFn({ query: initialQuery }) as any;
            setResults(res.data.results || []);
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-gray-400 animate-pulse">
                <Search className="w-3 h-3" />
                Searching web for "{initialQuery}"...
            </div>
        );
    }

    if (results.length === 0) return null;

    const images = results.filter(r => r.thumbnail);

    return (
        <div className="space-y-4 w-full">
            {/* Sources Section */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-3 h-3 text-gray-400" />
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sources</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
                    {results.map((result, idx) => (
                        <a
                            key={idx}
                            href={result.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 w-[140px] p-3 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl transition-colors flex flex-col gap-2 group"
                        >
                            <div className="flex items-center gap-2">
                                <img
                                    src={`https://www.google.com/s2/favicons?domain=${result.displayLink || result.link}&sz=32`}
                                    alt=""
                                    className="w-4 h-4 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
                                />
                                <span className="text-[10px] text-gray-400 truncate flex-1">{result.displayLink || new URL(result.link).hostname}</span>
                            </div>
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">
                                {result.title}
                            </div>
                        </a>
                    ))}
                </div>
            </div>

            {/* Images Section */}
            {images.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-3 h-3 text-gray-400" />
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Images</h3>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
                        {images.map((img, idx) => (
                            <div key={idx} className="group relative flex-shrink-0 w-[120px] aspect-square bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all">
                                <img src={img.thumbnail} alt={img.title} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => onInsertToNotes(`<img src="${img.thumbnail}" alt="${img.title}" style="max-width: 100%; border-radius: 8px; margin: 24px 0;" /><p class="text-xs text-gray-500 text-center mb-6">${img.title}</p>`)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium text-xs backdrop-blur-sm"
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
