'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Sermon } from '@/types';
import { Calendar, FileText, Edit3, Send, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// Simple Tab Component
const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active
            ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
    >
        <Icon className="w-4 h-4" />
        {label}
    </button>
);

import { useSearchParams } from 'next/navigation';

export default function SermonDetailClient({ id }: { id: string }) {
    const { user, userData } = useAuth();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') === 'notes' ? 'notes' : 'outline';

    const [sermon, setSermon] = useState<Sermon | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'outline' | 'notes'>(initialTab);

    // Notes State
    const [notes, setNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);

    // AI Chat State
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Fetch Sermon Data
    useEffect(() => {
        const fetchSermon = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, 'sermons', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSermon({ id: docSnap.id, ...docSnap.data() } as Sermon);
                }
            } catch (error) {
                console.error('Error fetching sermon:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSermon();
    }, [id]);

    // Fetch User Notes & Chat History
    useEffect(() => {
        if (!user || !id) return;

        // 1. Fetch Notes
        const notesRef = doc(db, 'users', user.uid, 'sermon_notes', id);
        const unsubscribeNotes = onSnapshot(notesRef, (doc) => {
            if (doc.exists()) {
                setNotes(doc.data().notes || '');
            }
        });

        // 2. Fetch Chat History (Subcollection of sermon_notes)
        const chatQuery = query(
            collection(db, 'users', user.uid, 'sermon_notes', id, 'chat'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setMessages(msgs);
        });

        return () => {
            unsubscribeNotes();
            unsubscribeChat();
        };
    }, [user, id]);

    // Save Notes (Debounced ideally, but simple save on blur/change for now)
    const handleSaveNotes = async (newNotes: string) => {
        setNotes(newNotes);
        if (!user || !id) return;

        setSavingNotes(true);
        try {
            const notesRef = doc(db, 'users', user.uid, 'sermon_notes', id);
            await setDoc(notesRef, {
                notes: newNotes,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving notes:', error);
        } finally {
            setSavingNotes(false);
        }
    };

    // Handle AI Chat
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || aiLoading || !user) return;

        const userMsg = input;
        setInput('');
        setAiLoading(true);

        try {
            // 1. Save User Message
            await addDoc(collection(db, 'users', user.uid, 'sermon_notes', id, 'chat'), {
                role: 'user',
                content: userMsg,
                createdAt: serverTimestamp()
            });

            // 2. Call AI Function
            const chatFn = httpsCallable(functions, 'chat');
            const result = await chatFn({
                message: userMsg,
                history: messages.map(m => ({ role: m.role, content: m.content })),
                userName: userData?.displayName || user.displayName,
                sermonId: id // Pass sermon context
            }) as any;

            // 3. Save AI Response
            await addDoc(collection(db, 'users', user.uid, 'sermon_notes', id, 'chat'), {
                role: 'model', // or 'assistant'
                content: result.data.response,
                createdAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error chatting with AI:', error);
        } finally {
            setAiLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading sermon...</div>;
    if (!sermon) return <div className="p-8 text-center">Sermon not found.</div>;

    // Helper to get YouTube ID
    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const videoId = getYoutubeId(sermon.videoUrl);

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-4rem)]">
            {/* Left Column: Video & Info (Scrollable) */}
            <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2">
                {/* Video Player */}
                <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg sticky top-0 z-10">
                    {videoId ? (
                        <iframe
                            className="w-full h-full"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title={sermon.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white">
                            Video unavailable
                        </div>
                    )}
                </div>

                {/* Title & Date */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{sermon.title}</h1>
                    <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        {sermon.date ? (
                            typeof sermon.date === 'string'
                                ? format(new Date(sermon.date), 'MMMM d, yyyy')
                                : format(new Date(sermon.date.seconds * 1000), 'MMMM d, yyyy')
                        ) : 'Unknown Date'}
                    </div>
                </div>

                {/* Summary */}
                {sermon.summary && (
                    <div className="bg-gray-50 dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Summary</h3>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{sermon.summary}</p>
                    </div>
                )}
            </div>

            {/* Right Column: Tabs (Outline / Notes & AI) */}
            <div className="lg:col-span-1 flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden h-full">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-200 dark:border-zinc-800">
                    <TabButton
                        active={activeTab === 'outline'}
                        onClick={() => setActiveTab('outline')}
                        icon={FileText}
                        label="Outline"
                    />
                    <TabButton
                        active={activeTab === 'notes'}
                        onClick={() => setActiveTab('notes')}
                        icon={Edit3}
                        label="Notes & AI"
                    />
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'outline' && (
                        <div className="space-y-4">
                            {sermon.outline && sermon.outline.length > 0 ? (
                                <ul className="space-y-3">
                                    {sermon.outline.map((point, idx) => (
                                        <li key={idx} className="flex gap-3 text-gray-700 dark:text-gray-300">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                                {idx + 1}
                                            </span>
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 italic">No outline available.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="flex flex-col h-full gap-4">
                            {/* Personal Notes Area */}
                            <div className="flex-1 flex flex-col min-h-[200px]">
                                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center justify-between">
                                    <span>My Notes</span>
                                    {savingNotes && <span className="text-green-500">Saving...</span>}
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => handleSaveNotes(e.target.value)}
                                    placeholder="Take notes here..."
                                    className="flex-1 w-full p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg border-none resize-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>

                            <div className="w-full h-px bg-gray-200 dark:bg-zinc-800 my-2" />

                            {/* AI Chat Area */}
                            <div className="flex-1 flex flex-col min-h-[300px]">
                                <label className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase mb-2 flex items-center gap-2">
                                    <Sparkles className="w-3 h-3" />
                                    Ask Matthew about this sermon
                                </label>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
                                    {messages.map((msg) => (
                                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {aiLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm text-gray-500 animate-pulse">
                                                Thinking...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input */}
                                <form onSubmit={handleSendMessage} className="relative">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask a question..."
                                        className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-800 rounded-full border border-gray-200 dark:border-zinc-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || aiLoading}
                                        className="absolute right-1.5 top-1.5 p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                    >
                                        <Send className="w-3 h-3" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
