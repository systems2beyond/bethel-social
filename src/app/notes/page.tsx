'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Search, FileText } from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import { useBible } from '@/context/BibleContext'; // Still needed for deep linking potentially
import AiNotesModal from '@/components/Sermons/AiNotesModal';
import { cn } from '@/lib/utils';
import { NoteAccordionItem } from '@/components/Notes/NoteAccordionItem';

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
    const [searchQuery, setSearchQuery] = useState('');

    // AI Modal State
    const [isAiNotesModalOpen, setIsAiNotesModalOpen] = useState(false);
    const [initialAiQuery, setInitialAiQuery] = useState('');
    const [chats, setChats] = useState<Record<string, any[]>>({});

    // Register Context Handler for Global Chat
    const { registerContextHandler } = useChat();

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

    // Load Chat History for active note (to support context)
    useEffect(() => {
        if (!user || !activeNoteId) return;

        const q = query(
            collection(db, 'users', user.uid, 'notes', activeNoteId, 'chat'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setChats(prev => ({
                ...prev,
                [activeNoteId]: msgs
            }));
        }, (error) => {
            console.error("Error fetching chat for note:", activeNoteId, error);
        });

        return () => unsubscribe();
    }, [user, activeNoteId]);


    // Context Handler registration
    useEffect(() => {
        if (activeNoteId) {
            registerContextHandler((msg) => handleOpenAiNotes(msg));
        } else {
            registerContextHandler(null);
        }
        return () => registerContextHandler(null);
    }, [activeNoteId, registerContextHandler]);


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

    const handleUpdateNote = async (id: string, title: string, content: string) => {
        if (!user) return;
        await updateDoc(doc(db, 'users', user.uid, 'notes', id), {
            title,
            content,
            updatedAt: serverTimestamp()
        });
    };

    const handleDeleteNote = async (id: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', user.uid, 'notes', id));
        if (activeNoteId === id) setActiveNoteId(null);
    };

    const handleOpenAiNotes = (query?: string) => {
        setInitialAiQuery(query || '');
        setIsAiNotesModalOpen(true);
    };

    const handleAiInsert = async (text: string) => {
        // Since the editor is inside the child component, we need a way to insert text.
        // For simplicity in this architecture, we append to the content and update.
        // Ideally, we'd use a Context or Event Bus to push to the active editor ref,
        // but updating the doc directly will trigger a reactive update in the child 
        // via the useEffect syncing props. It might move the cursor, which is a tradeoff.
        if (!activeNoteId) return;

        const currentNote = notes.find(n => n.id === activeNoteId);
        if (currentNote) {
            const newContent = (currentNote.content || '') + '\n\n' + text;
            await handleUpdateNote(activeNoteId, currentNote.title, newContent);
            setIsAiNotesModalOpen(false);
        }
    };

    const filteredNotes = notes.filter(note =>
        (note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content || '').toLowerCase().includes(searchQuery.toLowerCase())
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
        <div className="min-h-screen bg-gray-50/50 dark:bg-black pb-20">
            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                            My Notes
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Capture your thoughts, sermon takeaways, and revelations.
                        </p>
                    </div>

                    <button
                        onClick={handleCreateNote}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-bold active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        New Note
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search your notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-base"
                    />
                </div>

                {/* Notes List (Accordion) */}
                <div className="space-y-4">
                    {filteredNotes.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                                <FileText className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No notes found</h3>
                            <p className="text-gray-500 dark:text-zinc-500 max-w-sm mx-auto mb-6">
                                {searchQuery ? 'Try adjusting your search terms.' : 'Create your first note to get started.'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={handleCreateNote}
                                    className="text-blue-500 hover:text-blue-600 font-medium hover:underline"
                                >
                                    Create a Note
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredNotes.map(note => (
                            <NoteAccordionItem
                                key={note.id}
                                note={note}
                                isActive={activeNoteId === note.id}
                                onToggle={() => setActiveNoteId(prev => prev === note.id ? null : note.id)}
                                onUpdate={handleUpdateNote}
                                onDelete={handleDeleteNote}
                                onAskAi={handleOpenAiNotes}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* AI Modal (Global for page) */}
            <AiNotesModal
                isOpen={isAiNotesModalOpen}
                onClose={() => setIsAiNotesModalOpen(false)}
                sermonId="general-notes"
                sermonTitle="General Notes"
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
                onSaveMessage={async (role, content) => {
                    if (!user || !activeNoteId) return;
                    try {
                        await addDoc(collection(db, 'users', user.uid, 'notes', activeNoteId, 'chat'), {
                            role,
                            content,
                            createdAt: serverTimestamp()
                        });
                    } catch (error) {
                        console.error("Error saving chat:", error);
                    }
                }}
                onInsertToNotes={handleAiInsert}
            />
        </div>
    );
}
