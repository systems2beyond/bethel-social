'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Pin, Flag, Share2, Link as LinkIcon, MessageSquare, Mail, Calendar, ArrowLeft, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post } from '@/types';
import { doc, deleteDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { EmailComposer } from './EmailComposer';
import { db } from '@/lib/firebase';
import { useFeed } from '@/context/FeedContext';
import { useAuth } from '@/context/AuthContext';

interface PostOptionsMenuProps {
    post: Post;
}

export const PostOptionsMenu: React.FC<PostOptionsMenuProps> = ({ post }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuView, setMenuView] = useState<'main' | 'share'>('main');
    const [showEmailComposer, setShowEmailComposer] = useState(false);
    const [copied, setCopied] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { triggerRefresh } = useFeed();
    const { user, userData } = useAuth();

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setMenuView('main'); // Reset view on close
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            try {
                await deleteDoc(doc(db, 'posts', post.id));
                triggerRefresh();
                setIsOpen(false);
            } catch (error) {
                console.error('Error deleting post:', error);
                alert('Failed to delete post');
            }
        }
    };

    const handlePin = async () => {
        try {
            await updateDoc(doc(db, 'posts', post.id), {
                pinned: !post.pinned
            });
            triggerRefresh();
            setIsOpen(false);
        } catch (error) {
            console.error('Error updating pin status:', error);
            alert('Failed to update pin status');
        }
    };

    const handleReport = async () => {
        if (!user) return;

        const reason = window.prompt('Why are you reporting this post? (Optional)');
        if (reason === null) return; // User cancelled

        try {
            await addDoc(collection(db, 'reports'), {
                postId: post.id,
                postContent: post.content || '',
                postAuthorId: post.author?.name || 'Unknown', // Storing name as ID not available in author obj yet
                reportedBy: user.uid,
                reporterName: userData?.displayName || user.displayName || 'Anonymous',
                reason: reason || 'No reason provided',
                status: 'pending',
                timestamp: serverTimestamp()
            });
            alert('Post reported. Thank you for helping keep our community safe.');
            setIsOpen(false);
        } catch (error) {
            console.error('Error reporting post:', error);
            alert('Failed to report post');
        }
    };

    // Share Logic
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : '';
    const shareText = `Check out this post by ${post.author?.name || 'Bethel Metropolitan'}: ${post.content?.substring(0, 100)}... ${shareUrl}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        // Don't close immediately so they see the checkmark
    };

    const handleTextShare = () => {
        window.open(`sms:?body=${encodeURIComponent(shareText)}`, '_self');
        setIsOpen(false);
    };

    const handleCalendar = () => {
        const title = encodeURIComponent(`Post by ${post.author?.name || 'Bethel Metropolitan'}`);
        const details = encodeURIComponent(`${post.content?.substring(0, 1000)}\n\nLink: ${shareUrl}`);
        const now = new Date();
        const start = now.toISOString().replace(/-|:|\.\d\d\d/g, '');
        const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, '');
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${start}/${end}`;
        window.open(url, '_blank');
        setIsOpen(false);
    };

    const isAdmin = userData?.role === 'admin';

    // If not logged in, don't show menu
    if (!user) {
        return null;
    }

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                    setMenuView('main');
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                title="More Options"
            >
                <MoreVertical className="w-5 h-5" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-gray-100 dark:border-zinc-800 overflow-hidden z-50 origin-top-right"
                    >
                        <div className="py-1">
                            {menuView === 'main' ? (
                                <>
                                    {isAdmin && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePin();
                                                }}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                                            >
                                                <Pin className={`w-4 h-4 ${post.pinned ? 'fill-current' : ''}`} />
                                                <span>{post.pinned ? 'Unpin Post' : 'Pin Post'}</span>
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete();
                                                }}
                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span>Delete Post</span>
                                            </button>

                                            <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                                        </>
                                    )}

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuView('share');
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        <span>Share Post</span>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleReport();
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors text-left"
                                    >
                                        <Flag className="w-4 h-4" />
                                        <span>Report Post</span>
                                    </button>
                                </>
                            ) : (
                                /* Share View */
                                <motion.div
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    className="bg-gray-50/50 dark:bg-zinc-900"
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuView('main');
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800"
                                    >
                                        <ArrowLeft className="w-3 h-3" />
                                        Back to Options
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyLink();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white dark:hover:bg-zinc-800 transition-colors text-left"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <LinkIcon className="w-4 h-4 text-gray-500" />}
                                        <span className="text-sm text-gray-700 dark:text-gray-200">{copied ? 'Copied!' : 'Copy Link'}</span>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTextShare();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white dark:hover:bg-zinc-800 transition-colors text-left"
                                    >
                                        <MessageSquare className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-gray-700 dark:text-gray-200">Text Message</span>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowEmailComposer(true);
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white dark:hover:bg-zinc-800 transition-colors text-left"
                                    >
                                        <Mail className="w-4 h-4 text-blue-500" />
                                        <span className="text-sm text-gray-700 dark:text-gray-200">Email</span>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCalendar();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white dark:hover:bg-zinc-800 transition-colors text-left"
                                    >
                                        <Calendar className="w-4 h-4 text-purple-500" />
                                        <span className="text-sm text-gray-700 dark:text-gray-200">Add to Calendar</span>
                                    </button>
                                </motion.div>
                            )}
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
