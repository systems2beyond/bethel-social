import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scroll, Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ViewResourceModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
    type?: 'scroll' | 'bible';
    meetingId?: string; // Passed to enable collaboration context
    resourceId?: string;
}

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useBible } from '@/context/BibleContext';
import { toast } from 'sonner';
import { Edit3, FilePlus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

export function ViewResourceModal({ isOpen, onClose, title, content, type = 'scroll', meetingId }: ViewResourceModalProps) {
    const { user } = useAuth();
    const { openNote, openCollaboration, openBible } = useBible();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen) return null;

    const handleAddToNotes = async () => {
        if (!user) return;
        try {
            // Create a new note
            const docRef = await addDoc(collection(db, 'users', user.uid, 'notes'), {
                title: `Note: ${title}`,
                content: content,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                tags: ['meeting-note', 'resource']
            });

            toast.success("Added to your notes!");
            onClose();
            // Open the new note in the study modal
            openNote(docRef.id, `Note: ${title}`);

        } catch (error) {
            console.error("Error adding note:", error);
            toast.error("Failed to add note.");
        }
    };

    const handleCollaborate = () => {
        if (!meetingId) {
            toast.error("Cannot collaborate on this resource (No Meeting ID)");
            return;
        }
        onClose();
        // Use meetingId as the unique collaboration room ID
        // We could append '-notes' to be specific
        openCollaboration(`meeting-${meetingId}-notes`, `Collaborating: ${title}`);
    };

    const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const link = target.closest('a');

        if (link && link.getAttribute('href')?.startsWith('verse://')) {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href) {
                const ref = decodeURIComponent(href.replace('verse://', ''));
                // Regex matches: "Book Chapter[:Verse[-EndVerse]]"
                // Same logic as TiptapEditor/BibleStudyModal
                const match = ref.match(/(.+?)\s(\d+)(?::(\d+)(?:-(\d+))?)?$/);

                if (match) {
                    const book = match[1].trim();
                    const chapter = parseInt(match[2]);
                    const startVerse = match[3] ? parseInt(match[3]) : undefined;
                    const endVerse = match[4] ? parseInt(match[4]) : undefined;

                    // Close this modal and open bible (potentially side-by-side or just open)
                    // The user said "The scripture text link works fine on the notes for bible so dont change anything there"
                    // They want the blue link to open the reader.
                    openBible({ book, chapter, verse: startVerse, endVerse });
                    onClose(); // Optional: Close modal so they can see the bible? Or keep open?
                    // Usually clicking a verse link implies navigation. 
                    // Given the user wants to "Add to notes", they might want to stay.
                    // But openBible usually opens the sidebar/modal. 
                    // Let's close this modal to prevent overlap clutter, as openBible opens the main study modal usually.
                }
            }
        }
    };

    const modalContent = (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 1150 }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-zinc-800"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                <Scroll className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white text-lg leading-tight">
                                    {title}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Attached Resource
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div
                        className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950"
                        onClick={handleContentClick}
                    >
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            {content ? (
                                <div dangerouslySetInnerHTML={{ __html: content }} />
                            ) : (
                                <p className="italic text-gray-500">*No content available for this resource.*</p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex justify-between shrink-0">
                        <div className="flex gap-2">
                            <button
                                onClick={handleAddToNotes}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <FilePlus className="w-4 h-4" />
                                Add to My Notes
                            </button>
                            {meetingId && (
                                <button
                                    onClick={handleCollaborate}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    Collaborate
                                </button>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );

    if (!mounted) return null;
    return createPortal(modalContent, document.body);
}
