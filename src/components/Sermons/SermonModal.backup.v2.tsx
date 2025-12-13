'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, PlayCircle, Sparkles, Send, ChevronDown, ChevronUp, Edit3, FileText, Maximize2, Minimize2, Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Plus, Image as ImageIcon, Search } from 'lucide-react';
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'framer-motion';
import { format } from 'date-fns';
import { doc, onSnapshot, query, collection, orderBy, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { Sermon } from '@/types';
import TiptapEditor, { EditorToolbar } from '../Editor/TiptapEditor';
import AiNotesModal from './AiNotesModal';
import { cn } from '@/lib/utils';
import YouTube from 'react-youtube';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';

interface SermonModalProps {
    sermon: Sermon;
    initialMode: 'watch' | 'ai';
    onClose: () => void;
}

export default function SermonModal({ sermon, initialMode, onClose }: SermonModalProps) {
    const { user, userData } = useAuth();
    const [isAiOpen, setIsAiOpen] = useState(initialMode === 'ai');

    // "Always Portal" strategy for Desktop/Tablet (min-width: 768px)
    // This ensures video persists during scroll/docking on larger screens.
    // On mobile, we use a simpler reload/restore strategy to avoid layout issues.
    const isDesktopOrTablet = useMediaQuery('(min-width: 768px)');
    const useAlwaysPortal = isDesktopOrTablet;

    // Toggle body class for mobile layering fix
    useEffect(() => {
        document.body.classList.add('modal-open');
        return () => document.body.classList.remove('modal-open');
    }, []);

    const [notes, setNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showSummarySuggestion, setShowSummarySuggestion] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [isAiNotesModalOpen, setIsAiNotesModalOpen] = useState(false);
    const [initialAiQuery, setInitialAiQuery] = useState('');
    const [editor, setEditor] = useState<any>(null);
    const [isNotesMaximized, setIsNotesMaximized] = useState(false);

    // Helper to get YouTube ID
    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const videoId = getYoutubeId(sermon.videoUrl);

    // Floating Video Logic
    const [isFloating, setIsFloating] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const videoRef = useRef<HTMLDivElement>(null);
    const videoPlaceholderRef = useRef<HTMLDivElement>(null);
    const modalContainerRef = useRef<HTMLDivElement>(null); // Ref for drag constraints
    const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref for scroll container
    const dragControls = useDragControls();

    // Absolute Positioning Strategy for Desktop Docking (Mimics Mobile behavior but in Portal)
    const [dockedRect, setDockedRect] = useState({ top: 0, left: 0, width: 0, height: 0 });

    // Explicit Floating Position Calculation using window size for smooth number->number animation
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateSize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        // Initial set
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const floatingWidth = 320;
    const floatingHeight = 180;
    const floatingBottomMargin = 100; // Safe area for mobile nav
    const floatingRightMargin = 24;

    // Use explicit numbers to allow Framer Motion to interpolate from dockedTop (number) to floatingTop (number)
    const floatingTop = windowSize.height ? (windowSize.height - floatingHeight - floatingBottomMargin) : `calc(100% - ${floatingHeight + floatingBottomMargin}px)`;
    const floatingLeft = windowSize.width ? (windowSize.width - floatingWidth - floatingRightMargin) : `calc(100% - ${floatingWidth + floatingRightMargin}px)`;

    useEffect(() => {
        const updateRect = () => {
            if (videoPlaceholderRef.current) {
                const rect = videoPlaceholderRef.current.getBoundingClientRect();
                // Use viewport coordinates directly for fixed positioning
                setDockedRect({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                });
            }
        };

        // Initial update
        updateRect();

        // Listen for resize (layout changes) and scroll (viewport changes)
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, { capture: true }); // Capture scroll to catch all scrolls

        // Listen for scroll on the modal container specifically
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', updateRect);
        }

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, { capture: true });
            if (scrollContainer) {
                scrollContainer.removeEventListener('scroll', updateRect);
            }
        };
    }, [sermon.id]); // Re-run if sermon changes

    // ... (rest of code)



    // YouTube Player State Persistence
    const playerRef = useRef<any>(null);
    const savedVideoState = useRef({ currentTime: 0, isPlaying: false });

    // Save state before unmounting (although with Always Portal we don't unmount, we keep this for safety)
    useEffect(() => {
        const interval = setInterval(() => {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                savedVideoState.current = {
                    currentTime: playerRef.current.getCurrentTime(),
                    isPlaying: playerRef.current.getPlayerState() === 1
                };
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Intersection Observer to toggle floating
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Save state immediately before toggling
                if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                    savedVideoState.current = {
                        currentTime: playerRef.current.getCurrentTime(),
                        isPlaying: playerRef.current.getPlayerState() === 1
                    };
                }
                setIsFloating(!entry.isIntersecting);
            },
            {
                threshold: 0,
                root: null, // Viewport
                rootMargin: '-50px 0px 0px 0px' // Trigger slightly before it leaves
            }
        );

        if (videoPlaceholderRef.current) {
            observer.observe(videoPlaceholderRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Force floating when notes are maximized
    const shouldFloat = isFloating || isNotesMaximized;

    // Constraints for floating video
    const [constraints, setConstraints] = useState<any>(modalContainerRef);

    useEffect(() => {
        if (shouldFloat) {
            // Use extremely large values to effectively remove constraints while keeping the "rubber band" effect at extreme edges
            const hugeBuffer = 5000;
            setConstraints({
                top: -hugeBuffer,
                bottom: hugeBuffer,
                left: -hugeBuffer,
                right: hugeBuffer
            });
        } else {
            setConstraints(modalContainerRef);
        }
    }, [shouldFloat]);

    // Smart Tab Logic
    const [activeTabs, setActiveTabs] = useState<('left' | 'right' | 'top' | 'bottom')[]>([]);


    const handleDrag = () => {
        if (!videoRef.current) return;
        const rect = videoRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Thresholds for showing the tab (when video is mostly off-screen)
        const threshold = 200; // Increased to 200px as requested
        const newTabs: ('left' | 'right' | 'top' | 'bottom')[] = [];

        if (rect.right < threshold) newTabs.push('right'); // Off to the left
        if (rect.left > viewportWidth - threshold) newTabs.push('left'); // Off to the right
        if (rect.bottom < threshold) newTabs.push('bottom'); // Off to the top
        if (rect.top > viewportHeight - threshold) newTabs.push('top'); // Off to the bottom

        setActiveTabs(newTabs);
    };

    // Memoize opts to prevent reloading on "Always Portal" devices (ALL devices now)
    const opts = React.useMemo(() => ({
        height: '100%',
        width: '100%',
        playerVars: {
            // With Always Portal, we NEVER want to update these based on floating state,
            // because the player instance persists.
            autoplay: 0, // Initial autoplay only
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
    }), [videoId]);

    // ... (rest of code)


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
        console.log('handleOpenAiNotes called with:', query);
        let finalQuery = query || '';

        // If query is present (from selection) and doesn't look like a question, 
        // prepend "Explain: " to help the AI understand the intent.
        if (finalQuery && !finalQuery.trim().endsWith('?') && finalQuery.split(' ').length < 20) {
            finalQuery = `Explain: ${finalQuery}`;
        }

        setInitialAiQuery(finalQuery);
        setIsAiNotesModalOpen(true);
    };



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



    const isMobileDocked = !useAlwaysPortal && !shouldFloat;

    const videoContent = (
        <motion.div
            ref={videoRef}
            drag={shouldFloat}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.1}
            dragConstraints={constraints}
            onDrag={handleDrag}
            onDragEnd={handleDrag}
            initial={false}
            animate={shouldFloat ? {
                position: 'fixed',
                top: floatingTop,
                left: floatingLeft,
                width: floatingWidth,
                height: floatingHeight,
                right: 'auto',
                bottom: 'auto',
                zIndex: 100000,
                borderRadius: 12,
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
            } : {
                // Docked State
                // Mobile: Absolute (Natural Scroll inside placeholder)
                // Desktop: Fixed (Manually positioned in Portal using viewport coords)
                position: isMobileDocked ? 'absolute' : 'fixed', // Fixed for Desktop/Tablet to match viewport coords
                top: isMobileDocked ? 0 : dockedRect.top, // Desktop uses viewport top
                left: isMobileDocked ? 0 : dockedRect.left,
                width: isMobileDocked ? '100%' : dockedRect.width,
                height: isMobileDocked ? '100%' : dockedRect.height,
                bottom: 'auto',
                right: 'auto',
                x: 0,
                y: 0,
                zIndex: 50,
                borderRadius: 0,
                boxShadow: "none"
            }}
            transition={{
                type: "spring",
                damping: 30,
                stiffness: 300,
                mass: 0.8
            }}
            className={cn(
                "touch-none pointer-events-auto",
            )}
        >
            {/* Smart Drag Tabs */}
            <AnimatePresence>
                {
                    shouldFloat && activeTabs.map(tab => (
                        <motion.div
                            key={tab}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={cn(
                                "absolute w-12 h-12 flex items-center justify-center cursor-move z-0 pointer-events-auto",
                                tab === 'left' && "left-0 top-1/2 -translate-x-full -translate-y-1/2",
                                tab === 'right' && "right-0 top-1/2 translate-x-full -translate-y-1/2",
                                tab === 'top' && "top-0 left-1/2 -translate-y-full -translate-x-1/2",
                                tab === 'bottom' && "bottom-0 left-1/2 translate-y-full -translate-x-1/2"
                            )}
                            onPointerDown={(e) => { e.preventDefault(); dragControls.start(e); }}
                        >
                            <div className={cn(
                                "bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg transition-colors hover:bg-purple-600/80",
                                (tab === 'left' || tab === 'right') ? "w-8 h-12 rounded-xl" : "w-12 h-8 rounded-xl"
                            )}>
                                {/* Icon pointing towards visible area */}
                                {tab === 'left' && <ChevronDown className="w-5 h-5 text-white rotate-90" />}
                                {tab === 'right' && <ChevronDown className="w-5 h-5 text-white -rotate-90" />}
                                {tab === 'top' && <ChevronDown className="w-5 h-5 text-white" />}
                                {tab === 'bottom' && <ChevronDown className="w-5 h-5 text-white rotate-180" />}
                            </div>
                        </motion.div>
                    ))
                }
            </AnimatePresence >

            {/* Main Video Container */}
            < div className={
                cn(
                    "w-full h-full overflow-hidden bg-black relative z-10",
                    shouldFloat && "rounded-xl border border-gray-200 dark:border-zinc-700 shadow-2xl"
                )}>
                {/* Drag Handle / Header */}
                <AnimatePresence>
                    {
                        shouldFloat && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/60 to-transparent z-20 flex items-center justify-center cursor-move touch-none"
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    dragControls.start(e);
                                }}
                            >
                                {/* Visual Drag Handle (Pill) */}
                                <div className="w-12 h-1.5 bg-white/30 rounded-full backdrop-blur-sm mt-1" />

                                {/* Dock Button (Absolute Top Right) */}
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        videoPlaceholderRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="absolute right-1 top-1 p-1 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm transition-colors"
                                >
                                    <Minimize2 className="w-3 h-3" />
                                </button>
                            </motion.div>
                        )
                    }
                </AnimatePresence >

                {
                    videoId ? (
                        <div className="w-full h-full relative group z-10" >
                            <YouTube
                                videoId={videoId}
                                className="w-full h-full"
                                iframeClassName="w-full h-full"
                                onReady={(event) => {
                                    playerRef.current = event.target;
                                }}
                                opts={opts}
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white">Video unavailable</div>
                    )}
            </div >
        </motion.div >
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" ref={modalContainerRef}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10">
                    <h2 className="font-semibold text-gray-900 dark:text-white truncate pr-4">{sermon.title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors touch-manipulation cursor-pointer">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain">
                    <div className="flex flex-col min-h-full">
                        {/* Layout: Video/Info Top, Notes/Chat Bottom */}

                        {/* Top: Video & Info */}
                        <div className="bg-black/5 dark:bg-black/20">
                            {/* Video Player Section with Floating Capability */}
                            <div ref={videoPlaceholderRef} className="aspect-video bg-black w-full mx-auto max-w-5xl relative z-50">
                                {(shouldFloat || useAlwaysPortal) && typeof document !== 'undefined' ? createPortal(
                                    <div className="fixed inset-0 z-[100000] pointer-events-none">
                                        {videoContent}
                                    </div>,
                                    document.body
                                ) : videoContent}
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

                                    {/* Notes Section - Rendered via Portal when maximized to escape Modal transforms */}
                                    {(() => {
                                        const notesContent = (
                                            <div className={cn(
                                                "bg-white dark:bg-zinc-900 flex flex-col border-b border-gray-200 dark:border-zinc-800 transition-all duration-300",
                                                isNotesMaximized ? "fixed inset-0 z-[9999] bg-white dark:bg-zinc-950 h-[100dvh]" : "min-h-[1800px]"
                                            )}>
                                                <div
                                                    key={isNotesMaximized ? 'maximized' : 'minimized'}
                                                    className={cn(
                                                        "sticky top-[-1px] z-30 bg-white dark:bg-zinc-900",
                                                        !isNotesMaximized && "border-b border-gray-100 dark:border-zinc-800 shadow-sm"
                                                    )}>
                                                    <div className={cn(
                                                        "flex items-center justify-between px-4 transition-all",
                                                        isNotesMaximized ? "py-1" : "py-3 px-6"
                                                    )}>
                                                        <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                            <Edit3 className="w-4 h-4 text-blue-500" />
                                                            {isNotesMaximized ? 'Handwriting Mode' : 'My Notes'}
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            {savingNotes && <span className="text-xs text-green-600 animate-pulse">Saving...</span>}

                                                            <button
                                                                onClick={() => setIsNotesMaximized(!isNotesMaximized)}
                                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-500 touch-manipulation cursor-pointer"
                                                                title={isNotesMaximized ? "Minimize" : "Maximize for Handwriting"}
                                                            >
                                                                {isNotesMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                                            </button>

                                                            <button
                                                                onClick={() => handleOpenAiNotes()}
                                                                className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors touch-manipulation cursor-pointer font-medium text-sm z-50"
                                                            >
                                                                <Sparkles className="w-4 h-4" />
                                                                Ask AI
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Editor Toolbar - Sticky inside the header */}
                                                    <div className={cn(
                                                        "transition-all",
                                                        isNotesMaximized ? "px-4 pb-0 border-b border-gray-100 dark:border-zinc-800" : "px-6 pb-2"
                                                    )}>
                                                        <EditorToolbar
                                                            editor={editor}
                                                            className={cn(
                                                                "border-none shadow-none bg-transparent mb-0 pb-0",
                                                                isNotesMaximized && "justify-center" // Center toolbar in maximized mode for better aesthetics on tablets
                                                            )}
                                                            onInsertSticker={(url) => {
                                                                if (editor) {
                                                                    editor.chain().focus().setImage({ src: url }).run();
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar" id="note-scroll-container">
                                                    <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden min-h-full bg-white dark:bg-zinc-950">
                                                        <TiptapEditor
                                                            content={notes}
                                                            onChange={(content) => {
                                                                console.log('[SermonModal] Note content updated, length:', content.length);
                                                                handleSaveNotes(content);
                                                            }}
                                                            className={cn("p-4", isNotesMaximized && "text-lg")}
                                                            onAskAi={handleOpenAiNotes}
                                                            showToolbar={false}
                                                            onEditorReady={(editor) => {
                                                                console.log('[SermonModal] Editor ready');
                                                                setEditor(editor);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );

                                        if (isNotesMaximized && typeof document !== 'undefined') {
                                            return createPortal(notesContent, document.body);
                                        }
                                        return notesContent;
                                    })()}

                                    {/* Chat Section Removed */}

                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </motion.div>

            {/* AI Notes Modal */}
            {/* AI Notes Modal */}
            {/* AI Notes Modal - Always mounted to preserve state/context */}
            <AiNotesModal
                isOpen={isAiNotesModalOpen}
                onClose={() => {
                    console.log('Closing AI Modal, clearing query');
                    setIsAiNotesModalOpen(false);
                    setInitialAiQuery(''); // Clear query on close
                }}
                sermonId={sermon.id}
                sermonTitle={sermon.title}
                initialQuery={initialAiQuery}
                messages={messages}
                onMessagesChange={setMessages}
                onInsertToNotes={(content) => {
                    handleAddToNotes(content);
                    setIsAiNotesModalOpen(false);
                    setInitialAiQuery(''); // Clear query on close
                }}
                onSaveMessage={async (role, content) => {
                    if (!user || !sermon.id) return;
                    const noteId = `sermon_${sermon.id}`;
                    try {
                        await addDoc(collection(db, 'users', user.uid, 'notes', noteId, 'chat'), {
                            role,
                            content,
                            createdAt: serverTimestamp()
                        });
                    } catch (error) {
                        console.error('Error saving chat message:', error);
                    }
                }}
            />
        </div>
    );
}

// Helper Component for Search Popover
function SearchPopover({ initialQuery, onAddToNotes }: { initialQuery: string, onAddToNotes: (html: string) => void }) {
    // "Always Portal" works perfectly on Tablet and Desktop for seamless autoplay.
    // Mobile (Phone) has docking issues with it, so we fallback to robust Reload/Restore behavior there.

    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

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

    // Auto-search on first open
    useEffect(() => {
        if (isOpen && !hasSearched && initialQuery) {
            handleSearch();
        }
    }, [isOpen]);

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
