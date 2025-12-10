'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
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

    const registerContextHandler = (handler: ((message: string) => void) | null) => {
        setContextHandler(() => handler);
    };

    // Load initial chat or listen to current chat
    useEffect(() => {
        if (!user || !currentChatId) return;

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

            if (msgs.length > 0) {
                setMessages(msgs);
            }
        });

        return () => unsubscribe();
    }, [user, currentChatId]);

    const createNewChat = async () => {
        if (!user) return;

        const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
            createdAt: serverTimestamp(),
            title: 'New Chat',
            updatedAt: serverTimestamp()
        });

        setCurrentChatId(chatRef.id);
        setMessages([]); // Clear for new chat
    };

    const loadChat = (chatId: string) => {
        setCurrentChatId(chatId);
    };

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

            if (window.location.pathname !== '/chat') {
                router.push('/chat');
            }

            try {
                const chatFn = httpsCallable(functions, 'chat');
                const fullMessage = hiddenContext ? `${content}${hiddenContext}` : content;
                const result = await chatFn({ message: fullMessage, intent });
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
        if (window.location.pathname !== '/chat') {
            router.push('/chat');
        }

        try {
            let chatId = currentChatId;
            if (!chatId) {
                // Create new chat if none exists
                const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
                    createdAt: serverTimestamp(),
                    title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
                    updatedAt: serverTimestamp()
                });
                chatId = chatRef.id;
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

            // Extract history (last 10 messages)
            const history = messages.slice(-10).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                content: m.content
            }));

            // Fetch user profile for personalization
            const userName = userData?.displayName || user.displayName || 'Friend';
            const userPhone = userData?.phoneNumber || null;

            const result = await chatFn({
                message: fullMessage,
                history,
                userName,
                userPhone,
                intent
            });
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

        } catch (error) {
            console.error('Chat error:', error);
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
