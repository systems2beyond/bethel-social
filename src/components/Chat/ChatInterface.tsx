'use client';

import React, { useEffect, useRef } from 'react';
import { useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

import { useSearchParams, useRouter } from 'next/navigation';

export function ChatInterface() {
    const { messages, isLoading, sendMessage } = useChat();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const hasInitialized = useRef(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={cn(
                        "flex items-start space-x-4",
                        msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        msg.role === 'user' ? "bg-blue-600" : "bg-purple-600"
                    )}>
                        {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                    </div>

                    <div className={cn(
                        "rounded-2xl px-6 py-4 max-w-[80%] shadow-sm",
                        msg.role === 'user'
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                    )}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                </div>
            ))}

            {isLoading && (
                <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-white" />
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
