'use client';

import React, { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Send, User, Bot, Loader2, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

interface Message {
    id: string;
    role: 'user' | 'bot';
    content: string;
    handoff?: boolean;
}

export const BibleBot: React.FC = () => {
    const { user, userData } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '0', role: 'bot', content: 'Hello! I am the Bethel Bible Bot. Ask me anything about our sermons or the Bible.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const chatFn = httpsCallable(functions, 'chat');
            const userName = userData?.displayName || user?.displayName;
            const userPhone = userData?.phoneNumber;

            const result = await chatFn({
                message: userMsg.content,
                history: [],
                userName,
                userPhone
            }) as any;

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: result.data.response,
                handoff: result.data.handoff
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleOpen = () => {
        const newState = !isOpen;
        setIsOpen(newState);

        // Notify parent window (if in iframe)
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'TOGGLE_CHAT', isOpen: newState }, '*');
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={toggleOpen}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-blue-700 transition-colors z-50"
            >
                {isOpen ? (
                    <span className="text-2xl font-bold">×</span>
                ) : (
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/20">
                        <img src="/images/matthew-avatar.png" alt="Chat" className="w-full h-full object-cover object-center" />
                    </div>
                )}
            </button >

            {/* Chat Window */}
            <AnimatePresence>
                {
                    isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50"
                        >
                            {/* Header */}
                            <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30">
                                        <img src="/images/matthew-avatar.png" alt="Matthew" className="w-full h-full object-cover object-center" />
                                    </div>
                                    <span className="font-semibold">Matthew (AI)</span>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-none'
                                                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm'
                                                }`}
                                        >
                                            {msg.content}
                                            {msg.handoff && (
                                                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center text-blue-600 font-medium">
                                                    <Phone className="w-4 h-4 mr-2" />
                                                    <span>Staff Notified</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-200">
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-100">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask a question..."
                                        className="flex-1 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !input.trim()}
                                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )
                }
            </AnimatePresence >
        </>
    );
};
