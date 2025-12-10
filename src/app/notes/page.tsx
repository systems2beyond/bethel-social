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

    const editorRef = React.useRef<any>(null);

    // ...

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

    // ...

    <TiptapEditor
        ref={editorRef}
        content={content}
        onChange={handleContentChange}
        placeholder="Start typing your notes here..."
        className="h-full"
        onAskAi={handleOpenAiNotes}
    />
                        </div >
                    </>
                ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-4">
                <Plus className="w-8 h-8" />
            </div>
            <p>Select a note or create a new one</p>
        </div>
    )
}
            </div >

    {/* AI Notes Modal */ }
    < AiNotesModal
isOpen = { isAiNotesModalOpen }
onClose = {() => setIsAiNotesModalOpen(false)}
sermonId = "general-notes" // Or pass specific sermon ID if linked
sermonTitle = { title }
initialQuery = { initialAiQuery }
onInsertToNotes = {(text) => {
    handleAddToNotes(text);
    setIsAiNotesModalOpen(false);
}}
            />
        </div >
    );
}
