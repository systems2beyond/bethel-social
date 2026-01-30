import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Search, Video, Info } from 'lucide-react';

interface HelpInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpInfoModal: React.FC<HelpInfoModalProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl z-50 overflow-hidden border border-slate-200 dark:border-zinc-800"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                                    <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Messaging Tips</h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-slate-500 dark:text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

                            {/* Tip 1: Threads */}
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Threaded Conversations</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Tap on any message to start a <strong>thread</strong>. This helps keep group conversations organized by replying to specific topics.
                                    </p>
                                </div>
                            </div>

                            {/* Tip 2: Video Calls */}
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Video Calls & Mobile</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        We use <strong>Google Meet</strong> for high-quality video calls.
                                        <br />
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">Important:</span> If you are on a mobile device, please confirm you have the Google Meet app installed for the best experience.
                                    </p>
                                </div>
                            </div>

                            {/* Tip 3: Search & New Message */}
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <Search className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Search & New Chats</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Use the search bar to find people and start a new conversation. Just type their name and click on the result to start chatting.
                                    </p>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm active:scale-[0.98]"
                            >
                                Got it
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Small helper icon for the text description
const PlusIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </svg>
);
