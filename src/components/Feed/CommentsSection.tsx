'use client';
// Force rebuild

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { ShareMenu } from './ShareMenu';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, increment, getDoc } from 'firebase/firestore';
import { Post, Comment } from '@/types';
import { User, Send, MessageCircle, Heart, X, Smile } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface CommentsSectionProps {
    post: Post;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ post }) => {
    const postId = post.id;
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Mock users for mentions
    const MOCK_USERS = [
        { id: 'ai-matthew', name: 'Matthew', handle: 'Matthew', avatar: '/images/matthew-avatar.png', isAi: true },
        { id: 'pastor-davis', name: 'Pastor Davis', handle: 'PastorDavis', avatar: null },
        { id: 'sarah-jones', name: 'Sarah Jones', handle: 'SarahJ', avatar: null },
    ];

    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

    const filteredUsers = MOCK_USERS.filter(u =>
        u.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        u.handle.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    useEffect(() => {
        const q = query(
            collection(db, 'posts', postId, 'comments'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];
            setComments(msgs);
        });

        return () => unsubscribe();
    }, [postId]);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewComment(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewComment(val);

        // Simple mention detection
        const lastWord = val.split(' ').pop();
        if (lastWord && lastWord.startsWith('@') && lastWord.length > 1) {
            setMentionQuery(lastWord.slice(1));
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    const insertMention = (handle: string) => {
        const words = newComment.split(' ');
        words.pop(); // Remove the partial mention
        setNewComment([...words, `@${handle} `].join(' '));
        setShowMentions(false);
        textareaRef.current?.focus();
    };



    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            alert("Please sign in to comment.");
            return;
        }
        if (!newComment.trim() || loading) return;

        setLoading(true);
        try {
            await addDoc(collection(db, 'posts', postId, 'comments'), {
                postId,
                author: {
                    id: user.uid,
                    name: user.displayName || 'Anonymous',
                    avatarUrl: user.photoURL
                },
                content: newComment,
                mediaUrl: null, // Add media support to Comment type if needed
                timestamp: Date.now(), // Use client timestamp for immediate sort, server timestamp for consistency
                parentId: replyingTo ? replyingTo.id : null
            });
            setNewComment('');
            setShowEmojiPicker(false);
            setReplyingTo(null);

            // If replying, ensure the thread is expanded
            if (replyingTo) {
                setExpandedThreads(prev => new Set(prev).add(replyingTo.id));
            }
        } catch (error) {
            console.error("Error adding comment:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCommentLike = async (commentId: string) => {
        if (!user) {
            alert("Please sign in to like comments.");
            return;
        }

        const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', user.uid);
        const commentRef = doc(db, 'posts', postId, 'comments', commentId);

        try {
            const likeDoc = await getDoc(likeRef);
            if (likeDoc.exists()) {
                // Unlike
                await deleteDoc(likeRef);
                await setDoc(commentRef, { likes: increment(-1) }, { merge: true });
            } else {
                // Like
                await setDoc(likeRef, {
                    timestamp: serverTimestamp(),
                    userId: user.uid,
                    userName: user.displayName,
                    userPhoto: user.photoURL
                });
                await setDoc(commentRef, { likes: increment(1) }, { merge: true });
            }
        } catch (error) {
            console.error("Error toggling comment like:", error);
        }
    };

    const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());

    const toggleThreadExpand = (commentId: string) => {
        setExpandedThreads(prev => {
            const next = new Set(prev);
            if (next.has(commentId)) {
                next.delete(commentId);
            } else {
                next.add(commentId);
            }
            return next;
        });
    };

    const toggleThreadCollapse = (commentId: string) => {
        setCollapsedThreads(prev => {
            const next = new Set(prev);
            if (next.has(commentId)) {
                next.delete(commentId);
            } else {
                next.add(commentId);
            }
            return next;
        });
    };

    // Helper to get all descendants (children, grandchildren, etc.)
    const getAllDescendants = (parentId: string, allComments: Comment[]): Comment[] => {
        const directChildren = allComments.filter(c => c.parentId === parentId);
        let descendants = [...directChildren];
        directChildren.forEach(child => {
            descendants = [...descendants, ...getAllDescendants(child.id, allComments)];
        });
        return descendants;
    };

    // Recursive component for rendering threads
    const CommentThread = ({ comment, depth = 0, isTrendingPreview = false, isTrending = false }: { comment: Comment, depth?: number, isTrendingPreview?: boolean, isTrending?: boolean }) => {
        const [isLiked, setIsLiked] = useState(false);

        // Check if user liked this comment
        useEffect(() => {
            if (!user) return;
            const likeRef = doc(db, 'posts', postId, 'comments', comment.id, 'likes', user.uid);
            // Real-time listener for my like status
            const unsubscribe = onSnapshot(likeRef, (doc) => {
                setIsLiked(doc.exists());
            });
            return () => unsubscribe();
        }, [comment.id, user]);

        const directReplies = comments.filter(c => c.parentId === comment.id);
        const allDescendants = getAllDescendants(comment.id, comments);

        const isExpanded = expandedThreads.has(comment.id);
        const isCollapsed = collapsedThreads.has(comment.id);

        // Trending Logic (only for top-level comments)
        let trendingDescendant: Comment | null = null;
        if (depth === 0 && allDescendants.length > 0) {
            // Simple trending: most likes. If tie, most recent.
            trendingDescendant = [...allDescendants].sort((a, b) => {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
                return b.timestamp - a.timestamp;
            })[0];
        }

        // Determine visible replies
        let visibleReplies: Comment[] = [];
        let showTrendingPreviewBlock = false;

        if (isExpanded) {
            visibleReplies = directReplies;
        } else {
            // Default View: Last 2 direct replies
            const lastTwo = directReplies.slice(-2);
            visibleReplies = lastTwo;

            // Helper to check if a descendant is effectively visible in the current view hierarchy
            const isDescendantVisible = (targetId: string, rootId: string): boolean => {
                // 1. Build path from target to root
                const path: Comment[] = [];
                let curr = comments.find(c => c.id === targetId);
                while (curr && curr.id !== rootId) {
                    path.unshift(curr);
                    curr = comments.find(c => c.id === curr?.parentId);
                }

                // 2. Traverse down the path checking visibility at each step
                let currentParentId = rootId;
                for (const node of path) {
                    const isParentExpanded = expandedThreads.has(currentParentId);
                    if (!isParentExpanded) {
                        // If parent is collapsed, node must be in the last 2 replies
                        const siblings = comments.filter(c => c.parentId === currentParentId);
                        // Note: Assuming comments are sorted chronologically as they are in the main render
                        const visibleSiblings = siblings.slice(-2);
                        if (!visibleSiblings.find(s => s.id === node.id)) {
                            return false; // Hidden by collapse
                        }
                    }
                    currentParentId = node.id;
                }
                return true;
            };

            // Show trending PREVIEW if it exists and is NOT effectively visible
            if (trendingDescendant && !isDescendantVisible(trendingDescendant.id, comment.id)) {
                showTrendingPreviewBlock = true;
            }
        }

        const hiddenCount = directReplies.length - visibleReplies.length;

        // Dynamic classes for trending styling
        const containerClasses = (isTrending || isTrendingPreview)
            ? "rounded-xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-900/10 mb-2"
            : "relative";

        const contentClasses = (isTrending || isTrendingPreview)
            ? "relative flex gap-3 px-4 py-3 bg-transparent transition-colors group"
            : "relative flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group";

        return (
            <div className={containerClasses}>
                {/* Trending Label */}
                {(isTrending || isTrendingPreview) && (
                    <div className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-[10px] font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-yellow-200 dark:border-yellow-900/50">
                        <Heart className="w-3 h-3 fill-current" />
                        Top Trending Reply
                    </div>
                )}

                {/* The Comment Itself */}
                <div className={contentClasses}>
                    {/* Vertical Thread Line (if it has replies and NOT collapsed) */}
                    {directReplies.length > 0 && !isCollapsed && !isTrendingPreview && !isTrending && (
                        <div className="absolute left-[2.25rem] top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-zinc-800 group-hover:bg-gray-300 dark:group-hover:bg-zinc-700 transition-colors" />
                    )}

                    {/* Avatar */}
                    <div className="flex-shrink-0 relative z-10">
                        {comment.author.avatarUrl ? (
                            <img
                                src={comment.author.avatarUrl}
                                alt={comment.author.name}
                                className={`${depth > 0 ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover object-center border border-gray-100 dark:border-zinc-800`}
                            />
                        ) : (
                            <div className={`${depth > 0 ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center`}>
                                <User className={`${depth > 0 ? 'w-4 h-4' : 'w-5 h-5'} text-gray-500 dark:text-gray-400`} />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                {comment.author.name}
                            </span>
                            {comment.isAi && (
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-medium border border-blue-200 dark:border-blue-800">
                                    AI
                                </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                · {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
                            </span>

                            {/* Collapse Toggle (Only show on main thread, not inside trending preview) */}
                            {allDescendants.length > 0 && !isTrendingPreview && !isTrending && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleThreadCollapse(comment.id);
                                    }}
                                    className="ml-auto flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    {isCollapsed ? (
                                        <div className="flex items-center gap-1 text-xs font-medium bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                                            <span className="text-blue-500 font-bold">+</span>
                                            <span>{allDescendants.length} replies</span>
                                        </div>
                                    ) : (
                                        <div className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full">
                                            <div className="w-3 h-0.5 bg-current rounded-full" /> {/* Minus icon */}
                                        </div>
                                    )}
                                </button>
                            )}
                        </div>

                        {!isCollapsed && (
                            <>
                                <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap break-words leading-relaxed">
                                    {comment.content}
                                </p>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between mt-3 max-w-md text-gray-500 dark:text-gray-400">
                                    <button
                                        onClick={() => {
                                            setReplyingTo(comment);
                                            setTimeout(() => {
                                                textareaRef.current?.focus();
                                                textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }, 100);
                                        }}
                                        className="group flex items-center gap-1 hover:text-blue-500 transition-colors"
                                    >
                                        <div className="p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                            <MessageCircle className="w-4 h-4" />
                                        </div>
                                        {directReplies.length > 0 && <span className="text-xs">{directReplies.length}</span>}
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCommentLike(comment.id);
                                        }}
                                        className={`group flex items-center gap-1 transition-colors ${isLiked ? 'text-pink-500' : 'hover:text-pink-500'}`}
                                    >
                                        <div className={`p-1.5 rounded-full transition-colors ${isLiked ? 'bg-pink-50 dark:bg-pink-900/20' : 'group-hover:bg-pink-50 dark:group-hover:bg-pink-900/20'}`}>
                                            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                        </div>
                                        {(comment.likes || 0) > 0 && <span className="text-xs">{comment.likes}</span>}
                                    </button>

                                    <div className="relative">
                                        <ShareMenu post={post} comment={comment} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Trending Preview Block (Separate from main thread) */}
                {showTrendingPreviewBlock && trendingDescendant && (
                    <div className="ml-12 mt-2 mb-2">
                        <CommentThread
                            comment={trendingDescendant}
                            depth={depth + 1}
                            isTrendingPreview={true}
                        />
                    </div>
                )}

                {/* Replies */}
                {!isCollapsed && visibleReplies.length > 0 && (
                    <div className="ml-12 mt-3 space-y-3">
                        {visibleReplies.map(reply => (
                            <CommentThread
                                key={reply.id}
                                comment={reply}
                                depth={depth + 1}
                                isTrending={trendingDescendant?.id === reply.id}
                            />
                        ))}
                    </div>
                )}

                {/* Show Previous Replies Button */}
                {!isCollapsed && !isExpanded && hiddenCount > 0 && (
                    <div className="ml-12 mt-2">
                        <button
                            onClick={() => toggleThreadExpand(comment.id)}
                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                            <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                <span className="text-[10px]">+</span>
                            </div>
                            Show {hiddenCount} previous replies
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // Main Render
    const topLevelComments = comments.filter(c => !c.parentId);

    return (
        <div className="mt-4 space-y-6">
            {/* Comment Input */}
            <form onSubmit={handleAddComment} className="relative">
                {replyingTo && (
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded-t-lg text-sm text-blue-600 dark:text-blue-400 mb-1">
                        <span>Replying to {replyingTo.author.name}</span>
                        <button type="button" onClick={() => setReplyingTo(null)}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={newComment}
                        onChange={(e) => {
                            handleTextChange(e);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-blue-500 resize-none min-h-[48px] max-h-32"
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(e);
                            }
                        }}
                    />
                    <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-2 text-gray-400 hover:text-yellow-500 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Add emoji"
                        >
                            <Smile className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => alert("GIF integration coming soon!")}
                            className="p-2 text-gray-400 hover:text-pink-500 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                            title="Add GIF"
                        >
                            <span className="font-bold text-xs border border-current rounded px-1">GIF</span>
                        </button>
                        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                        <button
                            type="submit"
                            disabled={!newComment.trim() || loading}
                            className="p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Send comment"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div className="absolute right-0 bottom-full mb-2 z-50">
                        <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.AUTO} />
                    </div>
                )}

                {/* Mentions Dropdown */}
                {showMentions && filteredUsers.length > 0 && (
                    <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-50">
                        {filteredUsers.map(u => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => insertMention(u.handle)}
                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
                            >
                                {u.avatar ? (
                                    <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                        {u.name[0]}
                                    </div>
                                )}
                                <div>
                                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{u.name}</div>
                                    <div className="text-xs text-gray-500">@{u.handle}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </form>

            {/* Comments List */}
            <div className="space-y-4">
                {topLevelComments.map(comment => (
                    <CommentThread key={comment.id} comment={comment} />
                ))}
            </div>
        </div>
    );
};
