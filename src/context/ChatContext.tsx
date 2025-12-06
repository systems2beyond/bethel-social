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
    getDocs,
    limit
} from 'firebase/firestore';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface ChatContextType {
    messages: Message[];
    isLoading: boolean;
    sendMessage: (content: string, hiddenContext?: string) => Promise<void>;
    currentChatId: string | null;
    createNewChat: () => Promise<void>;
    loadChat: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I am the Bethel Assistant. How can I help you today?',
            timestamp: Date.now(),
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const router = useRouter();

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
                timestamp: doc.data().createdAt?.toMillis() || Date.now()
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

    const sendMessage = async (content: string, hiddenContext?: string) => {
        if (!content.trim()) return;

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
                const result = await chatFn({ message: fullMessage });
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
                    title: content.substring(0, 30) + '...',
                    updatedAt: serverTimestamp()
                });
                chatId = chatRef.id;
                setCurrentChatId(chatId);
            }

            // Save user message
            await addDoc(collection(db, 'users', user.uid, 'chats', chatId, 'messages'), {
                role: 'user',
                content,
                createdAt: serverTimestamp()
            });

            // Update chat title if it's the first message (and generic title)
            // (Skipping for brevity, handled by initial create or update)

            // Call AI
            const chatFn = httpsCallable(functions, 'chat');
            const fullMessage = hiddenContext ? `${content}${hiddenContext}` : content;
            const result = await chatFn({ message: fullMessage });
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
        <ChatContext.Provider value={{ messages, isLoading, sendMessage, currentChatId, createNewChat, loadChat }}>
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
