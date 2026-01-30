'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, increment, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Comment } from '@/types'; // Using Comment type for Messages as structure is similar
import { User, Send, MessageCircle, Heart, X, Smile, ChevronLeft, Video, Copy, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { cn } from '@/lib/utils'; // Assuming cn utility is available or remove if not
import VerseLink from '@/components/Bible/VerseLink';

export interface MessageThreadProps {
    conversationId: string;
    onMessageSent?: () => void;
}

// Alias Comment to Message for clarity in this file
type Message = Comment;

export const MessageThread: React.FC<MessageThreadProps> = ({ conversationId, onMessageSent }) => {
    const { user, userData } = useAuth();
    const [editingMessage, setEditingMessage] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

    const handleCopyLink = async (link: string, messageId: string) => {
        try {
            await navigator.clipboard.writeText(link);
            setCopiedLinkId(messageId);
            setTimeout(() => setCopiedLinkId(null), 2000);
        } catch (err) {
            console.error('Failed to copy link', err);
        }
    };
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
    const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
    const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }, []);

    // Collection Refs
    const getMessagesCollection = () => {
        return collection(db, 'direct_messages', conversationId, 'messages');
    };

    const getConversationRef = () => {
        return doc(db, 'direct_messages', conversationId);
    };

    const getMessageRef = (messageId: string) => {
        return doc(db, 'direct_messages', conversationId, 'messages', messageId);
    };

    const getMessageLikeRef = (messageId: string, userId: string) => {
        return doc(db, 'direct_messages', conversationId, 'messages', messageId, 'likes', userId);
    };

    // Listen for messages
    useEffect(() => {
        const q = query(
            getMessagesCollection(),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Message[];
            setMessages(msgs);
        }, (err) => {
            console.error('[MessageThread] Messages listener error:', err);
        });

        return () => unsubscribe();
    }, [conversationId]);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newMessage.trim() || loading) return;

        setLoading(true);
        try {
            const messageData = {
                conversationId,
                author: {
                    id: user.uid,
                    name: userData?.displayName || user.displayName || 'Anonymous',
                    avatarUrl: user.photoURL
                },
                content: newMessage,
                mediaUrl: null,
                timestamp: Date.now(),
                parentId: replyingTo ? replyingTo.id : (focusedMessageId || null)
            };

            await addDoc(getMessagesCollection(), messageData);

            // Update conversation last message
            await updateDoc(getConversationRef(), {
                lastMessage: newMessage,
                lastMessageTimestamp: Date.now(),
                lastMessageAuthorId: user.uid,
                readBy: [user.uid] // Only sender has read the new message
            });

            if (onMessageSent) {
                onMessageSent();
            }

            setNewMessage('');
            setShowEmojiPicker(false);
            setReplyingTo(null);

            // If replying, expand the thread
            if (replyingTo) {
                setExpandedThreads(prev => new Set(prev).add(replyingTo.id));
            }
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMessageLike = async (messageId: string) => {
        if (!user) return;

        const likeRef = getMessageLikeRef(messageId, user.uid);
        const messageRef = getMessageRef(messageId);

        try {
            const likeDoc = await getDoc(likeRef);
            if (likeDoc.exists()) {
                await deleteDoc(likeRef);
                await updateDoc(messageRef, { likes: increment(-1) });
            } else {
                await setDoc(likeRef, {
                    timestamp: serverTimestamp(),
                    userId: user.uid,
                    userName: userData?.displayName || user.displayName,
                    userPhoto: user.photoURL
                });
                await updateDoc(messageRef, { likes: increment(1) });
            }
        } catch (error) {
            console.error("Error toggling message like:", error);
        }
    };

    const toggleThreadCollapse = (messageId: string) => {
        setCollapsedThreads(prev => {
            const next = new Set(prev);
            if (next.has(messageId)) next.delete(messageId);
            else next.add(messageId);
            return next;
        });
    };

    const getAncestors = (messageId: string, allMessages: Message[]): Message[] => {
        const ancestors: Message[] = [];
        let currentMessage = allMessages.find(m => m.id === messageId);
        while (currentMessage && currentMessage.parentId) {
            const parent = allMessages.find(m => m.id === currentMessage!.parentId);
            if (parent) {
                ancestors.unshift(parent);
                currentMessage = parent;
            } else {
                break;
            }
        }
        return ancestors;
    };

    // Recursive Thread Rendering
    const MessageItem = ({ message, depth = 0, isFocused = false }: { message: Message, depth?: number, isFocused?: boolean }) => {
        const [isLiked, setIsLiked] = useState(false);
        const isCollapsed = collapsedThreads.has(message.id);
        const directReplies = messages.filter(m => m.parentId === message.id);

        useEffect(() => {
            if (!user) return;
            const likeRef = getMessageLikeRef(message.id, user.uid);
            const unsubscribe = onSnapshot(likeRef, (doc) => {
                setIsLiked(doc.exists());
            }, (err) => {
                // Suppress permission errors for likes to avoid console spam
            });
            return () => unsubscribe();
        }, [message.id, user]);

        // Determine visible replies based on focus state
        let visibleReplies: Message[] = [];
        if (focusedMessageId === message.id && !isCollapsed) {
            visibleReplies = directReplies;
        }

        return (
            <div className={`relative ${depth > 0 ? 'mt-3' : 'mt-4'}`}>
                {/* Visual Connector for thread context (only if displaying ancestors) */}
                {depth === 0 && !isFocused && focusedMessageId && (
                    <div className="absolute left-[1.35rem] top-10 bottom-[-1rem] w-0.5 bg-slate-200 dark:bg-zinc-800" />
                )}

                <div className={`flex gap-3 px-3 py-2 rounded-lg transition-colors group ${isFocused ? 'bg-indigo-50/50 dark:bg-indigo-900/10 ring-1 ring-indigo-100 dark:ring-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'}`}>
                    {/* Avatar */}
                    <div className="flex-shrink-0 relative z-10">
                        {message.author.avatarUrl ? (
                            <img src={message.author.avatarUrl} alt={message.author.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                <User className="w-4 h-4 text-indigo-500" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{message.author.name}</span>
                            <span className="text-xs text-slate-400">{formatDistanceToNow(message.timestamp, { addSuffix: true })}</span>
                        </div>

                        {!isCollapsed && (
                            <>
                                {message.type === 'video_call_invite' ? (
                                    <div className="mt-2 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                                <Video className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">Video Call Invite</p>
                                                <p className="text-xs text-gray-500">Starting now</p>
                                            </div>
                                        </div>
                                        <a
                                            href={message.metadata?.meetLink}
                                            target={isMobile ? undefined : "_blank"}
                                            rel={isMobile ? undefined : "noopener noreferrer"}
                                            className="block w-full text-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] no-underline"
                                        >
                                            Join Video Call
                                        </a>
                                        <div className="mt-3 p-2 bg-white/50 dark:bg-black/20 rounded-lg border border-indigo-50 dark:border-indigo-900/40 flex items-center justify-between gap-2 overflow-hidden">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] uppercase font-bold text-indigo-400 dark:text-indigo-500 mb-0.5">Meeting Link</p>
                                                <p className="text-xs text-indigo-600 dark:text-indigo-300 truncate font-mono">
                                                    {message.metadata?.meetLink}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleCopyLink(message.metadata?.meetLink, message.id || message.timestamp.toString())}
                                                className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-md transition-colors shrink-0"
                                                title="Copy Link"
                                            >
                                                {copiedLinkId === (message.id || message.timestamp.toString()) ? (
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-indigo-400" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                                        <VerseLink text={message.content} />
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mt-2">
                                    <button
                                        onClick={() => {
                                            setReplyingTo(message);
                                            textareaRef.current?.focus();
                                        }}
                                        className="text-xs text-slate-500 hover:text-indigo-500 flex items-center gap-1 transition-colors"
                                    >
                                        <MessageCircle className="w-3 h-3" />
                                        Reply
                                    </button>
                                    <button
                                        onClick={() => handleMessageLike(message.id)}
                                        className={`text-xs flex items-center gap-1 transition-colors ${isLiked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-500'}`}
                                    >
                                        <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
                                        {message.likes || 0}
                                    </button>

                                    {/* Drill-down Button */}
                                    {directReplies.length > 0 && focusedMessageId !== message.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFocusedMessageId(message.id);
                                            }}
                                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
                                        >
                                            <div className="w-6 h-px bg-indigo-200 dark:bg-indigo-800 mr-1" />
                                            View {directReplies.length} {directReplies.length === 1 ? 'reply' : 'replies'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Replies (Only shown if focused) */}
                {!isCollapsed && visibleReplies.length > 0 && (
                    <div className="ml-4 md:ml-12 mt-2 space-y-2">
                        {visibleReplies.map(reply => (
                            <MessageItem key={reply.id} message={reply} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const topLevelMessages = messages.filter(m => !m.parentId);

    // Logic for what to render based on focus
    let contentToRender;
    if (focusedMessageId) {
        const focusedMessage = messages.find(m => m.id === focusedMessageId);
        if (focusedMessage) {
            const ancestors = getAncestors(focusedMessageId, messages);
            contentToRender = (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <button
                        onClick={() => setFocusedMessageId(null)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors mb-2"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to full conversation
                    </button>

                    {/* Ancestors */}
                    {ancestors.map(ancestor => (
                        <div key={ancestor.id} className="relative opacity-75">
                            <MessageItem message={ancestor} depth={0} />
                        </div>
                    ))}

                    {/* Active Conversation Root */}
                    <div className="relative">
                        <MessageItem message={focusedMessage} depth={0} isFocused={true} />
                    </div>
                </div>
            );
        } else {
            // Fallback
            setFocusedMessageId(null);
        }
    } else {
        // Default View: Top Level
        contentToRender = (
            <div className="space-y-1">
                {topLevelMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 py-12">
                        <MessageCircle className="w-12 h-12 mb-2" />
                        <p className="text-sm">No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    topLevelMessages.map(msg => (
                        <MessageItem key={msg.id} message={msg} />
                    ))
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
            {/* Messages List Area - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {contentToRender}
            </div>

            {/* Input Area - Fixed at bottom, shifted up on mobile to avoid AI bar */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 mb-[76px] md:mb-0">
                <form onSubmit={handleSendMessage} className="relative">
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-t-lg text-xs text-indigo-600 dark:text-indigo-400 mb-1">
                            <span>Replying to {replyingTo.author.name}</span>
                            <button type="button" onClick={() => setReplyingTo(null)}>
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-zinc-800/50 p-2 rounded-2xl border border-slate-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder={replyingTo ? "Type a reply..." : "Type a message..."}
                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[40px] py-2 px-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            rows={1}
                        />

                        <div className="flex items-center gap-1 pb-1">
                            <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="p-2 text-slate-400 hover:text-yellow-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full transition-colors"
                            >
                                <Smile className="w-5 h-5" />
                            </button>
                            <button
                                type="submit"
                                disabled={!newMessage.trim() || loading}
                                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </button>
                        </div>
                    </div>

                    {showEmojiPicker && (
                        <div className="absolute right-0 bottom-full mb-2 z-50">
                            <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.AUTO} />
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};
