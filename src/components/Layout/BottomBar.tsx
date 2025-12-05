'use client';

import React from 'react';
import { Send, Paperclip, Mic } from 'lucide-react';
import { useFeed } from '@/context/FeedContext';
import { useChat } from '@/context/ChatContext';

export function BottomBar() {
    const [input, setInput] = React.useState('');
    const { sendMessage, isLoading } = useChat();
    const { activePost } = useFeed();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        let message = input;
        let context = '';

        // If there is an active post, add context
        if (activePost) {
            console.log('Attaching context from active post:', activePost);
            context = `\n\n[Context: User is looking at a post. Content: "${activePost.content || ''}". Media Type: ${activePost.type || 'unknown'}. Media URL: ${activePost.mediaUrl || 'none'}]`;
        } else {
            console.log('No active post found for context.');
        }

        setInput(''); // Clear immediately for better UX

        // If not on chat page, navigate with query param
        if (window.location.pathname !== '/chat') {
            // Include context in the query param if needed, but better to just pass the user's question
            // and let the context be re-captured? No, context is ephemeral to the feed.
            // We should pass the FULL message including context to the chat page.
            // Wait, if we pass it in query param, it will be visible in URL.
            // The user wants it hidden.
            // But across navigation, we can't hide it easily without global state persistence.
            // For now, let's keep the query param behavior (which might show it in URL but not chat bubble initially?)
            // Actually, ChatInterface reads 'q' and calls sendMessage.
            // If we pass "Message [Context...]" in 'q', ChatInterface will call sendMessage("Message [Context...]").
            // ChatInterface needs to be smart enough to split it? Or we accept it for cross-page nav.
            // Let's stick to the direct call for now (when on same page).

            const fullMessage = message + context;
            window.location.href = `/chat?q=${encodeURIComponent(fullMessage)}`;
            return;
        }

        await sendMessage(message, context);
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4">
            <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <button
                        type="button"
                        className="absolute left-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask the Bible Bot, search sermons, or create a post..."
                        className="w-full pl-12 pr-12 py-4 bg-gray-100 dark:bg-zinc-800 border-none rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-sm"
                    />

                    <div className="absolute right-3 flex items-center space-x-2">
                        {input.trim() ? (
                            <button
                                type="submit"
                                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </form>
                <p className="text-center text-xs text-gray-400 mt-2">
                    AI can make mistakes. Check important info.
                </p>
            </div>
        </div>
    );
}
