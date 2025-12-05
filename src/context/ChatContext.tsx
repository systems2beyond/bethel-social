'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I am the Bethel Assistant. How can I help you today?',
            timestamp: Date.now(),
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const sendMessage = async (content: string, hiddenContext?: string) => {
        if (!content.trim()) return;

        // Add user message (visible content only)
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        // Navigate to chat if not already there
        if (window.location.pathname !== '/chat') {
            router.push('/chat');
        }

        try {
            const chatFn = httpsCallable(functions, 'chat');
            // Combine content and hidden context for the backend
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
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm sorry, I encountered an error connecting to the server. Please try again later.",
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ChatContext.Provider value={{ messages, isLoading, sendMessage }}>
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
