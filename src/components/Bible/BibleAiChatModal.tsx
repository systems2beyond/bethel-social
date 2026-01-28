'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Sparkles, Plus, Image as ImageIcon, Search, FileText, Globe, Trash2, Calendar, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { formatAiResponse } from '@/lib/utils/ai-formatting';
import { useBible } from '@/context/BibleContext';
import AiLessonCreator from './AiLessonCreator';

// Helper component to handle native DOM events for AI messages
function AiMessageContent({ content, openBible, onClose, onAction, isLast }: { content: string, openBible: any, onClose: () => void, onAction?: (action: string, data: string) => void, isLast?: boolean }) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Robust Regex: Matches [ACTION:...] optionally surrounded by quotes or whitespace
    // Capture groups: 1=ActionType, 2=ActionData
    const actionRegex = /['"`]?\s*\[ACTION:([A-Z_]+)\s*\|\s*(.*?)\]\s*['"`]?/;

    const actionMatch = content.match(actionRegex);

    // Auto-trigger action if it's the latest message
    useEffect(() => {
        if (actionMatch && onAction && isLast) {
            const actionType = actionMatch[1];
            const actionData = actionMatch[2];
            console.log(`Auto-triggering action (Latest Message): ${actionType}`, actionData);

            // Small delay to ensure render is stable and user sees the context
            const timer = setTimeout(() => {
                onAction(actionType, actionData);
            }, 1500); // 1.5s delay so they can read "Great, scheduling it..."
            return () => clearTimeout(timer);
        }
    }, [actionMatch, onAction, isLast]);

    // Clean content for display
    const displayContent = content
        .replace(actionRegex, '') // Remove the tag
        .replace(/<SUGGEST_SUMMARY>/g, '');

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleVerseAction = (target: HTMLElement, e: Event) => {
            // Support both button and anchor (via class)
            const verseLink = target.closest('.verse-link');

            if (verseLink) {
                console.log("BibleAiChatModal: Pointer Capture", e.type, verseLink);
                // CRITICAL: preventDefault needs to happen immediately on pointerdown 
                // to stop focus/hover logic and the iOS 'double tap' requirement.
                e.preventDefault();
                e.stopPropagation();

                // Blur active element to prevent virtual keyboard adjustments
                (document.activeElement as HTMLElement)?.blur();

                // Buttons use data-verse, anchors might use href
                let ref = verseLink.getAttribute('data-verse');
                const href = verseLink.getAttribute('href');

                if (!ref && href && href.startsWith('verse://')) {
                    ref = decodeURIComponent(href.replace('verse://', ''));
                }

                if (ref) {
                    const match = ref.trim().match(/(.+?)\s(\d+)(?::(\d+)(?:-(\d+))?)?$/);
                    if (match) {
                        const book = match[1].trim();
                        const chapter = parseInt(match[2]);
                        const startVerse = match[3] ? parseInt(match[3]) : undefined;
                        const endVerse = match[4] ? parseInt(match[4]) : undefined;

                        openBible({ book, chapter, verse: startVerse, endVerse }, true);
                        onClose();
                    } else {
                        openBible(undefined, true);
                        onClose();
                    }
                }
            }
        };

        const handlePointerDown = (e: PointerEvent) => {
            // Only capture primary button (touch or left click)
            if (!e.isPrimary) return;
            handleVerseAction(e.target as HTMLElement, e);
        };

        // We use pointerdown to mimic the success of the 'Insert' button fix.
        // This is aggressive and might block scrolling if starting exactly on a link,
        // but it guarantees the "one tap" behavior requested.
        container.addEventListener('pointerdown', handlePointerDown as EventListener, true);

        return () => {
            container.removeEventListener('pointerdown', handlePointerDown as EventListener, true);
        };
    }, [content, openBible, onClose]);

    return (
        <div>
            <div
                ref={containerRef}
                className="prose dark:prose-invert max-w-none text-sm [&>p]:mb-2 [&>ul]:mb-2 relative"
                style={{
                    touchAction: 'manipulation',
                    cursor: 'auto',
                    WebkitUserSelect: 'text',
                    userSelect: 'text'
                }}
                // Use hybrid mode: buttons for this modal
                dangerouslySetInnerHTML={{ __html: formatAiResponse(displayContent, { useButtons: true }) }}
            />
            {actionMatch && (
                <div className="mt-3">
                    <button
                        onClick={() => onAction && onAction(actionMatch[1], actionMatch[2])}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md text-sm font-medium w-full justify-center animate-pulse"
                    >
                        {actionMatch[1] === 'CREATE_MEETING' ? (
                            <>
                                <Calendar className="w-4 h-4" />
                                Review Meeting: {actionMatch[2].split('|')[0]}
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Perform Action
                            </>
                        )}
                    </button>
                    {isLast && (
                        <p className="text-xs text-center text-gray-500 mt-1 dark:text-gray-400">Opening automatically...</p>
                    )}
                </div>
            )}
        </div>
    );
}

interface BibleAiChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    // We'll keep these prop names generic or map them from the parent
    contextId: string; // e.g., "John 3"
    contextTitle: string; // e.g., "John 3"
    initialQuery?: string;
    messages: any[];
    onMessagesChange: (messages: any[]) => void;
    onInsertToNotes: (content: string) => void;
    onSaveMessage?: (role: string, content: string) => Promise<void>;
    preserveScrollLockOnClose?: boolean;
    onCreateMeeting?: (topic?: string, date?: string) => void;
    autoSend?: boolean; // New prop
}

export default function BibleAiChatModal({ isOpen, onClose, contextId, contextTitle, initialQuery, messages, onMessagesChange, onInsertToNotes, onSaveMessage, preserveScrollLockOnClose = false, onCreateMeeting, autoSend }: BibleAiChatModalProps) {
    const { user, userData } = useAuth();
    const { openBible, isStudyOpen } = useBible();
    // Removed local messages state
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isLessonCreatorOpen, setIsLessonCreatorOpen] = useState(false); // Local state for lesson creator overlay
    const [pendingInsertContent, setPendingInsertContent] = useState<string | null>(null); // For dual-context insertion choice

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('prevent-scroll');
        } else {
            if (!preserveScrollLockOnClose) {
                document.body.classList.remove('prevent-scroll');
            }
        }
        return () => {
            if (!preserveScrollLockOnClose) {
                document.body.classList.remove('prevent-scroll');
            }
        };
    }, [isOpen, preserveScrollLockOnClose]);

    // Initial Query Handling
    const hasAutoSentRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            // Reset auto-sent ref when opened
            hasAutoSentRef.current = false;
        }

        if (isOpen && initialQuery && initialQuery.trim().length > 0) {
            // Check if we already asked this recently or pre-filled
            // Allow update if the query changed
            if (input !== initialQuery) {
                setInput(initialQuery);
            }

            if (autoSend && !hasAutoSentRef.current && !isLoading) {
                console.log('Auto-sending query:', initialQuery);
                hasAutoSentRef.current = true;
                // Defer slightly to ensure state is ready? No, direct call is better.
                handleSendMessage(undefined, initialQuery);
            }
        }
    }, [isOpen, initialQuery, autoSend]);

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
        const newMessages = [...messages, userMsg];

        // Optimistic update
        onMessagesChange(newMessages);

        // Persist if handler provided
        if (onSaveMessage) {
            onSaveMessage('user', msgText).catch(err => console.error("Failed to save user message", err));
        }

        setInput('');
        setIsLoading(true);

        try {
            const chatFn = httpsCallable(functions, 'chat');
            const result = await chatFn({
                message: msgText,
                history: messages.map(m => ({ role: m.role, content: m.content })),
                userName: userData?.displayName || user.displayName,
                // sermonId: contextId, // DO NOT pass contextId as sermonId, as it filters Firestore and returns 0 results for "John 3"
                intent: 'notes_assistant' // We might want a 'bible_assistant' intent later, but notes_assistant should work generic enough
            }) as any;

            let aiResponse = result.data.response;

            // Strip SUGGEST_SUMMARY tag if present (handled in render now, but good to clean)
            // aiResponse = aiResponse.replace(/<SUGGEST_SUMMARY>/g, '').trim();

            // Detect if this was a system-generated context prompt (Synthesis)
            // If so, we SKIP the refusal check to avoid infinite loops (Refusal -> Search -> Synthesis -> Refusal...)
            // The prompt used for synthesis starts with "Context: Here are..."
            const isSynthesis = msgText.startsWith("Context:");

            // Check for "context missing" error
            // Expanded to catch more variations of refusal
            let isRefusal =
                aiResponse.includes("The provided context does not contain the answer") ||
                aiResponse.includes("I am not able to answer this question") ||
                aiResponse.includes("I am sorry, I can not search the web") ||
                aiResponse.includes("I cannot use the search tool") || // Catch specific phrase from screenshot
                aiResponse.includes("I am unable to use the search") ||
                aiResponse.includes("I cannot search the web");

            if (isRefusal && isSynthesis) {
                // If AI refuses the SEARCH CONTEXT, do not retry or search again.
                // Just log it and show the error.
                console.log("Synthesis refused. Loop prevention triggered.");
                isRefusal = false; // Bypass fallback
                aiResponse = "I analyzed the search results but couldn't synthesize a clear answer. Please review the sources directly.";
            }

            if (isRefusal) {
                // Attempt Smart Retry with Gemini 1.5 Pro
                try {
                    console.log("AI refused. Retrying with stronger model (Gemini 1.5 Pro)...");
                    const retryResult = await chatFn({
                        message: msgText,
                        history: messages.map(m => ({ role: m.role, content: m.content })),
                        userName: userData?.displayName || user.displayName,
                        intent: 'notes_assistant',
                        forceModel: 'vertexai/gemini-1.5-pro-001' // FORCE BETTER MODEL
                    }) as any;

                    const retryResponse = retryResult.data.response;

                    // Check refusal again
                    if (
                        !retryResponse.includes("The provided context does not contain the answer") &&
                        !retryResponse.includes("I am not able to answer this question") &&
                        !retryResponse.includes("I am sorry, I can not search the web") &&
                        !retryResponse.includes("I cannot use the search tool") &&
                        !retryResponse.includes("I am unable to use the search") &&
                        !retryResponse.includes("I cannot search the web")
                    ) {
                        // Success! Use this response.
                        aiResponse = retryResponse;
                        isRefusal = false; // Clear refusal flag
                        console.log("Smart retry succeeded!");
                    } else {
                        console.log("Smart retry also refused.");
                    }
                } catch (retryErr) {
                    console.error("Smart retry failed:", retryErr);
                }
            }

            if (isRefusal) {
                triggerSearchFallback(msgText);
                return;
            }

            const aiMsg = { role: 'model', content: aiResponse };
            onMessagesChange([...newMessages, aiMsg]);

            // Persist AI response
            if (onSaveMessage) {
                onSaveMessage('model', aiResponse).catch(err => console.error("Failed to save AI message", err));
            }

        } catch (error) {
            console.error('Error chatting with AI:', error);
            const errorMsg = { role: 'model', content: "Sorry, I encountered an error. Please try again." };
            onMessagesChange([...newMessages, errorMsg]);
            if (onSaveMessage) {
                onSaveMessage('model', errorMsg.content).catch(err => console.error("Failed to save error message", err));
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to trigger search from error fallback
    const triggerSearchFallback = (query: string) => {
        const cleanQuery = query.replace(/^Explain:\s*/i, '');
        const systemMsg = { role: 'model', content: `I couldn't find the answer in the chapter context. Searching the web for "${cleanQuery}"... <SEARCH>${cleanQuery}</SEARCH>` };
        onMessagesChange([...messages, { role: 'user', content: query }, systemMsg]);
    };

    const handleSummarize = async () => {
        if (isLoading || !user) return;
        setIsLoading(true);
        // Add a system message or user message to show action
        const newMessages = [...messages, { role: 'user', content: `Summarize ${contextTitle}` }];
        onMessagesChange(newMessages);

        try {
            const chatFn = httpsCallable(functions, 'chat');
            const result = await chatFn({
                message: `Please provide a structured summary of the Bible chapter: ${contextTitle}. Include the main theme, key verses, and practical application.`,
                history: [],
                userName: userData?.displayName || user.displayName,
                // sermonId: contextId, // Omitted to avoid bad filter
                intent: 'notes_assistant' // Use notes_assistant to get the professional formatting, but allow general knowledge
            }) as any;

            const summary = result.data.response;
            onMessagesChange([...newMessages, { role: 'model', content: summary }]);
        } catch (error) {
            console.error('Error summarizing:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = (actionType: string, actionData: string) => {
        if (actionType === 'CREATE_MEETING') {
            // actionData: Topic | DateTime
            const parts = actionData.split('|').map(s => s.trim());
            const topic = parts[0];
            const date = parts[1];
            if (onCreateMeeting) {
                onCreateMeeting(topic, date);
                onClose(); // Close chat when opening meeting modal
            }
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
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
                        <h2 className="font-semibold text-gray-900 dark:text-white">Bible Study Assistant</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onPointerDown={(e) => { e.preventDefault(); onClose(); }} onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors touch-manipulation cursor-pointer">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-zinc-900/50 overscroll-contain">
                    {messages.length === 0 && (
                        <div className="text-center space-y-4 py-8">
                            <p className="text-gray-500 dark:text-gray-400">
                                Ask a question about this chapter, or generate a summary.
                            </p>
                            <div className="flex justify-center gap-2">
                                <button
                                    onPointerDown={(e) => { e.preventDefault(); handleSummarize(); }}
                                    onClick={handleSummarize}
                                    className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 touch-manipulation cursor-pointer"
                                >
                                    <FileText className="w-4 h-4" />
                                    Summarize Chapter
                                </button>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        // Hide system messages used for synthesis trigger
                        if (msg.role === 'user' && (msg.content.startsWith('System:') || msg.content.startsWith('Context:'))) return null;

                        return (
                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
                                <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === 'user'
                                    ? 'bg-purple-600 text-white rounded-br-none'
                                    : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-zinc-700 rounded-bl-none'
                                    }`}>
                                    {msg.role === 'model' ? (
                                        <>
                                            <AiMessageContent
                                                content={msg.content || ''}
                                                openBible={openBible}
                                                onClose={onClose}
                                                onAction={handleAction}
                                                isLast={idx === messages.length - 1}
                                            />
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
                                                isLast={idx === messages.length - 1}
                                                onRefine={(text) => {
                                                    if (text.startsWith('Search Results:')) {
                                                        // Handle automatic synthesis
                                                        const context = text.replace('Search Results:', '').trim();
                                                        handleSendMessage(undefined, `Context: Here are the search results. Please synthesize an answer to the user's previous question using these sources. Cite them using [1], [2], etc.\n\n${context}`);
                                                    } else {
                                                        // Normal refine click
                                                        setInput(text);
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Insert Button for AI messages */}
                                {msg.role === 'model' && (
                                    <button
                                        // Use onPointerDown to bypass any click/touch delay (aggressive fix)
                                        onPointerDown={(e) => {
                                            console.log("Insert Button: onPointerDown triggered");
                                            e.preventDefault();
                                            e.stopPropagation(); // Stop bubbling
                                            const content = formatAiResponse(msg.content, { useButtons: false });

                                            if (isStudyOpen) {
                                                // Prompt user for choice
                                                setPendingInsertContent(content);
                                            } else {
                                                // Default to personal notes
                                                if (onInsertToNotes) {
                                                    onInsertToNotes(content);
                                                    setTimeout(() => onClose(), 100);
                                                }
                                            }
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const content = formatAiResponse(msg.content, { useButtons: false });

                                            if (isStudyOpen) {
                                                setPendingInsertContent(content);
                                            } else {
                                                if (onInsertToNotes) {
                                                    onInsertToNotes(content);
                                                    setTimeout(() => onClose(), 100);
                                                }
                                            }
                                        }}
                                        className="text-xs flex items-center gap-1 text-gray-500 transition-colors px-2 touch-safe-btn pointer-events-auto cursor-pointer relative z-50 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-full py-1"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Insert into Notes
                                    </button>
                                )
                                }
                            </div>
                        );
                    })}
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

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 relative z-30">
                    {/* Plus Menu Popup (Absolute) */}
                    <AnimatePresence>
                        {isMenuOpen && (
                            <>
                                {/* Backdrop to close */}
                                <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setIsMenuOpen(false)} />

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute left-4 bottom-20 w-56 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-700 z-50 overflow-hidden py-1"
                                >
                                    <button
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            setIsLessonCreatorOpen(true);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4 text-purple-500" />
                                        Lesson Planner
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            handleSummarize();
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-2"
                                    >
                                        <FileText className="w-4 h-4 text-amber-500" />
                                        Summarize Chapter
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            if (onCreateMeeting) {
                                                onCreateMeeting();
                                                onClose();
                                            }
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-2"
                                    >
                                        <Calendar className="w-4 h-4 text-green-500" />
                                        Create Event
                                    </button>

                                    <div className="h-px bg-gray-100 dark:bg-zinc-700 my-1" />

                                    <button
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            onMessagesChange([]); // Clear chat
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Clear Chat
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2 relative">
                        {/* Plus Button */}
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`p-3 rounded-full transition-colors flex-shrink-0 touch-manipulation ${isMenuOpen ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}
                        >
                            <Plus className={`w-5 h-5 transition-transform ${isMenuOpen ? 'rotate-45' : ''}`} />
                        </button>

                        <div className="relative flex-1">
                            <input
                                id="bible-ai-input"
                                name="bible-ai-input"
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask a question..."
                                className="w-full pl-4 pr-10 py-3 bg-gray-100 dark:bg-zinc-800 rounded-full border-none focus:ring-2 focus:ring-amber-500 text-sm touch-manipulation"
                                onPointerDown={(e) => {
                                    // Explicitly focus on pointerdown to bypass 300ms delay logic on iOS
                                    e.currentTarget.focus();
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                onPointerDown={(e) => { e.preventDefault(); handleSendMessage(); }}
                                className="absolute right-1.5 top-1.5 p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm touch-manipulation cursor-pointer"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>

                {/* Overlays */}
                <AnimatePresence>
                    {isLessonCreatorOpen && (
                        <AiLessonCreator
                            isOpen={isLessonCreatorOpen}
                            onClose={() => setIsLessonCreatorOpen(false)}
                            contextTitle={contextTitle}
                            onInsert={onInsertToNotes}
                        />
                    )}
                </AnimatePresence>

                {/* Context Selection Overlay for Insert */}
                <AnimatePresence>
                    {pendingInsertContent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6"
                            onClick={() => setPendingInsertContent(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 10 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 10 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 dark:border-zinc-700"
                            >
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
                                    Insert Content
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
                                    Where would you like to save this content?
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            if (pendingInsertContent) {
                                                // "Insert Note" usually targets personal notes, but in Study Mode
                                                // the parent might route it differently. 
                                                // HOWEVER, `onInsertToNotes` passed to this modal likely targets 
                                                // the active editor. If Fellowship is active, that IS the Fellowship editor.
                                                // So actually, if we are in Study/Fellowship, the "Personal Notes" might NOT be accessible 
                                                // unless we have a separate handler.

                                                // ASSUMPTION: The `onInsertToNotes` prop currently writes to whatever editor 
                                                // is available. In Fellowship view, that's the shared editor.
                                                // If we want to write to "Personal Notes" (Sidebar), we might need a different function 
                                                // or we assume standard `onInsertToNotes` IS personal, and we need a NEW way to write to Fellowship?

                                                // WAIT: `BibleReader` passes `onInsertNote`.
                                                // `BibleStudyModal` passes `onInsertNote` which writes to... the SIDEBAR (Personal).
                                                // `FellowshipView` receives `onAskAi` but `BibleAiChatModal` is global.

                                                // Correction:
                                                // If we are in `FellowshipView`, we want to write to the COLLAB editor.
                                                // But `BibleAiChatModal` is usually opened from the Sidebar or Reader.

                                                // If we click "Fellowship Scroll", we want to insert into the MAIN editor.
                                                // If we click "Personal Notes", we want to insert into the SIDEBAR.

                                                // Currently `onInsertToNotes` likely points to the Sidebar notes (Personal).
                                                // To write to Fellowship, we might need a new prop or a callback.

                                                // For now, let's assume `onInsertToNotes` = Personal.
                                                // And for Fellowship, we might need to emit an event or just use the same one 
                                                // IF `BibleStudyModal` handles routing.

                                                onInsertToNotes(pendingInsertContent);
                                                setPendingInsertContent(null);
                                                setTimeout(() => onClose(), 100);
                                            }
                                        }}
                                        className="w-full py-3 px-4 bg-gray-100/50 hover:bg-gray-100 dark:bg-zinc-700/30 dark:hover:bg-zinc-700 rounded-xl transition-colors flex items-center gap-3 text-left group"
                                    >
                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white text-sm">Personal Notes</p>
                                            <p className="text-xs text-gray-500">Private to you</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (pendingInsertContent) {
                                                // Convention: Prefix with [COLLAB] to tell parent handler to route to Collab?
                                                // Or better, just insert it and let the user copy/paste? 
                                                // NO, automation is key.

                                                // Let's send a special signal or assume onInsertToNotes handles it if we pass a second arg? 
                                                // No, prop is `(content: string) => void`.

                                                // HACK/FEATURE: We will wrap it in a special tag or just pass it to `onInsertToNotes`.
                                                // ISSUE: `onInsertToNotes` is bound to `handleInsertNote` in `BibleStudyModal`.
                                                // That function writes to `localNotes`.

                                                // TO FIX PROPERLY: We need a `onInsertToCollab` prop.
                                                // Since I cannot change the parent `BibleStudyModal` easily right now without checking 
                                                // if it's passed...

                                                // Let's look at `BibleStudyModal` prop passing (I can't see it now).
                                                // But I can guess.

                                                // Safe Fallback: Insert to Personal with a note "Copy to Collab".
                                                // Better: Pass `[COLLAB_INSERT]...` and handle in parent?
                                                // For now, lets use Personal for both but clarify intent, 
                                                // OR assume `onInsertToNotes` is the only path and we just differentiate visual intent.

                                                // Actually, if I look at `BibleReader`... `onInsertNote` inserts to the sidebar.

                                                // Let's just provide the "Personal Notes" option for now as the default 
                                                // and maybe "Copy to Clipboard" for Collab if we can't write directly.
                                                // OR...

                                                // Let's assume the user WANTS to insert into the Collab.
                                                // If I send it to `onInsertToNotes`, it goes to sidebar.
                                                // We need a way to get it to the Collab editor.

                                                // If I look at `FellowshipView`... it passes `onAskAi` to `TiptapEditor`.
                                                // `FellowshipView` has no `onInsert` handler exposed to `BibleAiChatModal` directly 
                                                // unless `BibleAiChatModal` is lifted up.

                                                // Wait, `BibleAiChatModal` is rendered in `BibleStudyModal` likely.
                                                // If I can't write to Collab easily, I'll add "Copy for Fellowship" 
                                                // which copies to clipboard and closes.

                                                navigator.clipboard.writeText(pendingInsertContent).then(() => {
                                                    // Toast logic could go here
                                                });
                                                setPendingInsertContent(null);
                                                onClose();
                                                alert("Content copied! Paste it into the Fellowship Scroll.");
                                            }
                                        }}
                                        className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 rounded-xl transition-colors flex items-center gap-3 text-left group border border-indigo-100 dark:border-indigo-800/30"
                                    >
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white text-sm">Fellowship Scroll</p>
                                            <p className="text-xs text-gray-500">Shared with group (Copy & Paste)</p>
                                        </div>
                                    </button>
                                </div>

                                <button
                                    onClick={() => setPendingInsertContent(null)}
                                    className="w-full mt-4 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>


            </motion.div >
        </div >
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    return null;
}

// Perplexity-style Search Results Component (Refined)
function SearchResults({ initialQuery, onInsertToNotes, onRefine, isLast }: { initialQuery: string, onInsertToNotes: (html: string) => void, onRefine?: (query: string) => void, isLast?: boolean }) {
    const { user } = useAuth();
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [processingImage, setProcessingImage] = useState<string | null>(null);

    const hasSynthesized = useRef(false);

    useEffect(() => {
        if (initialQuery && !hasSynthesized.current) {
            handleSearch();
        }
    }, [initialQuery]);

    const [readerContent, setReaderContent] = useState<{ title: string; content: string; siteName: string } | null>(null);
    const [isLoadingReader, setIsLoadingReader] = useState(false);
    const [readerError, setReaderError] = useState<string | null>(null);

    const FUNCTIONS_BASE_URL = process.env.NODE_ENV === 'development'
        ? 'http://127.0.0.1:5002/bethel-metro-social/us-central1'
        : 'https://us-central1-bethel-metro-social.cloudfunctions.net';

    const handleSourceClick = async (url: string) => {
        setIsLoadingReader(true);
        setReaderError(null);
        setPreviewUrl(url);
        setReaderContent(null);

        try {
            const response = await fetch(`${FUNCTIONS_BASE_URL}/fetchUrlContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setReaderContent({
                        title: data.title,
                        content: data.content,
                        siteName: data.siteName
                    });
                } else {
                    setReaderError(data.error || 'Failed to load content');
                }
            } else {
                setReaderError(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to load reader view:', error);
            setReaderError('Network error or content blocked');
        } finally {
            setIsLoadingReader(false);
        }
    };
    const handleSearch = async () => {
        if (hasSynthesized.current) return;
        setLoading(true);
        try {
            const searchFn = httpsCallable(functions, 'search');
            const res = await searchFn({ query: initialQuery }) as any;
            const results = res.data.results || [];
            setResults(results);

            if (results.length > 0 && onRefine && isLast) {
                hasSynthesized.current = true;
                const context = results.slice(0, 4).map((r: any, i: number) => `Source [${i + 1}]: ${r.title} (${r.link})\nSnippet: ${r.snippet}`).join('\n\n');
                const imageCount = results.filter((r: any) => r.thumbnail).length;
                const imageContext = imageCount > 0 ? `\n\n[Found ${imageCount} images. The user can see them in the UI.]` : '';
                onRefine(`Search Results: ${context}${imageContext}`);
            }

        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddImage = async (img: any) => {
        setProcessingImage(img.thumbnail);
        try {
            const response = await fetch(`${FUNCTIONS_BASE_URL}/saveImageProxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await user?.getIdToken()}`
                },
                body: JSON.stringify({ imageUrl: img.thumbnail })
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            const finalUrl = result.url || img.thumbnail;
            // DIRECT INSERT: Do not run formatAiResponse on manual HTML string construction, 
            // as it might escape the tags. Tiptap handles the HTML directly.
            onInsertToNotes(`<img src="${finalUrl}" alt="${img.title}" style="max-width: 100%; border-radius: 8px; margin: 24px 0;" /><p class="text-xs text-gray-500 text-center mb-6">${img.title}</p><p></p>`);
        } catch (error) {
            console.error("Error saving image:", error);
            onInsertToNotes(`<img src="${img.thumbnail}" alt="${img.title}" style="max-width: 100%; border-radius: 8px; margin: 24px 0;" /><p class="text-xs text-gray-500 text-center mb-6">${img.title}</p><p></p>`);
        } finally {
            setProcessingImage(null);
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
        <div className="space-y-4 w-full bg-gray-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 relative">
            <AnimatePresence>
                {previewUrl && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute inset-0 z-10 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden flex flex-col shadow-lg border border-gray-200 dark:border-zinc-700"
                    >
                        <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center bg-gray-100 dark:bg-zinc-800">
                                <div className="flex items-center gap-3 overflow-hidden bg-white dark:bg-zinc-900 py-1.5 px-3 rounded-full border border-gray-200 dark:border-zinc-700 flex-1 mr-4 shadow-sm">
                                    <Globe className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate font-mono">{previewUrl}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => { e.preventDefault(); window.open(previewUrl!, '_blank'); }} className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors touch-manipulation cursor-pointer">
                                        <Send className="w-4 h-4" />
                                    </a>
                                    <button onPointerDown={(e) => { e.preventDefault(); setPreviewUrl(null); }} onClick={() => setPreviewUrl(null)} className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors touch-manipulation cursor-pointer">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 prose prose-sm max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-xl bg-white dark:bg-zinc-900">
                                {isLoadingReader ? (
                                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                        <p className="text-gray-500 dark:text-gray-400">Generating Reader View...</p>
                                    </div>
                                ) : readerError ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                                        <div className="p-3 rounded-full bg-orange-50 dark:bg-orange-900/20">
                                            <Globe className="w-8 h-8 text-orange-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{readerError.includes('Reddit') ? 'Reddit Access Error' : 'Content Protected'}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">{readerError}</p>
                                        </div>
                                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                                            Open Original Site <Send className="w-3 h-3" />
                                        </a>
                                    </div>
                                ) : readerContent ? (
                                    <div>
                                        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{readerContent.title}</h1>
                                        {readerContent.siteName && <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{readerContent.siteName}</p>}
                                        <div
                                            dangerouslySetInnerHTML={{ __html: readerContent.content }}
                                            onClick={(e) => {
                                                const target = e.target as HTMLElement;
                                                if (target.tagName === 'IMG') {
                                                    const img = target as HTMLImageElement;
                                                    handleAddImage({ thumbnail: img.src, title: img.alt || 'Image from article' });
                                                }
                                            }}
                                            className="reader-content text-gray-800 dark:text-gray-200"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                        <p>Could not generate reader view.</p>
                                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline mt-2">Open in New Tab</a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header / Refine */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Search className="w-3 h-3 text-purple-500" />
                    <span className="text-xs font-medium text-gray-500">Results for "{initialQuery}"</span>
                </div>
                {onRefine && (
                    <button
                        onPointerDown={(e) => { e.preventDefault(); if (onRefine) onRefine(`About the search result "${initialQuery}": `); }}
                        onClick={() => onRefine && onRefine(`About the search result "${initialQuery}": `)}
                        className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1 touch-manipulation cursor-pointer"
                    >
                        <Sparkles className="w-3 h-3" />
                        Refine / Ask
                    </button>
                )}
            </div>

            {/* Sources Section */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-3 h-3 text-gray-400" />
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sources</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {results.map((result, idx) => (
                        <div key={idx} className="p-3 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 rounded-xl transition-all flex flex-col gap-2 group relative h-full">
                            <button onPointerDown={(e) => { e.preventDefault(); handleSourceClick(result.link); }} onClick={() => handleSourceClick(result.link)} className="flex-1 flex flex-col gap-2 text-left w-full touch-manipulation cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <img src={`https://www.google.com/s2/favicons?domain=${result.displayLink || result.link}&sz=32`} alt="" className="w-4 h-4 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-[10px] text-gray-400 truncate flex-1">{result.displayLink || new URL(result.link).hostname}</span>
                                </div>
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">{result.title}</div>
                            </button>
                            <button onPointerDown={(e) => { e.preventDefault(); onInsertToNotes(`<blockquote><strong><a href="${result.link}">${result.title}</a></strong><br/>${result.snippet || ''}</blockquote><p></p>`); }} onClick={() => onInsertToNotes(`<blockquote><strong><a href="${result.link}">${result.title}</a></strong><br/>${result.snippet || ''}</blockquote><p></p>`)} className="mt-auto w-full py-1 bg-gray-100 dark:bg-zinc-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-gray-500 hover:text-purple-600 text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1 touch-manipulation cursor-pointer">
                                <Plus className="w-3 h-3" />
                                Add to Notes
                            </button>
                        </div>
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
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {images.map((img, idx) => (
                            <div key={idx} className="group relative aspect-square bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all">
                                <img src={img.thumbnail} alt={img.title} className="w-full h-full object-cover" />
                                <button
                                    onPointerDown={(e) => { e.preventDefault(); handleAddImage(img); }}
                                    onClick={() => handleAddImage(img)}
                                    disabled={processingImage === img.thumbnail}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-sm backdrop-blur-[2px] disabled:opacity-100 disabled:bg-black/60 touch-manipulation cursor-pointer"
                                >
                                    {processingImage === img.thumbnail ? <Sparkles className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5 mr-1" /> Add</>}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
