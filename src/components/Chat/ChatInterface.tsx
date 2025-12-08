'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
import { Bot, User, Calendar, Mail, X, ImageIcon } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Post } from '@/types';

import { useSearchParams, useRouter } from 'next/navigation';

export function ChatInterface() {
    const { messages, isLoading, sendMessage } = useChat();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const hasInitialized = useRef(false);
    const [activePost, setActivePost] = useState<Post | null>(null);

    // Fetch post context if present
    useEffect(() => {
        const postId = searchParams.get('postId');
        if (postId) {
            const fetchPost = async () => {
                try {
                    const docRef = doc(db, 'posts', postId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setActivePost({ id: docSnap.id, ...docSnap.data() } as Post);
                    }
                } catch (error) {
                    console.error("Error fetching post context:", error);
                }
            };
            fetchPost();
        } else {
            setActivePost(null);
        }
    }, [searchParams]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const renderMessageContent = (content: string) => {
        // Regex to match ACTION tags
        const actionRegex = /\[ACTION:(CALENDAR|EMAIL)\s*\|\s*(.*?)\]/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = actionRegex.exec(content)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(<p key={`text-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed mb-4">{content.substring(lastIndex, match.index)}</p>);
            }

            const type = match[1];
            const params = match[2].split('|').map(p => p.trim());

            if (type === 'CALENDAR') {
                const [title, start, end, location, description] = params;
                const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start.replace(/[-:]/g, '')}/${end.replace(/[-:]/g, '')}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

                parts.push(
                    <a
                        key={`action-${match.index}`}
                        href={googleCalendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group my-2"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-blue-900 dark:text-blue-100">{title}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-300">Add to Calendar</p>
                        </div>
                    </a>
                );
            } else if (type === 'EMAIL') {
                const [to, subject, body] = params;
                const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

                parts.push(
                    <a
                        key={`action-${match.index}`}
                        href={mailtoUrl}
                        className="flex items-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group my-2"
                    >
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-purple-900 dark:text-purple-100">Draft Email to {to.split('@')[0]}</p>
                            <p className="text-xs text-purple-600 dark:text-purple-300">Open Mail App</p>
                        </div>
                    </a>
                );
            }

            lastIndex = actionRegex.lastIndex;
        }

        // Add remaining text
        if (lastIndex < content.length) {
            parts.push(<p key={`text-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed">{content.substring(lastIndex)}</p>);
        }

        return parts.length > 0 ? parts : <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Handle initial message from URL
    useEffect(() => {
        const initialQuery = searchParams.get('q');
        if (initialQuery && !hasInitialized.current) {
            hasInitialized.current = true;

            // Check for context block
            // Format: ... [Context: ...]
            const contextMatch = initialQuery.match(/(\[Context:[\s\S]*?\])$/);
            let message = initialQuery;
            let context = '';

            if (contextMatch) {
                context = contextMatch[1];
                message = initialQuery.replace(contextMatch[1], '').trim();
            }

            sendMessage(message, context);
            // We do NOT clear the query param here because it causes a re-render/navigation
            // that might interrupt the chat flow or reset state.
            // The 'hasInitialized' ref prevents double-sending.
        }
    }, [searchParams, sendMessage]);

    return (
        <div className="flex flex-col space-y-6 py-8 px-4 max-w-3xl mx-auto">
            {activePost && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-purple-100 dark:border-purple-900/50 shadow-sm p-4 flex items-start gap-4 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />

                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                        {activePost.thumbnailUrl ? (
                            <img
                                src={activePost.thumbnailUrl}
                                alt="Post context"
                                className="w-full h-full object-cover"
                            />
                        ) : activePost.mediaUrl && !activePost.mediaUrl.includes('youtu') ? (
                            <img
                                src={activePost.mediaUrl}
                                alt="Post context"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <ImageIcon className="w-6 h-6" />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Context</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">• {activePost.author?.name || 'Bethel Metropolitan'}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 font-medium">
                            {activePost.content}
                        </p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => {
                            setActivePost(null);
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('postId');
                            router.replace(`/chat?${params.toString()}`);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={cn(
                        "flex items-start space-x-4",
                        msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
                        msg.role === 'user' ? "bg-blue-600" : "bg-transparent border border-gray-200 dark:border-gray-700"
                    )}>
                        {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <img src="/images/matthew-avatar.png" alt="Matthew" className="w-full h-full object-cover object-center" />}
                    </div>

                    <div className={cn(
                        "rounded-2xl px-6 py-4 max-w-[80%] shadow-sm",
                        msg.role === 'user'
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                    )}>
                        {renderMessageContent(msg.content)}
                        {msg.intent === 'post' && msg.role === 'assistant' && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 flex items-center space-x-3">
                                <button
                                    onClick={() => {
                                        // TODO: Open real post composer
                                        navigator.clipboard.writeText(msg.content);
                                        alert('Draft copied to clipboard! (Post Composer coming soon)');
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                                >
                                    <span>Use Draft</span>
                                </button>
                                <button
                                    onClick={() => {
                                        // TODO: Open composer with empty state?
                                        alert('Create your own post (Coming soon)');
                                    }}
                                    className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    <span>Edit / Post Manually</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {isLoading && (
                <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700">
                        <img src="/images/matthew-avatar.png" alt="Matthew" className="w-full h-full object-cover object-center" />
                    </div>
                    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl rounded-tl-none px-6 py-4 shadow-sm">
                        <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
}
