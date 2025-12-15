'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Book, ChevronLeft, ChevronRight, Copy, Share2, Edit3 } from 'lucide-react';
import { useBible } from '@/context/BibleContext';
import { cn } from '@/lib/utils';
import BibleReader from './BibleReader';

export default function BibleModal() {
    const { isOpen, closeBible, reference, version } = useBible();

    // Prevent background scroll when open
    React.useEffect(() => {
        if (isOpen) {
            document.body.classList.add('prevent-scroll');
        } else {
            // Only remove if we are not "nested" inside another modal (marked by modal-open)
            if (!document.body.classList.contains('modal-open')) {
                document.body.classList.remove('prevent-scroll');
            }
        }
        return () => {
            // Cleanup: same check
            if (!document.body.classList.contains('modal-open')) {
                document.body.classList.remove('prevent-scroll');
            }
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeBible}
                        onTouchMove={(e) => e.preventDefault()}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] touch-none" // Higher than SermonModal (100)
                    />

                    {/* Modal Container */}
                    <div className="fixed inset-0 z-[151] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-2xl h-[85vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto border border-gray-200 dark:border-zinc-800"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <Book className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-gray-900 dark:text-white">
                                            Holy Bible
                                        </h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                                            {version.toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeBible}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-hidden relative bg-amber-50/30 dark:bg-zinc-950/50 overscroll-contain">
                                <BibleReader />
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
