'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePlatformContext } from '@/hooks/usePlatformContext';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    setDoc,
    getDoc,
    getDocs,
    limit
} from 'firebase/firestore';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    intent?: 'chat' | 'post';
}

interface ChatContextType {
    messages: Message[];
    isLoading: boolean;
    sendMessage: (content: string, hiddenContext?: string, options?: { intent?: 'chat' | 'post' }) => Promise<void>;
    currentChatId: string | null;
    createNewChat: () => Promise<void>;
    loadChat: (chatId: string) => void;
    registerContextHandler: (handler: ((message: string) => void) | null) => void;
    hasContextHandler: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const { user, userData } = useAuth();
    const { contextString } = usePlatformContext();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I am Matthew, your Bethel Assistant. How can I help you today?',
            timestamp: Date.now(),
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [contextHandler, setContextHandler] = useState<((message: string) => void) | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    // Safety Watchdog: Reset isLoading if it gets stuck for too long (15s)
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoading) {
            timer = setTimeout(() => {
                console.warn('[ChatContext] Safety Watchdog: Resetting stuck isLoading state');
                setIsLoading(false);
            }, 15000);
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    const registerContextHandler = React.useCallback((handler: ((message: string) => void) | null) => {
        setContextHandler(() => handler);
    }, []);

    // Load/Listen to current chat
    useEffect(() => {
        if (!user || !currentChatId) {
            return;
        }

        console.log(`[ChatContext] Switching file to: ${currentChatId}`);
        // Clear previous messages immediately (visual reset)
        setMessages([]);

        // 1. Try to load from LocalStorage first (Cache-First Strategy for speed/offline support)
        const storageKey = `chat_history_${user.uid}_${currentChatId}`;
        try {
            const cached = localStorage.getItem(storageKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    console.log(`[ChatContext] Loaded ${parsed.length} messages from cache for ${currentChatId}`);
                    setMessages(parsed);
                } else {
                    console.log(`[ChatContext] Cache empty for ${currentChatId}`);
                }
            }
        } catch (e) {
            console.error("Failed to load chat cache:", e);
        }

        // 2. Subscribe to Firestore (Real-time updates)
        const q = query(
            collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                role: doc.data().role,
                content: doc.data().content,
                timestamp: doc.data().createdAt?.toMillis() || Date.now(),
                intent: doc.data().intent
            })) as Message[];

            console.log(`[DEBUG_CHAT] Snapshot fired for ${currentChatId}. Server Msgs: ${msgs.length}`);

            // MERGE Logic: Don't just overwrite.
            setMessages(prev => {
                // SAFETY CLAMP: If server returns empty but we have data, assume it's a "Blocked" false-positive.
                // Exception: If we explicitly cleared chat (not handled here, usually separate state).
                if (msgs.length === 0 && prev.length > 0) {
                    console.warn('[DEBUG_CHAT] Snapshot empty but local state populated. Ignoring empty snapshot to prevent data loss (AdBlock protection).');
                    return prev;
                }

                const serverIds = new Set(msgs.map(m => m.id));

                // Keep local 'temp_' AND 'welcome_' messages that haven't been confirmed by server yet
                // FIX: Deduplicate by Content+Role to prevent 'Double Messages' (TempID vs ServerID)
                const pending = prev.filter(m => m.id.toString().startsWith('temp_') || m.id.toString().startsWith('welcome_'));

                const stillPending = pending.filter(p => {
                    // 1. Check ID equality (standard)
                    if (serverIds.has(p.id)) return false;

                    // 2. Check Content+Role equality (for temp_ messages that got real IDs)
                    const isConfirmed = msgs.some(s =>
                        s.role === p.role &&
                        s.content.trim() === p.content.trim() &&
                        // Optional: Check timestamp proximity? No, content should be enough for chat.
                        // Ideally checking unique IDs is best, but we don't know the server ID yet.
                        true
                    );

                    if (p.id.toString().startsWith('temp_') && isConfirmed) {
                        return false; // It's on the server now
                    }

                    return true;
                });

                if (msgs.length === 0 && stillPending.length === 0) {
                    console.log(`[DEBUG_CHAT] No messages to show.`);
                    return [];
                }

                // Combine: Server Messages + Pending Local Messages
                // We trust server order, then append pending at bottom
                const combined = [...msgs];
                stillPending.forEach(p => {
                    if (!serverIds.has(p.id)) {
                        combined.push(p);
                    }
                });

                console.log(`[DEBUG_CHAT] Merge Result: ${combined.length} msgs. (Server: ${msgs.length}, Preserved: ${stillPending.length})`);
                return combined;
            });

            if (msgs.length > 0) {
                console.log(`[ChatContext] Firestore snapshot received ${msgs.length} messages`);
            }
        }, (error) => {
            console.error("Chat snapshot error (likely blocked):", error);
            // On error, we rely on the cache we loaded above.
        });

        return () => unsubscribe();
    }, [user, currentChatId]);

    // Persist messages to LocalStorage whenever they change
    useEffect(() => {
        if (!user || !currentChatId || messages.length === 0) return;
        const storageKey = `chat_history_${user.uid}_${currentChatId}`;
        localStorage.setItem(storageKey, JSON.stringify(messages));
    }, [messages, user, currentChatId]);

    const createNewChat = React.useCallback(async () => {
        if (!user) return;

        // ... (Welcome Message Logic remains same)
        const WELCOME_MESSAGE: Message = {
            id: 'welcome_' + Date.now(),
            role: 'assistant',
            content: 'Hello! I am Matthew, your Bethel Assistant. How can I help you today?',
            timestamp: Date.now(),
        };

        try {
            // Wrap in timeout
            const chatRef = await withTimeout(addDoc(collection(db, 'users', user.uid, 'chats'), {
                createdAt: serverTimestamp(),
                title: 'New Chat',
                updatedAt: serverTimestamp()
            }));

            // ... (LocalStorage seed remains)
            const storageKey = `chat_history_${user.uid}_${chatRef.id}`;
            localStorage.setItem(storageKey, JSON.stringify([WELCOME_MESSAGE]));

            setCurrentChatId(chatRef.id);
            setMessages([WELCOME_MESSAGE]);
        } catch (error: any) {
            // ... (Fallback logic remains same)
            console.error("Error creating new chat:", error);
            if (error?.message?.includes('BLOCKED_BY_CLIENT') || error?.code === 'unavailable' || error?.message === 'Timeout') {
                const fallbackId = 'fallback_' + Date.now();
                console.log('AdBlock likely detected (or Timeout). Entering offline/fallback mode with ID:', fallbackId);
                const storageKey = `chat_history_${user.uid}_${fallbackId}`;
                localStorage.setItem(storageKey, JSON.stringify([WELCOME_MESSAGE]));
                setCurrentChatId(fallbackId);
                setMessages([WELCOME_MESSAGE]);
            }
        }
    }, [user]);

    // Helper for timing out promises (fail fast for AdBlock)
    const withTimeout = async <T,>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timeout')), ms);
            promise
                .then(val => {
                    clearTimeout(timer);
                    resolve(val);
                })
                .catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    };

    const loadChat = React.useCallback((chatId: string) => {
        setCurrentChatId(chatId);
    }, []);

    const sendMessage = async (content: string, hiddenContext?: string, options: { intent?: 'chat' | 'post' } = {}) => {
        if (!content.trim()) return;

        // Check for context override
        if (contextHandler) {
            contextHandler(content);
            return;
        }

        const intent = options.intent || 'chat';

        // Optimistic update for local state (if not using Firestore yet)
        if (!user) {
            const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                content,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, userMsg]);
            setIsLoading(true);

            // Normalize path check
            const normalizedPath = pathname?.replace(/\/$/, '') || '';
            if (normalizedPath !== '/chat') {
                router.push('/chat');
            }

            try {
                const chatFn = httpsCallable(functions, 'chat');
                const fullMessage = hiddenContext ? `${content}${hiddenContext}` : content;
                // Inject Platform Context
                const messageWithContext = contextString ? `${fullMessage}\n\n${contextString}` : fullMessage;

                const result = await chatFn({ message: messageWithContext, intent });
                const data = result.data as { response: string };

                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.response,
                    timestamp: Date.now(),
                };
                setMessages(prev => [...prev, botMsg]);
            } catch (error) {
                console.error('Chat error:', error);
                // Error handling...
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Authenticated flow
        setIsLoading(true);
        // Normalize path check
        const normalizedPath = pathname?.replace(/\/$/, '') || '';
        if (normalizedPath !== '/chat') {
            router.push('/chat');
        }

        // 1. INSTANT OPTIMISTIC UPDATE
        const tempId = 'temp_' + Date.now();
        console.log(`[DEBUG_CHAT] Optimistic Update Triggered. TempID: ${tempId}`);
        const userMsg: Message = {
            id: tempId,
            role: 'user',
            content,
            timestamp: Date.now(),
        };
        // Update State
        setMessages(prev => {
            console.log(`[DEBUG_CHAT] setMessages (Optimistic). Prev count: ${prev.length}`);
            return [...prev, userMsg];
        });

        let chatId = currentChatId;

        // Ensure we persist this pending message to LocalStorage immediately
        if (chatId) {
            const storageKey = `chat_history_${user.uid}_${chatId}`;
            const cached = localStorage.getItem(storageKey);
            const currentMsgs = cached ? JSON.parse(cached) : messages;
            // Deduplicate
            if (!currentMsgs.find((m: Message) => m.id === tempId)) {
                const updated = [...currentMsgs, userMsg];
                localStorage.setItem(storageKey, JSON.stringify(updated));
            }
        }

        try {
            if (!chatId) {
                // Create new chat if none exists
                const chatRef = await withTimeout(addDoc(collection(db, 'users', user.uid, 'chats'), {
                    createdAt: serverTimestamp(),
                    title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
                    updatedAt: serverTimestamp()
                }));
                chatId = chatRef.id;

                // SEED LOCAL STORAGE IMMEDIATELY
                // This prevents the screen from wiping when we switch IDs below
                const WELCOME_MESSAGE: Message = {
                    id: 'welcome_' + Date.now(),
                    role: 'assistant',
                    content: 'Hello! I am Matthew, your Bethel Assistant. How can I help you today?',
                    timestamp: Date.now(),
                };
                const storageKey = `chat_history_${user.uid}_${chatId}`;
                localStorage.setItem(storageKey, JSON.stringify([WELCOME_MESSAGE, userMsg]));

                setCurrentChatId(chatId);
            } else {
                // Check if we need to update the title (if it's still "New Chat")
                const chatDocRef = doc(db, 'users', user.uid, 'chats', chatId);
                const chatDoc = await getDoc(chatDocRef);
                if (chatDoc.exists() && chatDoc.data().title === 'New Chat') {
                    await setDoc(chatDocRef, {
                        title: content.substring(0, 30) + (content.length > 30 ? '...' : '')
                    }, { merge: true });
                }
            }

            // Save user message
            await addDoc(collection(db, 'users', user.uid, 'chats', chatId, 'messages'), {
                role: 'user',
                content,
                createdAt: serverTimestamp(),
                intent // Store intent for debugging/history
            });

            // Call AI
            const chatFn = httpsCallable(functions, 'chat');
            const fullMessage = hiddenContext ? `${content}${hiddenContext}` : content;
            // Inject Platform Context
            const messageWithContext = contextString ? `${fullMessage}\n\n${contextString}` : fullMessage;

            // Extract history (last 10 messages)
            const history = messages.slice(-10).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                content: m.content
            }));

            // Fetch user profile for personalization
            const userName = userData?.displayName || user.displayName || 'Friend';
            const userPhone = userData?.phoneNumber || null;

            const result = await withTimeout(chatFn({
                message: messageWithContext,
                history,
                userName,
                userPhone,
                intent
            }), 10000); // 10s generous timeout for AI generation, but fails fast if network blocked
            const data = result.data as { response: string };

            // Save bot response
            await addDoc(collection(db, 'users', user.uid, 'chats', chatId, 'messages'), {
                role: 'assistant',
                content: data.response,
                createdAt: serverTimestamp()
            });

            // Update chat timestamp
            await setDoc(doc(db, 'users', user.uid, 'chats', chatId), {
                updatedAt: serverTimestamp()
            }, { merge: true });

        } catch (error: any) {
            console.error('Chat error:', error);

            // Check for Blocking/Network errors and try fallback
            if (error?.message?.includes('BLOCKED_BY_CLIENT') || error?.code === 'unavailable' || error?.message?.includes('Failed to fetch') || error?.message === 'Timeout') {
                console.log('Attempting server-side fallback for chat...');

                try {
                    // Optimistically add user message to UI since onSnapshot is blocked
                    // Msg is already in state from top-level optimistic update.
                    // preserving logic...

                    const token = await user.getIdToken();
                    // Prepare history
                    const history = messages.slice(-10).map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        content: m.content
                    }));
                    const userName = userData?.displayName || user.displayName || 'Friend';
                    const userPhone = userData?.phoneNumber || null;

                    // Ensure we have a working ID
                    const effectiveChatId = chatId || currentChatId || ('fallback_' + Date.now());

                    console.log(`[DEBUG_CHAT] Starting Fallback Sequence for ID: ${effectiveChatId}`);

                    // CRITICAL: Save to LocalStorage IMMEDIATELY under the NEW ID.
                    // This prevents the 'useEffect' from wiping the screen when we switch IDs.
                    const storageKey = `chat_history_${user.uid}_${effectiveChatId}`;
                    const updatedMessagesWithUser = [...messages, userMsg];
                    localStorage.setItem(storageKey, JSON.stringify(updatedMessagesWithUser));

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

                    const response = await fetch('/api/chat/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            message: content,
                            chatId: effectiveChatId,
                            context: hiddenContext,
                            intent,
                            history,
                            userName,
                            userPhone
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error('Fallback failed');
                    }

                    const data = await response.json();
                    if (data.response) {
                        // Success! 
                        const botMsg: Message = {
                            id: 'temp_bot_' + Date.now().toString(), // Use temp_ prefix to persist via onSnapshot merge
                            role: 'assistant',
                            content: data.response,
                            timestamp: Date.now(),
                        };

                        // Save BOT message to LocalStorage immediately too
                        const finalMessages = [...updatedMessagesWithUser, botMsg];
                        localStorage.setItem(storageKey, JSON.stringify(finalMessages));

                        // CRITICAL: Update currentChatId so subsequent messages use the same "fallback" chat.
                        if (!currentChatId || currentChatId !== effectiveChatId) {
                            setCurrentChatId(effectiveChatId);
                        }

                        // Update State
                        setMessages(prev => [...prev, botMsg]);
                        return; // Successfully handled via fallback
                    }

                } catch (fallbackError) {
                    console.error('Fallback chat failed:', fallbackError);
                    alert("Message failed to send. Please check your internet connection.");
                }
            } else {
                throw error; // Re-throw if it wasn't a handled error type
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ChatContext.Provider value={{ messages, isLoading, sendMessage, currentChatId, createNewChat, loadChat, registerContextHandler, hasContextHandler: !!contextHandler }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
