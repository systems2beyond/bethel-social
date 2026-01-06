'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Pin, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post } from '@/types';
import { doc, deleteDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useFeed } from '@/context/FeedContext';
import { useAuth } from '@/context/AuthContext';

interface PostOptionsMenuProps {
    post: Post;
}

export const PostOptionsMenu: React.FC<PostOptionsMenuProps> = ({ post }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { triggerRefresh } = useFeed();
    const { user, userData } = useAuth();

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
                        className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-gray-100 dark:border-zinc-800 overflow-hidden z-50 origin-top-right"
                    >
                        <div className="py-1">
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
                                    handleReport();
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors text-left"
                            >
                                <Flag className="w-4 h-4" />
                                <span>Report Post</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
