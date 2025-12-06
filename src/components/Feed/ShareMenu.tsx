'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Share2, Mail, MessageSquare, Calendar, Link as LinkIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post } from '@/types';
import { EmailComposer } from './EmailComposer';

interface ShareMenuProps {
    post: Post;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ post }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showEmailComposer, setShowEmailComposer] = useState(false);
    const [copied, setCopied] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : '';
    const shareText = `Check out this post from Bethel Metropolitan: ${post.content.substring(0, 100)}... ${shareUrl}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        setIsOpen(false);
    };

    const handleTextShare = () => {
        window.open(`sms:?body=${encodeURIComponent(shareText)}`, '_self');
        setIsOpen(false);
    };

    const handleCalendar = () => {
        // Simple Google Calendar link for now
        const title = encodeURIComponent(`Post by ${post.author?.name || 'Bethel Metropolitan'}`);
        const details = encodeURIComponent(`${post.content}\n\nLink: ${shareUrl}`);
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
        window.open(url, '_blank');
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-green-500 transition-colors"
            >
                <Share2 className="w-5 h-5" />
                <span className="text-sm font-medium">Share</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-50"
                    >
                        <div className="p-1">
                            <button
                                onClick={handleCopyLink}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <LinkIcon className="w-4 h-4 text-gray-500" />}
                                <span className="text-sm text-gray-700 dark:text-gray-200">Copy Link</span>
                            </button>

                            <button
                                onClick={handleTextShare}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                            >
                                <MessageSquare className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-200">Text Message</span>
                            </button>

                            <button
                                onClick={() => { setShowEmailComposer(true); setIsOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                            >
                                <Mail className="w-4 h-4 text-blue-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-200">Email</span>
                            </button>

                            <button
                                onClick={handleCalendar}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                            >
                                <Calendar className="w-4 h-4 text-purple-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-200">Add to Calendar</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <EmailComposer
                isOpen={showEmailComposer}
                onClose={() => setShowEmailComposer(false)}
                defaultSubject={`Check out this post from Bethel Metropolitan`}
                defaultBody={shareText}
            />
        </div>
    );
};
