'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Trash2, Save, MessageSquare, Maximize2, Minimize2, ChevronLeft, Search, FileText } from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import { useBible } from '@/context/BibleContext';
import TiptapEditor, { TiptapEditorRef } from '@/components/Editor/TiptapEditor';
import AiNotesModal from '@/components/Sermons/AiNotesModal';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: any;
}

export default function NotesPage() {
    const { user, loading } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isAiNotesModalOpen, setIsAiNotesModalOpen] = useState(false);
    const [initialAiQuery, setInitialAiQuery] = useState('');
    const [chats, setChats] = useState<Record<string, any[]>>({});
    const [isMaximized, setIsMaximized] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Responsive State
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [showEditorMobile, setShowEditorMobile] = useState(false);

    // Register Context Handler for Global Chat
    const { registerContextHandler } = useChat();
    const { openBible } = useBible();

    const handleLinkClick = (href: string) => {
        if (href.startsWith('verse://')) {
            const ref = decodeURIComponent(href.replace('verse://', ''));
            const match = ref.match(/((?:[123]\s)?[A-Z][a-z]+\.?)\s(\d+):(\d+)(?:-(\d+))?/);
            if (match) {
                const book = match[1].trim();
                const chapter = parseInt(match[2]);
                const startVerse = parseInt(match[3]);
                const endVerse = match[4] ? parseInt(match[4]) : undefined;
                openBible({ book, chapter, verse: startVerse, endVerse }, true);
            }
        } else {
            window.open(href, '_blank');
        }
    };

    const editorRef = React.useRef<TiptapEditorRef>(null);

    // Load notes
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'users', user.uid, 'notes'),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Note[];
            setNotes(notesData);
        });

        return () => unsubscribe();
    }, [user]);

    // Load active note into editor
    useEffect(() => {
        if (activeNoteId) {
            const note = notes.find(n => n.id === activeNoteId);
            if (note) {
                setTitle(note.title);
                setContent(note.content);
                if (isMobile) setShowEditorMobile(true);
            }
        } else {
            setTitle('');
            setContent('');
        }
    }, [activeNoteId, notes, isMobile]);

    // Register handler whenever NotesPage is active (and a note is selected)
    useEffect(() => {
        if (activeNoteId) {
            registerContextHandler((msg) => handleOpenAiNotes(msg));
        } else {
            registerContextHandler(null);
        }
        return () => registerContextHandler(null);
    }, [activeNoteId, registerContextHandler]);

    const handleOpenAiNotes = (query?: string) => {
        setInitialAiQuery(query || '');
        setIsAiNotesModalOpen(true);
    };

    const handleCreateNote = async () => {
        if (!user) return;
        const docRef = await addDoc(collection(db, 'users', user.uid, 'notes'), {
            title: 'Untitled Note',
            content: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        setActiveNoteId(docRef.id);
        if (isMobile) setShowEditorMobile(true);
    };

    const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Auto-save with debounce
    const debouncedSave = (newTitle: string, newContent: string) => {
        setIsSaving(true);

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            if (!user || !activeNoteId) return;

            try {
                await updateDoc(doc(db, 'users', user.uid, 'notes', activeNoteId), {
                    title: newTitle,
                    content: newContent,
                    updatedAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Error saving note:", error);
            } finally {
                setIsSaving(false);
            }
        }, 1500);
    };

    const handleAddToNotes = (text: string) => {
        if (!activeNoteId) return;

        if (editorRef.current) {
            editorRef.current.insertContent(text);
        } else {
            // Fallback if editor not ready (unlikely when modal is open)
            const newContent = content + '\n\n' + text;
            setContent(newContent);
            debouncedSave(title, newContent);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        debouncedSave(newTitle, content);
    };

    const handleContentChange = (newContent: string) => {
        setContent(newContent);
        debouncedSave(title, newContent);
    };

    // Manual save (immediate)
    const handleManualSave = async () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (!user || !activeNoteId) return;

        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid, 'notes', activeNoteId), {
                title,
                content,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error saving note:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!user || !confirm('Are you sure you want to delete this note?')) return;

        await deleteDoc(doc(db, 'users', user.uid, 'notes', id));
        if (activeNoteId === id) {
            setActiveNoteId(null);
            setShowEditorMobile(false);
        }
    };

    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
                <p className="text-gray-600 mb-8">You need to be logged in to access your sermon notes.</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden">
            {/* Left Sidebar: Note List */}
            <div className={cn(
                "flex flex-col bg-gray-50/50 dark:bg-zinc-900/50 border-r border-gray-200 dark:border-zinc-800 transition-all duration-300",
                isMobile ? (showEditorMobile ? "hidden" : "w-full") : "w-80"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                            My Notes
                        </h2>
                        <button
                            onClick={handleCreateNote}
                            className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {filteredNotes.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No notes found</p>
                        </div>
                    ) : (
                        filteredNotes.map(note => (
                            <div
                                key={note.id}
                                onClick={() => {
                                    setActiveNoteId(note.id);
                                    if (isMobile) setShowEditorMobile(true);
                                }}
                                className={cn(
                                    "p-4 rounded-xl cursor-pointer group relative transition-all duration-200 border",
                                    activeNoteId === note.id
                                        ? "bg-white dark:bg-zinc-800 shadow-md border-purple-100 dark:border-purple-900/30 ring-1 ring-purple-500/20"
                                        : "bg-transparent border-transparent hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm hover:border-gray-100 dark:hover:border-zinc-700"
                                )}
                            >
                                <h3 className={cn(
                                    "font-semibold text-sm truncate pr-6 mb-1",
                                    activeNoteId === note.id ? "text-purple-700 dark:text-purple-300" : "text-gray-900 dark:text-gray-100"
                                )}>
                                    {note.title || 'Untitled Note'}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate line-clamp-2 h-8">
                                    {note.content.replace(/<[^>]*>/g, '') || 'No content'}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        {note.updatedAt?.toDate().toLocaleDateString()}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(e, note.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Center: Editor */}
            <div className={cn(
                "flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 transition-all duration-300",
                isMobile ? (showEditorMobile ? "fixed inset-0 z-20" : "hidden") : "relative"
            )}>
                {activeNoteId ? (
                    <>
                        {/* Editor Header */}
                        <div className="border-b border-gray-100 dark:border-zinc-800 p-4 flex items-center gap-3 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
                            {isMobile && (
                                <button
                                    onClick={() => setShowEditorMobile(false)}
                                    className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                            )}
                            <input
                                type="text"
                                value={title}
                                onChange={handleTitleChange}
                                placeholder="Note Title"
                                className="flex-1 text-xl font-bold bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white placeholder-gray-400 truncate"
                            />
                            <div className="flex items-center gap-1">
                                {!isMobile && (
                                    <button
                                        onClick={() => setIsMaximized(!isMaximized)}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                        title={isMaximized ? "Exit Handwriting Mode" : "Handwriting Mode"}
                                    >
                                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </button>
                                )}
                                <button
                                    onClick={handleManualSave}
                                    disabled={isSaving}
                                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                    title="Save"
                                >
                                    <Save className={cn("w-5 h-5", isSaving && "animate-pulse")} />
                                </button>
                                <button
                                    onClick={() => handleOpenAiNotes()}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg shadow-md hover:shadow-lg hover:opacity-90 transition-all text-sm font-medium"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    <span className="hidden sm:inline">Ask AI</span>
                                </button>
                            </div>
                        </div>

                        {/* Editor Content */}
                        <div className={cn(
                            "flex-1 overflow-y-auto custom-scrollbar",
                            isMaximized ? "fixed inset-0 z-[9999] bg-white dark:bg-zinc-950 p-0" : "p-4 sm:p-8"
                        )}>
                            {isMaximized && (
                                <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-gray-100 dark:border-zinc-800">
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={handleTitleChange}
                                        className="text-2xl font-bold bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleManualSave}
                                            className="p-2 text-gray-500 hover:text-blue-600 rounded-lg"
                                        >
                                            <Save className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setIsMaximized(false)}
                                            className="p-2 text-gray-500 hover:text-red-600 rounded-lg"
                                        >
                                            <Minimize2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className={cn("max-w-3xl mx-auto h-full", isMaximized && "p-8")}>
                                <TiptapEditor
                                    ref={editorRef}
                                    content={content}
                                    onChange={handleContentChange}
                                    placeholder="Start typing your notes here..."
                                    className="min-h-[calc(100vh-200px)]"
                                    onAskAi={handleOpenAiNotes}
                                    onLinkClick={handleLinkClick}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30 dark:bg-zinc-900/30">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                            <FileText className="w-10 h-10 text-blue-500/50 dark:text-blue-400/50" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Select a note to view</h3>
                        <p className="text-sm text-gray-500 max-w-xs text-center">
                            Choose a note from the sidebar or create a new one to get started.
                        </p>
                    </div>
                )}
            </div>

            <AiNotesModal
                isOpen={isAiNotesModalOpen}
                onClose={() => setIsAiNotesModalOpen(false)}
                sermonId="general-notes"
                sermonTitle={title}
                initialQuery={initialAiQuery}
                messages={activeNoteId ? (chats[activeNoteId] || []) : []}
                onMessagesChange={(newMessages) => {
                    if (activeNoteId) {
                        setChats(prev => ({
                            ...prev,
                            [activeNoteId]: newMessages
                        }));
                    }
                }}
                onInsertToNotes={(text) => {
                    handleAddToNotes(text);
                    setIsAiNotesModalOpen(false);
                }}
            />
        </div >
    );
}
