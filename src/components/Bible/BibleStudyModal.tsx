'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit3, Maximize2, Minimize2, Sparkles, Book, Search as SearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useBible } from '@/context/BibleContext';
import TiptapEditor, { EditorToolbar } from '../Editor/TiptapEditor';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import BibleReader from './BibleReader';
import BibleSearch from './BibleSearch';

interface BibleStudyModalProps {
    onClose: () => void;
}

export default function BibleStudyModal({ onClose }: BibleStudyModalProps) {
    const { user } = useAuth();
    const { registerInsertHandler } = useBible();
    const [editor, setEditor] = useState<any>(null);

    // Register Bible Insert Handler
    useEffect(() => {
        registerInsertHandler((html) => {
            if (editor) {
                editor.chain().focus().insertContent(html).run();
                const newContent = editor.getHTML();
                handleSaveNotes(newContent);
            }
        });
        return () => registerInsertHandler(null);
    }, [editor, registerInsertHandler]);

    // "Always Portal" strategy for Desktop/Tablet
    const isDesktopOrTablet = useMediaQuery('(min-width: 768px)');
    const useAlwaysPortal = isDesktopOrTablet;

    // Toggle body class
    useEffect(() => {
        document.body.classList.add('modal-open');
        return () => document.body.classList.remove('modal-open');
    }, []);

    const [notes, setNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [isNotesMaximized, setIsNotesMaximized] = useState(false);
    const [activeTab, setActiveTab] = useState<'search' | 'notes'>('notes');

    // Load Notes (Generic "Bible Study" note for now)
    useEffect(() => {
        if (!user) return;
        // Save to main notes collection so it appears in the Notes page
        const notesRef = doc(db, 'users', user.uid, 'notes', 'bible-study-general');
        const unsubscribe = onSnapshot(notesRef, (doc) => {
            if (doc.exists()) {
                setNotes(doc.data().content);
            }
        });
        return () => unsubscribe();
    }, [user]);

    const handleSaveNotes = async (content: string) => {
        if (!user) return;
        setSavingNotes(true);
        try {
            const notesRef = doc(db, 'users', user.uid, 'notes', 'bible-study-general');
            await setDoc(notesRef, {
                title: 'General Bible Study', // Ensure it has a title for the list
                content,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving notes:', error);
        } finally {
            setTimeout(() => setSavingNotes(false), 1000);
        }
    };

    // Refs
    const modalContainerRef = useRef<HTMLDivElement>(null);
    const videoPlaceholderRef = useRef<HTMLDivElement>(null); // Reusing name for Bible Reader placeholder

    // Floating Logic (Simplified for Bible Reader - maybe we don't float it? 
    // The user said "similar modal", but floating text is weird. 
    // Let's keep it docked for now, but use the same layout structure.)
    // Actually, user said "instead of the video we have the bible".
    // If we maximize notes, the "video" floats. Floating a Bible reader might be too small.
    // Let's DISABLE floating for Bible Reader for now, or just hide it when notes are maximized?
    // User said "all the notes work the same".
    // Let's keep the layout but maybe not float the reader, just let notes cover it?
    // Or maybe float it as a mini-reader? That would be cool but complex.
    // Let's stick to: Notes Maximize -> Reader Hidden or Docked Small?
    // For now, let's just let notes take over full screen and hide reader behind, 
    // OR split screen?
    // The SermonModal floats the video. 
    // Let's try to keep the reader visible if possible, but maybe just standard scrolling layout is best.

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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-6xl h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Book className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">Bible Study</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left/Top: Bible Reader (Takes priority) */}
                    <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-zinc-800">
                        <div className="flex-1 overflow-hidden relative">
                            <BibleReader />
                        </div>
                    </div>

                    {/* Right/Bottom: Sidebar (Notes & Search) */}
                    {/* On mobile this should probably stack? For now let's do a split view on desktop */}
                    <div className="w-full md:w-[400px] flex flex-col bg-gray-50 dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800">
                        {/* Tabs */}
                        <div className="flex items-center border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                            <button
                                onClick={() => setActiveTab('notes')}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                                    activeTab === 'notes'
                                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                )}
                            >
                                <Edit3 className="w-4 h-4" />
                                Study Notes
                            </button>
                            <button
                                onClick={() => setActiveTab('search')}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                                    activeTab === 'search'
                                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                )}
                            >
                                <SearchIcon className="w-4 h-4" />
                                Search
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden relative">
                            {activeTab === 'search' ? (
                                <BibleSearch />
                            ) : (
                                <div className="h-full flex flex-col">
                                    <div className="p-2 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center">
                                        <EditorToolbar editor={editor} className="border-none shadow-none mb-0 pb-0" />
                                        {savingNotes && <span className="text-xs text-green-600 animate-pulse px-2">Saving...</span>}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white dark:bg-zinc-900">
                                        <TiptapEditor
                                            content={notes}
                                            onChange={(content) => {
                                                handleSaveNotes(content);
                                            }}
                                            className="min-h-[300px]"
                                            showToolbar={false}
                                            onEditorReady={setEditor}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
