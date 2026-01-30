'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, serverTimestamp, setDoc, limit, getDocs } from 'firebase/firestore';
import { User, Search, Plus, MessageSquare, MoreHorizontal, Phone, Video, Info, UserPlus, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageThread } from './MessageThread';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
    id: string;
    participants: string[];
    participantDetails?: Record<string, { displayName: string, photoURL?: string }>;
    lastMessage?: string;
    lastMessageTimestamp?: any;
    lastMessageAuthorId?: string;
    updatedAt?: any;
}

export function DirectMessages() {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    // Sidebar Filter State
    const [filterQuery, setFilterQuery] = useState('');

    // New Message Modal State
    const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    // Recent users stats (derived from conversations)
    const [recentUsers, setRecentUsers] = useState<any[]>([]);

    // Determine the active conversation object
    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    // Fetch user's conversations
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'direct_messages'),
            where('participants', 'array-contains', user.uid),
            orderBy('lastMessageTimestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const convsPromises = snapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                const id = docSnapshot.id;

                // Fetch details for other participants
                const participantDetails: Record<string, any> = {};
                const otherUserIds = data.participants.filter((uid: string) => uid !== user.uid);

                for (const uid of otherUserIds) {
                    try {
                        // In a real app, implement a cache or dataloader here
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        if (userDoc.exists()) {
                            participantDetails[uid] = userDoc.data();
                        }
                    } catch (e) { console.error('Error fetching user', uid); }
                }

                return {
                    id,
                    ...data,
                    participantDetails
                } as Conversation;
            });

            const convs = await Promise.all(convsPromises);
            setConversations(convs);

            // Extract recent users from conversations (Last 5 unique users)
            const recentMap = new Map();
            convs.forEach(c => {
                const otherUserId = c.participants.find((p: string) => p !== user.uid);
                if (otherUserId && c.participantDetails?.[otherUserId] && !recentMap.has(otherUserId)) {
                    recentMap.set(otherUserId, { uid: otherUserId, ...c.participantDetails[otherUserId] });
                }
            });
            setRecentUsers(Array.from(recentMap.values()).slice(0, 10)); // Keep top 10 recent
        }, (error) => {
            console.error("Error listening to conversations:", error);
            // Optionally set state to show an error UI
        });

        return () => unsubscribe();
    }, [user]);

    // Search Globally for Users (triggered in Modal)
    useEffect(() => {
        if (!isNewMessageModalOpen) {
            setUserSearchResults([]);
            setUserSearchQuery('');
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingUsers(true);
            try {
                // Determine if we are searching or listing defaults
                // If query is empty, maybe show nothing or suggestions?
                // Let's search 'users' collection with a limit

                // Note: Firestore doesn't support substring search natively.
                // We will fetch a chunk of users and filter client-side for this MVP.
                // Production: Use Algolia or Typesense.

                const q = query(collection(db, 'users'), limit(50));
                const snap = await getDocs(q);

                let results = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

                // Client-side filter
                if (userSearchQuery.trim()) {
                    const lowerQ = userSearchQuery.toLowerCase();
                    results = results.filter((u: any) =>
                        u.displayName?.toLowerCase().includes(lowerQ) ||
                        u.email?.toLowerCase().includes(lowerQ)
                    );
                }

                // Filter out self
                results = results.filter((u: any) => u.uid !== user?.uid);

                setUserSearchResults(results);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setIsSearchingUsers(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [userSearchQuery, isNewMessageModalOpen, user]);

    const startConversation = async (targetUser: any) => {
        if (!user) return;

        // Check if conversation already exists
        const existing = conversations.find(c => c.participants.includes(targetUser.uid));
        if (existing) {
            setSelectedConversationId(existing.id);
            setIsNewMessageModalOpen(false);
            return;
        }

        // Create new conversation
        try {
            const newConvRef = doc(collection(db, 'direct_messages'));
            await setDoc(newConvRef, {
                participants: [user.uid, targetUser.uid],
                createdAt: serverTimestamp(),
                lastMessageTimestamp: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Wait a tick for subscription to pick it up? 
            // Better to just set ID and let the effect load it, 
            // but we can optimistic set if needed. 
            // The snapshot listener is fast.

            setSelectedConversationId(newConvRef.id);
            setIsNewMessageModalOpen(false);
        } catch (error) {
            console.error("Failed to start conversation", error);
            alert("Failed to create conversation. Please try again.");
        }
    };

    // Helper to get display info for a conversation
    const getConversationDisplay = (conv: Conversation) => {
        const otherUserId = conv.participants.find(p => p !== user?.uid);
        const details = otherUserId ? conv.participantDetails?.[otherUserId] : null;
        return {
            name: details?.displayName || 'Unknown User',
            photo: details?.photoURL,
            uid: otherUserId
        };
    };

    // Filter conversations for sidebar
    const filteredConversations = conversations.filter(c => {
        const display = getConversationDisplay(c);
        return display.name.toLowerCase().includes(filterQuery.toLowerCase());
    });

    return (
        <div className="flex h-[calc(100vh-180px)] min-h-[600px] bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-2xl relative">

            {/* Sidebar */}
            <div className={cn(
                "w-full md:w-80 border-r border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex flex-col transition-all duration-300",
                selectedConversationId ? "hidden md:flex" : "flex"
            )}>
                {/* Search Header */}
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Messages</h2>
                        <button
                            onClick={() => setIsNewMessageModalOpen(true)}
                            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                            title="New Message"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter messages..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 text-sm placeholder-gray-500 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Content Area: Conversations List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* Recent Users (Quick Row) - Only show if no filter */}
                    {!filterQuery && recentUsers.length > 0 && (
                        <div className="py-2 px-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recent</h3>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                                {recentUsers.map(u => (
                                    <button
                                        key={u.uid}
                                        onClick={() => startConversation(u)}
                                        className="flex flex-col items-center gap-1.5 min-w-[60px] group"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden ring-2 ring-transparent group-hover:ring-blue-500 transition-all relative">
                                            {u.photoURL ? (
                                                <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">{u.displayName?.[0]}</div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate w-full text-center">
                                            {u.displayName?.split(' ')[0]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conversations List */}
                    <div className="mt-2">
                        <h3 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inbox</h3>
                        <div className="space-y-0.5 px-2">
                            {filteredConversations.length > 0 ? (
                                filteredConversations.map(conv => {
                                    const display = getConversationDisplay(conv);
                                    const isSelected = selectedConversationId === conv.id;
                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => setSelectedConversationId(conv.id)}
                                            className={cn(
                                                "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left relative overflow-hidden group",
                                                isSelected
                                                    ? "bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                                                    : "hover:bg-gray-100 dark:hover:bg-zinc-800/50"
                                            )}
                                        >
                                            {isSelected && <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full" />}

                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                                                    {display.photo ? (
                                                        <img src={display.photo} alt={display.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="font-bold text-gray-500">{display.name?.[0]}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0 pr-1">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className={cn("font-semibold text-sm truncate", isSelected ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200")}>
                                                        {display.name}
                                                    </span>
                                                    {conv.lastMessageTimestamp && (
                                                        <span className="text-[10px] text-gray-400 shrink-0">
                                                            {conv.lastMessageTimestamp?.toDate ? formatDistanceToNow(conv.lastMessageTimestamp.toDate(), { addSuffix: false }) : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={cn("text-xs truncate", isSelected ? "text-gray-500 dark:text-gray-400" : "text-gray-500 dark:text-gray-500")}>
                                                    {conv.lastMessageAuthorId === user?.uid && "You: "}{conv.lastMessage || "Start a conversation"}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-sm text-gray-500">No conversations found.</p>
                                    <button
                                        onClick={() => setIsNewMessageModalOpen(true)}
                                        className="text-blue-500 text-xs font-semibold mt-2 hover:underline"
                                    >
                                        Start a new one
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col bg-gray-50/50 dark:bg-zinc-950/50 transition-all duration-300",
                !selectedConversationId ? "hidden md:flex" : "flex fixed inset-0 z-40 md:static md:inset-auto bg-white dark:bg-zinc-900 md:bg-transparent"
            )}>
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-4 md:px-6 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-white/5 shadow-sm shrink-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedConversationId(null)}
                                    className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>

                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                        {getConversationDisplay(selectedConversation).photo ? (
                                            <img src={getConversationDisplay(selectedConversation).photo} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="font-bold text-gray-600">{getConversationDisplay(selectedConversation).name[0]}</span>
                                        )}
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                                </div>

                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                                        {getConversationDisplay(selectedConversation).name}
                                    </h3>
                                    <span className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        Active now
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 md:gap-2">
                                <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors">
                                    <Phone className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => window.open('https://meet.google.com/new', '_blank')}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                >
                                    <Video className="w-5 h-5" />
                                </button>
                                <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800 mx-1" />
                                <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors">
                                    <Info className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Thread */}
                        <div className="flex-1 overflow-hidden relative">
                            <MessageThread conversationId={selectedConversation.id} />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-black/20">
                        <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6 ring-8 ring-blue-50 dark:ring-blue-900/10">
                            <MessageSquare className="w-10 h-10 text-blue-600 dark:text-blue-400 ml-1" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Direct Messages</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
                            Select a conversation from the sidebar or start a new formatted chat to connect with your community.
                        </p>
                        <button
                            className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                            onClick={() => setIsNewMessageModalOpen(true)}
                        >
                            <UserPlus className="w-5 h-5" />
                            Start New Message
                        </button>
                    </div>
                )}
            </div>

            {/* NEW MESSAGE MODAL */}
            <AnimatePresence>
                {isNewMessageModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsNewMessageModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">New Message</h3>
                                <button
                                    onClick={() => setIsNewMessageModalOpen(false)}
                                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Search people..."
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Results */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                {isSearchingUsers ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                        <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                                        <p className="text-xs">Finding people...</p>
                                    </div>
                                ) : userSearchResults.length > 0 ? (
                                    <div className="space-y-1">
                                        {userSearchResults.map(u => (
                                            <button
                                                key={u.uid}
                                                onClick={() => startConversation(u)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                                    {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : u.displayName?.[0]}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 transition-colors">
                                                        {u.displayName}
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate">{u.email}</div>
                                                </div>
                                                <div className="p-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MessageSquare className="w-4 h-4" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center px-6">
                                        <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                                            <UserPlus className="w-6 h-6 opacity-30" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No users found</p>
                                        <p className="text-xs mt-1 opacity-60">Try searching for a name or email</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
} 
