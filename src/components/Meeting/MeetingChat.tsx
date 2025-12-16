'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { ShareMenu } from '@/components/Feed/ShareMenu';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, increment, getDoc } from 'firebase/firestore';
import { Comment } from '@/types';
import { User, Send, MessageCircle, Heart, X, Smile } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

interface MeetingChatProps {
    meetingId: string;
}

export const MeetingChat: React.FC<MeetingChatProps> = ({ meetingId }) => {
    const { user, userData } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Mock users for mentions (can be replaced with real user search later)
    const MOCK_USERS = [
        { id: 'ai-matthew', name: 'Matthew', handle: 'Matthew', avatar: '/images/matthew-avatar.png', isAi: true },
        { id: 'pastor-davis', name: 'Pastor Davis', handle: 'PastorDavis', avatar: null },
    ];

    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
    const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
    const activeThread = focusedCommentId ? comments.find(c => c.id === focusedCommentId) : null;

    const filteredUsers = MOCK_USERS.filter(u =>
        u.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        u.handle.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    useEffect(() => {
        // Path: meetings/{meetingId}/comments
        const q = query(
            collection(db, 'meetings', meetingId, 'comments'),
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
    }, [meetingId]);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewComment(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewComment(val);

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
        words.pop();
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
            await addDoc(collection(db, 'meetings', meetingId, 'comments'), {
                // We don't store postId here, but maybe meetingId for reference if needed
                meetingId,
                author: {
                    id: user.uid,
                    name: userData?.displayName || user.displayName || 'Anonymous',
                    avatarUrl: user.photoURL
                },
                content: newComment,
                mediaUrl: null,
                timestamp: Date.now(),
                parentId: replyingTo ? replyingTo.id : (activeThread ? activeThread.id : (focusedCommentId || null))
            });
            setNewComment('');
            setShowEmojiPicker(false);
            setReplyingTo(null);

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

        const likeRef = doc(db, 'meetings', meetingId, 'comments', commentId, 'likes', user.uid);
        const commentRef = doc(db, 'meetings', meetingId, 'comments', commentId);

        try {
            const likeDoc = await getDoc(likeRef);
            if (likeDoc.exists()) {
                await deleteDoc(likeRef);
                await setDoc(commentRef, { likes: increment(-1) }, { merge: true });
            } else {
                await setDoc(likeRef, {
                    timestamp: serverTimestamp(),
                    userId: user.uid,
                    userName: userData?.displayName || user.displayName,
                    userPhoto: user.photoURL
                });
                await setDoc(commentRef, { likes: increment(1) }, { merge: true });
            }
        } catch (error) {
            console.error("Error toggling comment like:", error);
        }
    };

    const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());

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

    const getAncestors = (commentId: string, allComments: Comment[]): Comment[] => {
        const ancestors: Comment[] = [];
        let currentComment = allComments.find(c => c.id === commentId);
        while (currentComment && currentComment.parentId) {
            const parent = allComments.find(c => c.id === currentComment!.parentId);
            if (parent) {
                ancestors.unshift(parent);
                currentComment = parent;
            } else {
                break;
            }
        }
        return ancestors;
    };

    const getAllDescendants = (parentId: string, allComments: Comment[]): Comment[] => {
        const directChildren = allComments.filter(c => c.parentId === parentId);
        let descendants = [...directChildren];
        directChildren.forEach(child => {
            descendants = [...descendants, ...getAllDescendants(child.id, allComments)];
        });
        return descendants;
    };

    const CommentThread = ({ comment, depth = 0, isTrendingPreview = false, isTrending = false, isFocused = false }: { comment: Comment, depth?: number, isTrendingPreview?: boolean, isTrending?: boolean, isFocused?: boolean }) => {
        const [isLiked, setIsLiked] = useState(false);

        useEffect(() => {
            if (!user) return;
            const likeRef = doc(db, 'meetings', meetingId, 'comments', comment.id, 'likes', user.uid);
            const unsubscribe = onSnapshot(likeRef, (doc) => {
                setIsLiked(doc.exists());
            });
            return () => unsubscribe();
        }, [comment.id, user]);

        const directReplies = comments.filter(c => c.parentId === comment.id);
        const allDescendants = getAllDescendants(comment.id, comments);
        const isCollapsed = collapsedThreads.has(comment.id);

        let trendingDescendant: Comment | null = null;
        if (depth === 0 && allDescendants.length > 0 && !focusedCommentId) {
            trendingDescendant = [...allDescendants].sort((a, b) => {
                const likesA = a.likes || 0;
                const likesB = b.likes || 0;
                if (likesA !== likesB) return likesB - likesA;
                return b.timestamp - a.timestamp;
            })[0];
        }

        let visibleReplies: Comment[] = [];
        if (focusedCommentId === comment.id && !isCollapsed) {
            visibleReplies = directReplies;
        } else {
            visibleReplies = [];
        }

        const containerClasses = (isTrending || isTrendingPreview)
            ? "rounded-xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-900/10 mb-2"
            : "relative";

        const contentClasses = (isTrending || isTrendingPreview)
            ? "relative flex gap-3 px-4 py-3 bg-transparent transition-colors group"
            : `relative flex gap-3 px-4 py-3 ${isFocused ? 'bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-100 dark:ring-blue-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'} transition-colors group`;

        return (
            <div className={containerClasses}>
                {(isTrending || isTrendingPreview) && (
                    <div className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-[10px] font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-yellow-200 dark:border-yellow-900/50">
                        <Heart className="w-3 h-3 fill-current" />
                        Top Trending Reply
                    </div>
                )}

                <div className={contentClasses}>
                    {directReplies.length > 0 && !isCollapsed && !isTrendingPreview && !isTrending && focusedCommentId === comment.id && (
                        <div className="absolute left-[1.35rem] md:left-[2.25rem] top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-zinc-800 group-hover:bg-gray-300 dark:group-hover:bg-zinc-700 transition-colors" />
                    )}

                    <div className="flex-shrink-0 relative z-10">
                        {comment.author.avatarUrl ? (
                            <img
                                src={comment.author.avatarUrl}
                                alt={comment.author.name}
                                className={`${depth > 0 ? 'w-6 h-6 md:w-8 md:h-8' : 'w-8 h-8 md:w-10 md:h-10'} rounded-full object-cover object-center border border-gray-100 dark:border-zinc-800`}
                            />
                        ) : (
                            <div className={`${depth > 0 ? 'w-6 h-6 md:w-8 md:h-8' : 'w-8 h-8 md:w-10 md:h-10'} rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center`}>
                                <User className={`${depth > 0 ? 'w-3 h-3 md:w-4 md:h-4' : 'w-4 h-4 md:w-5 md:h-5'} text-gray-500 dark:text-gray-400`} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white text-xs md:text-sm">
                                {comment.author.name}
                            </span>
                            <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                                · {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
                            </span>

                            {allDescendants.length > 0 && !isTrendingPreview && !isTrending && focusedCommentId === comment.id && (
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
                                            <div className="w-3 h-0.5 bg-current rounded-full" />
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

                                <div className="flex items-center justify-between mt-2 md:mt-3 max-w-md text-gray-500 dark:text-gray-400">
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
                                            <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
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
                                            <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isLiked ? 'fill-current' : ''}`} />
                                        </div>
                                        {(comment.likes || 0) > 0 && <span className="text-xs">{comment.likes}</span>}
                                    </button>

                                    {directReplies.length > 0 && focusedCommentId !== comment.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFocusedCommentId(comment.id);
                                            }}
                                            className="flex items-center gap-2 group/btn"
                                        >
                                            <div className="w-8 h-px bg-gray-300 dark:bg-zinc-700 group-hover/btn:bg-gray-400 transition-colors" />
                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 group-hover/btn:text-gray-700 dark:group-hover/btn:text-gray-200 transition-colors">
                                                View {directReplies.length} {directReplies.length === 1 ? 'reply' : 'replies'}
                                            </span>
                                        </button>
                                    )}

                                    {/* Share menu for comments could be added here if ShareMenu supports Meeting context */}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Recursion for replies */}
                {!isCollapsed && visibleReplies.length > 0 && (
                    <div className="ml-3 md:ml-12 mt-2 md:mt-3 space-y-2 md:space-y-3">
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
            </div>
        );
    };

    // Main Render Logic
    let contentToRender;

    if (focusedCommentId) {
        const focusedComment = comments.find(c => c.id === focusedCommentId);
        if (focusedComment) {
            const ancestors = getAncestors(focusedCommentId, comments);
            contentToRender = (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <button
                        onClick={() => setFocusedCommentId(null)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-all shadow-md hover:shadow-lg mb-6 group"
                    >
                        <div className="p-1 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
                            <X className="w-4 h-4" /> {/* Changed icon to X/Back */}
                        </div>
                        Back to all chats
                    </button>

                    {ancestors.length > 0 && (
                        <div className="space-y-4 opacity-75">
                            {ancestors.map(ancestor => (
                                <div key={ancestor.id} className="relative">
                                    <CommentThread comment={ancestor} depth={0} />
                                    <div className="absolute left-[1.35rem] md:left-[2.25rem] top-12 bottom-[-1rem] w-0.5 bg-gray-200 dark:bg-zinc-800" />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <CommentThread comment={focusedComment} depth={0} isFocused={true} />
                    </div>
                </div>
            );
        } else {
            setFocusedCommentId(null);
        }
    } else {
        const topLevelComments = comments.filter(c => !c.parentId);
        contentToRender = (
            <div className="space-y-4 pb-20">
                {topLevelComments.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        No messages yet. Be the first to say hello!
                    </div>
                ) : (
                    topLevelComments.map(comment => (
                        <CommentThread key={comment.id} comment={comment} />
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-6 h-full flex flex-col">

            {/* Chat List (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
                {contentToRender}
            </div>

            {/* Input (Fixed at bottom naturally by flex) */}
            <form onSubmit={handleAddComment} className="relative pt-2 border-t border-gray-100 dark:border-zinc-800">
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
                        placeholder={replyingTo ? `Replying to ${replyingTo.author.name}...` : "Message the group..."}
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
                        >
                            <Smile className="w-5 h-5" />
                        </button>
                        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
                        <button
                            type="submit"
                            disabled={!newComment.trim() || loading}
                            className="p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {showEmojiPicker && (
                    <div className="absolute right-0 bottom-full mb-2 z-50">
                        <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.AUTO} />
                    </div>
                )}

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
        </div>
    );
};
