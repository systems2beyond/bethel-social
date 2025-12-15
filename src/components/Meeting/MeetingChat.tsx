'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, setDoc, increment, getDoc } from 'firebase/firestore';
import { Comment } from '@/types'; // Reuse Comment type
import { User, Send, MessageCircle, Heart, X, Smile } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { cn } from '@/lib/utils';

interface MeetingChatProps {
    meetingId: string;
}

export const MeetingChat: React.FC<MeetingChatProps> = ({ meetingId }) => {
    const { user, userData } = useAuth();
    const [messages, setMessages] = useState<Comment[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Load Messages
    useEffect(() => {
        // We act as if 'meetings' is a 'post' with 'comments' subcollection for simplicity
        // But for clarity we'll use 'meetings/{id}/chat'
        const q = query(
            collection(db, 'meetings', meetingId, 'chat'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [meetingId]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newMessage.trim() || loading) return;

        setLoading(true);
        try {
            await addDoc(collection(db, 'meetings', meetingId, 'chat'), {
                author: {
                    id: user.uid,
                    name: userData?.displayName || user.displayName || 'Anonymous',
                    avatarUrl: user.photoURL
                },
                content: newMessage,
                timestamp: Date.now(),
                likes: 0
            });
            setNewMessage('');
            setShowEmojiPicker(false);
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setLoading(false);
            // Auto scroll? usually handled by a ref at bottom
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    // Scroll to bottom on new message
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Meeting Chat</h3>
                <span className="text-xs text-gray-500">{messages.length} messages</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                        <p>No messages yet.</p>
                        <p>Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.author.id === user?.uid;
                        return (
                            <div key={msg.id} className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
                                {/* Avatar */}
                                <div className="shrink-0">
                                    {msg.author.avatarUrl ? (
                                        <img src={msg.author.avatarUrl} className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 text-xs font-bold">
                                            {msg.author.name[0]}
                                        </div>
                                    )}
                                </div>

                                {/* Bubble */}
                                <div className={cn(
                                    "max-w-[75%]",
                                    "flex flex-col",
                                    isMe ? "items-end" : "items-start"
                                )}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-gray-500 font-medium">{msg.author.name}</span>
                                        <span className="text-[10px] text-gray-400">{formatDistanceToNow(msg.timestamp, { addSuffix: true })}</span>
                                    </div>
                                    <div className={cn(
                                        "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                                        isMe
                                            ? "bg-blue-600 text-white rounded-tr-none"
                                            : "bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                                    )}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-gray-50 dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 relative">
                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div className="absolute left-0 bottom-full mb-2 z-50">
                        <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.AUTO} width={300} height={350} />
                    </div>
                )}

                <div className="relative flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"
                    >
                        <Smile className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-white dark:bg-zinc-900 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || loading}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
};
