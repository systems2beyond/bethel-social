'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronDown, Trash2, Save, Maximize2, Minimize2, MessageSquare, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import TiptapEditor, { TiptapEditorRef } from '@/components/Editor/TiptapEditor';
import { useBible } from '@/context/BibleContext';

interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: any;
}

interface NoteAccordionItemProps {
    note: Note;
    isActive: boolean;
    onToggle: () => void;
    onUpdate: (id: string, title: string, content: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onAskAi: (query?: string) => void;
}

export function NoteAccordionItem({
    note,
    isActive,
    onToggle,
    onUpdate,
    onDelete,
    onAskAi
}: NoteAccordionItemProps) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content);
    const [isSaving, setIsSaving] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const editorRef = useRef<TiptapEditorRef>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { openBible } = useBible();

    // Sync state if prop changes (e.g. external update), but only if not active/editing to avoid cursor jumps
    useEffect(() => {
        if (!isActive) {
            setTitle(note.title);
            setContent(note.content);
        }
    }, [note.title, note.content, isActive]);

    // Cleanup timeout
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    const handleDebouncedSave = (newTitle: string, newContent: string) => {
        setIsSaving(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                await onUpdate(note.id, newTitle, newContent);
            } finally {
                setIsSaving(false);
            }
        }, 1500);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        handleDebouncedSave(newTitle, content);
    };

    const handleContentChange = (newContent: string) => {
        setContent(newContent);
        handleDebouncedSave(title, newContent);
    };

    const handleManualSave = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setIsSaving(true);
        try {
            await onUpdate(note.id, title, content);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // Simple confirm for now, could be a better modal
        if (confirm('Delete this note?')) {
            await onDelete(note.id);
        }
    };

    // Date Formatting Helper
    const getDateLabel = (date: any) => {
        if (!date) return '';
        const d = date.toDate ? date.toDate() : new Date(date);
        return format(d, 'MMM d, yyyy');
    };

    // Strip HTML for preview
    const previewText = (note.content || '').replace(/<[^>]*>/g, '').slice(0, 100);

    const handleLinkClick = (href: string) => {
        if (href.startsWith('verse://')) {
            const ref = decodeURIComponent((href || '').replace('verse://', ''));
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "group flex flex-col rounded-xl transition-all duration-300 overflow-hidden border",
                isActive
                    ? "bg-white dark:bg-zinc-900 border-purple-200 dark:border-purple-900/30 shadow-xl my-4 ring-1 ring-purple-500/10"
                    : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-zinc-700 cursor-pointer mb-2"
            )}
            onClick={(e) => {
                if (!isActive) onToggle();
            }}
        >
            {/* Header Area */}
            <div className="flex items-center justify-between p-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={cn(
                        "p-2 rounded-lg transition-colors shrink-0",
                        isActive ? "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" : "bg-gray-100 dark:bg-zinc-800 text-gray-400 group-hover:text-purple-500"
                    )}>
                        <FileText className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className={cn(
                                "font-bold text-base truncate transition-colors",
                                isActive ? "text-purple-900 dark:text-purple-100" : "text-gray-900 dark:text-zinc-100"
                            )}>
                                {note.title || 'Untitled Note'}
                            </h3>
                            {isSaving && <span className="text-[10px] text-zinc-400 animate-pulse">Saving...</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                            <span>{getDateLabel(note.updatedAt)}</span>
                            {!isActive && previewText && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-700" />
                                    <span className="truncate max-w-[200px] opacity-70">{previewText}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isActive ? (
                        <>
                            <button
                                onClick={handleManualSave}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                title="Save Now"
                            >
                                <Save className={cn("w-4 h-4", isSaving && "animate-pulse")} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggle(); }} // Click to collapse
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleDeleteClick}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Note"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Editor Area */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-gray-100 dark:border-zinc-800/50"
                    >
                        <div className={cn(
                            "flex flex-col bg-gray-50/30 dark:bg-black/20",
                            isMaximized ? "fixed inset-0 z-[100] bg-white dark:bg-zinc-950 p-6 overflow-y-auto" : "p-4 md:p-6"
                        )}>
                            {/* Editor Toolbar / Header */}
                            <div className="flex items-center gap-4 mb-4">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={handleTitleChange}
                                    placeholder="Note Title"
                                    className="flex-1 text-2xl font-bold bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white placeholder-gray-400"
                                />
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onAskAi()}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg shadow-sm hover:shadow-md text-xs font-bold"
                                    >
                                        <MessageSquare className="w-3 h-3" />
                                        Ask AI
                                    </button>
                                    <button
                                        onClick={() => setIsMaximized(!isMaximized)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                        title={isMaximized ? "Exit Fullscreen" : "Fullscreen Editor"}
                                    >
                                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Tiptap Editor */}
                            <div className={cn(
                                "bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden",
                                isMaximized ? "min-h-[calc(100vh-150px)]" : "min-h-[400px]"
                            )}>
                                <TiptapEditor
                                    ref={editorRef}
                                    content={content}
                                    onChange={handleContentChange}
                                    placeholder="Write something amazing..."
                                    className="p-4"
                                    onAskAi={() => onAskAi()}
                                    onLinkClick={handleLinkClick}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
