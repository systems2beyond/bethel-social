'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Comment } from '@/types';
import { User, Send, MessageCircle, Repeat2, Heart, Share, X, ImageIcon, AlignLeft, Smile, CalendarClock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';

interface CommentsSectionProps {
    postId: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ postId }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [gifs, setGifs] = useState<any[]>([]);
    const [loadingGifs, setLoadingGifs] = useState(false);
    const [gifSearch, setGifSearch] = useState('');
    const GIPHY_API_KEY = 'sgTzkiK7jpgLn20oW2mEQJGNNRZbTMav';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Mock users for mentions
    const MOCK_USERS = [
        { id: 'ai-matthew', name: 'Matthew', handle: 'Matthew', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Matthew&clothing=graphicShirt&eyes=happy&mouth=smile&top=shortHair', isAi: true },
        { id: 'pastor-davis', name: 'Pastor Davis', handle: 'PastorDavis', avatar: null },
        { id: 'sarah-jones', name: 'Sarah Jones', handle: 'SarahJ', avatar: null },
    ];

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

    useEffect(() => {
        if (showGifPicker) {
            fetchGifs();
        }
    }, [showGifPicker, gifSearch]);

    const fetchGifs = async () => {
        setLoadingGifs(true);
        try {
            const endpoint = gifSearch ? 'search' : 'trending';
            const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${GIPHY_API_KEY}&limit=20&rating=g${gifSearch ? `&q=${encodeURIComponent(gifSearch)}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            setGifs(data.data);
        } catch (error) {
            console.error("Error fetching GIFs:", error);
        } finally {
            setLoadingGifs(false);
        }
    };

    const handleGifSelect = (gif: any) => {
        setMediaPreview(gif.images.fixed_height.url);
        setShowGifPicker(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setMediaFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEmojiClick = (emojiData: any) => {
        setNewComment(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        if ((!newComment.trim() && !mediaFile) || !user || loading) return;

        setLoading(true);
        try {
            let mediaUrl = null;
            // TODO: Implement actual file upload to Firebase Storage here
            // For now, we'll just simulate it if there's a preview
            if (mediaPreview) {
                mediaUrl = mediaPreview; // In real app, this would be the Storage URL
            }

            await addDoc(collection(db, 'posts', postId, 'comments'), {
                postId,
                author: {
                    id: user.uid,
                    name: user.displayName || 'Anonymous',
                    avatarUrl: user.photoURL
                },
                content: newComment,
                mediaUrl, // Add media support to Comment type if needed
                timestamp: Date.now() // Use client timestamp for immediate sort, server timestamp for consistency
            });
            setNewComment('');
            setMediaFile(null);
            setMediaPreview(null);
            setShowEmojiPicker(false);
            setShowGifPicker(false);
        } catch (error) {
            console.error("Error adding comment:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-2 pt-2">
            {/* Comments List */}
            <div className="space-y-0 mb-4">
                {comments.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 dark:bg-zinc-800/30 rounded-xl mx-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No comments yet. Start the conversation!
                        </p>
                    </div>
                ) : (
                    comments.map((comment, index) => (
                        <div key={comment.id} className="relative flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                            {/* Thread Line */}
                            {index !== comments.length - 1 && (
                                <div className="absolute left-[2.25rem] top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-zinc-800" />
                            )}

                            {/* Avatar */}
                            <div className="flex-shrink-0 relative z-10">
                                {comment.author.avatarUrl ? (
                                    <img
                                        src={comment.author.avatarUrl}
                                        alt={comment.author.name}
                                        className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-zinc-800"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                                        <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-bold text-[15px] text-gray-900 dark:text-gray-100 truncate">
                                        {comment.author.name}
                                    </span>
                                    {comment.isAi && (
                                        <span className="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                                            AI
                                        </span>
                                    )}
                                    <span className="text-gray-500 dark:text-gray-400 text-[15px]">·</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-[15px] hover:underline cursor-pointer">
                                        {formatDistanceToNow(comment.timestamp, { addSuffix: false }).replace('about ', '')}
                                    </span>
                                </div>

                                <div className="text-[15px] text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-normal">
                                    {comment.content.split(' ').map((word, i) => {
                                        if (word.startsWith('@')) {
                                            return <span key={i} className="text-blue-500 hover:underline cursor-pointer">{word} </span>;
                                        }
                                        return word + ' ';
                                    })}
                                </div>

                                {/* Action Buttons (Mock) */}
                                <div className="flex items-center justify-between mt-3 max-w-md text-gray-500 dark:text-gray-400">
                                    <button className="group flex items-center gap-1 hover:text-blue-500 transition-colors">
                                        <div className="p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                            <MessageCircle className="w-4 h-4" />
                                        </div>
                                    </button>
                                    <button className="group flex items-center gap-1 hover:text-green-500 transition-colors">
                                        <div className="p-1.5 rounded-full group-hover:bg-green-50 dark:group-hover:bg-green-900/20 transition-colors">
                                            <Repeat2 className="w-4 h-4" />
                                        </div>
                                    </button>
                                    <button className="group flex items-center gap-1 hover:text-red-500 transition-colors">
                                        <div className="p-1.5 rounded-full group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-colors">
                                            <Heart className="w-4 h-4" />
                                        </div>
                                    </button>
                                    <button className="group flex items-center gap-1 hover:text-blue-500 transition-colors">
                                        <div className="p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                            <Share className="w-4 h-4" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Comment Input */}
            {user ? (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                    <form onSubmit={handleAddComment} className="flex gap-3">
                        <div className="flex-shrink-0">
                            {user.photoURL ? (
                                <img
                                    src={user.photoURL}
                                    alt={user.displayName || 'User'}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 relative">
                            {/* Mentions Popover */}
                            {showMentions && filteredUsers.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 overflow-hidden z-50">
                                    {filteredUsers.map(u => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => insertMention(u.handle)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
                                        >
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-gray-500" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1">
                                                    {u.name}
                                                    {u.isAi && <span className="bg-blue-100 text-blue-600 text-[10px] px-1 rounded">AI</span>}
                                                </div>
                                                <div className="text-xs text-gray-500">@{u.handle}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Media Preview */}
                            {mediaPreview && (
                                <div className="relative mb-2 inline-block">
                                    <img src={mediaPreview} alt="Preview" className="h-32 rounded-xl border border-gray-200 dark:border-zinc-700" />
                                    <button
                                        type="button"
                                        onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                                        className="absolute -top-2 -right-2 bg-gray-900/80 text-white rounded-full p-1 hover:bg-gray-900"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            <input
                                type="text"
                                value={newComment}
                                onChange={handleTextChange}
                                placeholder="Post your reply"
                                className="w-full bg-transparent border-0 text-lg placeholder-gray-500 dark:text-white focus:ring-0 p-0 mt-1.5"
                                disabled={loading}
                            />

                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800/50">
                                <div className="flex items-center gap-0.5 text-blue-500">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        title="Media"
                                    >
                                        <ImageIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowGifPicker(!showGifPicker)}
                                        className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        title="GIF"
                                    >
                                        <div className="border border-current rounded px-1 text-[10px] font-bold">GIF</div>
                                    </button>
                                    <button
                                        type="button"
                                        className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-50 cursor-not-allowed"
                                        title="Polls (Coming Soon)"
                                        disabled
                                    >
                                        <AlignLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        title="Emoji"
                                    >
                                        <Smile className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        title="Schedule"
                                    >
                                        <CalendarClock className="w-5 h-5" />
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={(!newComment.trim() && !mediaFile) || loading}
                                    className="bg-blue-500 text-white px-4 py-1.5 rounded-full font-bold text-[15px] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Reply
                                </button>
                            </div>

                            {/* Emoji Picker Popover */}
                            {showEmojiPicker && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setShowEmojiPicker(false)}>
                                    <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
                                        <EmojiPicker onEmojiClick={handleEmojiClick} theme={document.documentElement.classList.contains('dark') ? 'dark' as any : 'light' as any} />
                                    </div>
                                </div>
                            )}



                            return (
                            // ... (existing JSX)
                            {/* GIF Picker Popover */}
                            {showGifPicker && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setShowGifPicker(false)}>
                                    <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 p-4" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Select a GIF</h3>
                                            <button onClick={() => setShowGifPicker(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-500">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                value={gifSearch}
                                                onChange={(e) => setGifSearch(e.target.value)}
                                                placeholder="Search GIFs..."
                                                className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-500"
                                            />
                                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                                {loadingGifs ? (
                                                    [1, 2, 3, 4].map(i => (
                                                        <div key={i} className="aspect-video bg-gray-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                                                    ))
                                                ) : (
                                                    gifs.map(gif => (
                                                        <button
                                                            key={gif.id}
                                                            onClick={() => handleGifSelect(gif)}
                                                            className="relative aspect-video rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                                                        >
                                                            <img
                                                                src={gif.images.fixed_height_small.url}
                                                                alt={gif.title}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            ) : (
                <div className="text-center py-4 border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Please sign in to reply.
                    </p>
                </div>
            )}
        </div>
    );
};
