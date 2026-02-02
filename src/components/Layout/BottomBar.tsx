'use client';

import React from 'react';
import { Send, Paperclip, Mic, Plus, ExternalLink } from 'lucide-react';
import { useFeed } from '@/context/FeedContext';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { PostComposer } from '../Feed/PostComposer';

// Public routes that don't need bottom bar
const PUBLIC_ROUTES = ['/connect', '/events/', '/giving'];

export function BottomBar() {
    const [input, setInput] = React.useState('');
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [mode, setMode] = React.useState<'chat' | 'post'>('chat');
    const [isComposerOpen, setIsComposerOpen] = React.useState(false);
    const { sendMessage, isLoading, hasContextHandler } = useChat();
    const { activePost } = useFeed();
    const { userData } = useAuth();
    const menuRef = React.useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const router = useRouter();

    // Don't render on public pages
    if (PUBLIC_ROUTES.some(route => pathname?.startsWith(route))) {
        return null;
    }

    // Close menu when clicking outside
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        let message = input;
        let context = '';

        // If there is an active post, add context
        if (activePost) {
            console.log('[DEBUG_BOTTOMBAR] Attaching context from active post:', activePost.id);
            context = `\n\n[Context: User is looking at a post. Content: "${activePost.content || ''}". Media Type: ${activePost.type || 'unknown'}. Media URL: ${activePost.mediaUrl || 'none'}]`;
        } else {
            console.log('[DEBUG_BOTTOMBAR] No active post found for context. (Benign if standard chat)');
        }

        setInput(''); // Clear immediately for better UX

        try {
            console.log(`[DEBUG_BOTTOMBAR] Attempting to send message. Length: ${message.length}, Mode: ${mode}, Path: ${pathname}`);

            // If context handler exists (e.g. Notes Modal open), use it instead of navigating
            if (hasContextHandler) {
                console.log('[DEBUG_BOTTOMBAR] Handing off to Context Handler (e.g. Modal)');
                await sendMessage(message, context, { intent: mode });
                return;
            }

            // Normalize pathname (remove trailing slash) to prevent unnecessary navigation
            const normalizedPath = pathname?.replace(/\/$/, '') || '';
            const isChatPage = normalizedPath === '/chat';

            // If not on chat page, navigate with query param
            if (!isChatPage) {
                console.log(`[DEBUG_BOTTOMBAR] Navigating to /chat (Current: ${pathname}, Normalized: ${normalizedPath})`);
                const fullMessage = message + context;
                router.push(`/chat?q=${encodeURIComponent(fullMessage)}&intent=${mode}`);
                return;
            }

            console.log('[DEBUG_BOTTOMBAR] Calling ChatContext.sendMessage direct');
            await sendMessage(message, context, { intent: mode });
            console.log('[DEBUG_BOTTOMBAR] sendMessage completed successfully');
        } catch (error) {
            console.error("Failed to send message:", error);
            setInput(message); // Restore input on error
        }
    };

    const canCreatePost = userData?.role === 'admin' || userData?.role === 'staff' || userData?.role === 'super_admin';

    return (
        <>
            <div id="main-bottom-bar" className="bottom-bar absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4 z-10">
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleSubmit} className="relative flex items-center">

                        {/* Plus Button & Menu */}
                        <div className="absolute left-4 z-20" ref={menuRef}>
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`p-2 rounded-full transition-colors ${isMenuOpen ? 'bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                            >
                                <Plus className="w-5 h-5" />
                            </button>

                            {isMenuOpen && (
                                <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 overflow-hidden py-1 animate-in fade-in slide-in-from-bottom-2">
                                    <button
                                        type="button"
                                        onClick={() => { setMode('chat'); setIsMenuOpen(false); }}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-zinc-700 ${mode === 'chat' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                                    >
                                        <span>Ask Matthew</span>
                                    </button>

                                    {canCreatePost && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => { setMode('post'); setIsMenuOpen(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-zinc-700 ${mode === 'post' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                                            >
                                                <span>Create Post (AI)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setIsComposerOpen(true); setIsMenuOpen(false); }}
                                                className="w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300"
                                            >
                                                <span>Create Post (Manual)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setIsComposerOpen(true); setIsMenuOpen(false); }}
                                                className="w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300"
                                            >
                                                <span>Upload Media</span>
                                            </button>
                                            <a
                                                href="https://www.canva.com/create/social-media-graphics/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="w-full text-left px-4 py-2 text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300"
                                            >
                                                <span className="flex-1">Design in Canva</span>
                                                <ExternalLink className="w-3 h-3 opacity-50" />
                                            </a>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <input
                            id="global-chat-input"
                            name="global-chat-input"
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={mode === 'post' ? "Describe the post you want to create..." : "Ask Matthew, or Search Sermons..."}
                            className="w-full pl-16 pr-12 py-4 bg-gray-100 dark:bg-zinc-800 border-none rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-sm"
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
                        {mode === 'post' ? 'AI will draft a post for you to review.' : 'AI can make mistakes. Check important info.'}
                    </p>
                </div>
            </div>

            <PostComposer
                isOpen={isComposerOpen}
                onClose={() => setIsComposerOpen(false)}
            />
        </>
    );
}
