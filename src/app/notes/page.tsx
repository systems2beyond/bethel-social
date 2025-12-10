'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Trash2, Save, MessageSquare } from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import TiptapEditor from '@/components/Editor/TiptapEditor';
import AiNotesModal from '@/components/Sermons/AiNotesModal';

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

    // Register Context Handler for Global Chat
    const { registerContextHandler } = useChat();

    // Load notes (Restored)
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

    // Load active note into editor (Restored)
    useEffect(() => {
        if (activeNoteId) {
            const note = notes.find(n => n.id === activeNoteId);
            if (note) {
                setTitle(note.title);
                setContent(note.content);
            }
        } else {
            setTitle('');
            setContent('');
        }
    }, [activeNoteId, notes]);

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
        const newContent = content + '\n\n' + text;
        setContent(newContent);
        debouncedSave(title, newContent);
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
        }
    };

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
        <div className="flex h-screen bg-white dark:bg-zinc-950">
            {/* Left Sidebar: Note List (Restored) */}
            <div className="w-64 border-r border-gray-200 dark:border-zinc-800 flex flex-col bg-gray-50 dark:bg-zinc-900">
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-700 dark:text-gray-200">My Notes</h2>
                    <button
                        onClick={handleCreateNote}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {notes.map(note => (
                        <div
                            key={note.id}
                            onClick={() => setActiveNoteId(note.id)}
                            className={`p-3 rounded-lg cursor-pointer group relative transition-colors ${activeNoteId === note.id
                                ? 'bg-white dark:bg-zinc-800 shadow-sm border border-gray-200 dark:border-zinc-700'
                                : 'hover:bg-gray-100 dark:hover:bg-zinc-800/50'
                                }`}
                        >
                            <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate pr-6">
                                {note.title || 'Untitled Note'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                                {note.updatedAt?.toDate().toLocaleDateString()}
                            </p>
                            <button
                                onClick={(e) => handleDelete(e, note.id)}
                                className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Center: Editor */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950">
                {activeNoteId ? (
                    <>
                        <div className="border-b border-gray-200 dark:border-zinc-800 p-4 flex items-center justify-between">
                            <input
                                type="text"
                                value={title}
                                onChange={handleTitleChange}
                                placeholder="Note Title"
                                className="text-xl font-bold bg-transparent border-none focus:ring-0 p-0 w-full text-gray-900 dark:text-white placeholder-gray-400"
                            />
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleManualSave}
                                    disabled={isSaving}
                                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                </button>
                                <button
                                    onClick={() => handleOpenAiNotes()}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/40 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    <span>Ask AI</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto">
                            <TiptapEditor
                                content={content}
                                onChange={handleContentChange}
                                placeholder="Start typing your notes here..."
                                className="h-full"
                                onAskAi={handleOpenAiNotes}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-4">
                            <Plus className="w-8 h-8" />
                        </div>
                        <p>Select a note or create a new one</p>
                    </div>
                )}
            </div>

            {/* AI Notes Modal */}
            <AiNotesModal
                isOpen={isAiNotesModalOpen}
                onClose={() => setIsAiNotesModalOpen(false)}
                sermonId="general-notes" // Or pass specific sermon ID if linked
                sermonTitle={title}
                initialQuery={initialAiQuery}
                onInsertToNotes={(text) => {
                    handleAddToNotes(text);
                    setIsAiNotesModalOpen(false);
                }}
            />
        </div>
    );
}
