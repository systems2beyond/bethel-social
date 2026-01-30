'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, serverTimestamp, setDoc, limit, getDocs, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { User, Search, Plus, MessageSquare, MoreHorizontal, Phone, Video, Info, UserPlus, X, Loader2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageThread } from './MessageThread';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { unifiedSearch, SearchResult } from '@/lib/search/unified-search';
import { messageIndex } from '@/lib/search/message-index';
import { VideoCallInviteModal } from './VideoCallInviteModal';
import { HelpInfoModal } from './HelpInfoModal';

interface Conversation {
    id: string;
    participants: string[];
    participantDetails?: Record<string, { displayName: string, photoURL?: string }>;
    lastMessage?: string;
    lastMessageTimestamp?: any;
    lastMessageAuthorId?: string;
    updatedAt?: any;
    readBy?: string[];
}

export function DirectMessages() {
    const { user, userData } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    // Sidebar Filter State
    const [filterQuery, setFilterQuery] = useState('');

    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
    const [messageSearchResults, setMessageSearchResults] = useState<SearchResult[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [isSearchingMessages, setIsSearchingMessages] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

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

    // Mark as read when opening a conversation
    useEffect(() => {
        if (selectedConversationId && user) {
            const conv = conversations.find(c => c.id === selectedConversationId);
            // If I haven't read it yet, mark it
            if (conv && (!conv.readBy || !conv.readBy.includes(user.uid))) {
                updateDoc(doc(db, 'direct_messages', selectedConversationId), {
                    readBy: arrayUnion(user.uid)
                }).catch(err => console.error("Error marking as read", err));
            }
        }
    }, [selectedConversationId, conversations, user]);

    // Index messages for Orama search
    useEffect(() => {
        if (!user || conversations.length === 0) return;

        const indexAllMessages = async () => {
            try {
                // To avoid overloading, we fetch the last 100 messages for EACH active conversation
                // In a production app, we might want a collectionGroup query or a more efficient sync
                const allMessages: any[] = [];

                await Promise.all(conversations.map(async (conv) => {
                    const msgQuery = query(
                        collection(db, 'direct_messages', conv.id, 'messages'),
                        orderBy('timestamp', 'desc'),
                        limit(100)
                    );
                    const snap = await getDocs(msgQuery);
                    const otherUserId = conv.participants.find(p => p !== user.uid);
                    const otherUserName = otherUserId ? conv.participantDetails?.[otherUserId]?.displayName : 'User';

                    snap.docs.forEach(d => {
                        const data = d.data();
                        allMessages.push({
                            id: d.id,
                            ...data,
                            conversationId: conv.id,
                            authorName: data.authorId === user.uid ? user.displayName : otherUserName
                        });
                    });
                }));

                await messageIndex.clear(); // Fresh index
                await messageIndex.indexMessages(allMessages);
                console.log(`[Orama] Indexed ${allMessages.length} messages across ${conversations.length} conversations`);
            } catch (err) {
                console.error("Failed to index messages for search", err);
            }
        };

        indexAllMessages();
    }, [user, conversations.length]); // Re-index if conversation count changes

    // Search Globally for Users and Deep Message History (triggered by Sidebar input)
    useEffect(() => {
        if (!filterQuery.trim()) {
            setUserSearchResults([]);
            setMessageSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingUsers(true);
            setIsSearchingMessages(true);
            try {
                // Perform unified search (includes users and messages)
                const results = await unifiedSearch.search(filterQuery, user?.uid);

                // For user search results, we still hunt the 'users' collection directly in this component 
                // for the directory, but we can also use unified results if we wanted.
                // Keeping existing user search logic for directory consistency but adding message search.

                const q = query(collection(db, 'users'), limit(50));
                const snap = await getDocs(q);

                let uResults = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
                const lowerQ = filterQuery.toLowerCase();
                uResults = uResults.filter((u: any) =>
                    (u.displayName?.toLowerCase().includes(lowerQ) ||
                        u.email?.toLowerCase().includes(lowerQ)) &&
                    u.uid !== user?.uid // Filter out self
                );

                setUserSearchResults(uResults);
                setMessageSearchResults(results.messages || []);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setIsSearchingUsers(false);
                setIsSearchingMessages(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [filterQuery, user]);

    const startConversation = async (targetUser: any) => {
        if (!user) return;

        // Check if conversation already exists
        const existing = conversations.find(c => c.participants.includes(targetUser.uid));
        if (existing) {
            setSelectedConversationId(existing.id);
            setFilterQuery(''); // Clear search if triggered from sidebar
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
            setFilterQuery('');
        } catch (error) {
            console.error("Failed to start conversation", error);
            alert("Failed to create conversation. Please try again.");
        }
    };


    const handleSendInvite = async (participantIds: string[], meetLink: string) => {
        if (!user) return;

        try {
            const inviteMsg = `I'm starting a video call! Join here: ${meetLink}`;

            // 1. Send to the current conversation if exists
            if (selectedConversationId) {
                await addDoc(collection(db, 'direct_messages', selectedConversationId, 'messages'), {
                    conversationId: selectedConversationId,
                    author: {
                        id: user.uid,
                        name: userData?.displayName || user.displayName || 'Anonymous',
                        avatarUrl: user.photoURL
                    },
                    content: inviteMsg,
                    type: 'video_call_invite',
                    metadata: {
                        meetLink,
                        participantIds
                    },
                    timestamp: Date.now()
                });

                await updateDoc(doc(db, 'direct_messages', selectedConversationId), {
                    lastMessage: "Sent a video call invitation",
                    lastMessageTimestamp: Date.now(),
                    lastMessageAuthorId: user.uid
                });
            }

            // 2. Send to other participants not in this conversation
            // For simplicity, we only handle the case where they are added via modal
            // In a full implementation, we'd check if a conversation exists with each participantId
            // and send a message there too.

            for (const pId of participantIds) {
                // If it's a different person than the one in the current conversation
                const currentOtherId = selectedConversation ? getConversationDisplay(selectedConversation).uid : null;
                if (pId !== currentOtherId && pId !== user.uid) {
                    // Search for conversation with this user
                    const q = query(
                        collection(db, 'direct_messages'),
                        where('participants', 'array-contains', user.uid)
                    );
                    const snap = await getDocs(q);
                    let convId = snap.docs.find(d => (d.data().participants as string[]).includes(pId))?.id;

                    if (!convId) {
                        // Create new conversation
                        const newConv = await addDoc(collection(db, 'direct_messages'), {
                            participants: [user.uid, pId],
                            createdAt: Date.now(),
                            lastMessage: "Sent a video call invitation",
                            lastMessageTimestamp: Date.now(),
                            lastMessageAuthorId: user.uid
                        });
                        convId = newConv.id;
                    }

                    await addDoc(collection(db, 'direct_messages', convId, 'messages'), {
                        conversationId: convId,
                        author: {
                            id: user.uid,
                            name: userData?.displayName || user.displayName || 'Anonymous',
                            avatarUrl: user.photoURL
                        },
                        content: inviteMsg,
                        type: 'video_call_invite',
                        metadata: {
                            meetLink,
                            participantIds
                        },
                        timestamp: Date.now()
                    });
                }
            }

            // Update local/current conversation if exists to bump it to top and set unread for others
            if (selectedConversationId) {
                await updateDoc(doc(db, 'direct_messages', selectedConversationId), {
                    lastMessage: "Video Call Invite",
                    lastMessageTimestamp: Date.now(),
                    lastMessageAuthorId: user.uid,
                    readBy: [user.uid] // Reset read status so it glows for others
                });
            }

        } catch (error) {
            console.error("Failed to send video invite", error);
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
        const matchesName = display.name.toLowerCase().includes(filterQuery.toLowerCase());
        const matchesMessage = c.lastMessage?.toLowerCase().includes(filterQuery.toLowerCase());
        return matchesName || matchesMessage;
    });

    return (
        <div className="flex h-[calc(100vh-180px)] min-h-[600px] bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-2xl relative">

            {/* Sidebar */}
            <div className={cn(
                "w-full md:w-72 lg:w-80 border-r border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex flex-col transition-all duration-300 shrink-0",
                selectedConversationId ? "hidden md:flex" : "flex"
            )}>
                {/* Search Header */}
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold dark:text-white">Messages</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsHelpModalOpen(true)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                                title="Messaging Help"
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Start or Search messages..."
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
                    <div className="mt-2 text-left">
                        {/* Global Search Results Section */}
                        {filterQuery && (
                            <div className="mb-4">
                                {isSearchingUsers ? (
                                    <div className="px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Searching directory...
                                    </div>
                                ) : userSearchResults.length > 0 ? (
                                    <>
                                        <h3 className="px-4 text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Search className="w-3 h-3" />
                                            Start New
                                        </h3>
                                        <div className="space-y-0.5 px-2">
                                            {userSearchResults.map(u => (
                                                <button
                                                    key={u.uid}
                                                    onClick={() => {
                                                        startConversation(u);
                                                        setFilterQuery(''); // Clear search on selection
                                                    }}
                                                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition-all text-left group"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold overflow-hidden ring-1 ring-black/5 dark:ring-white/10 shrink-0">
                                                        {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : u.displayName?.[0]}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                                            {u.displayName}
                                                        </div>
                                                        <div className="text-xs text-gray-500 truncate">{u.email}</div>
                                                    </div>
                                                    <Plus className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            ))}
                                        </div>
                                        <div className="my-3 border-t border-gray-100 dark:border-white/5 mx-4" />
                                    </>
                                ) : null}

                                {isSearchingMessages ? (
                                    <div className="px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Searching history...
                                    </div>
                                ) : messageSearchResults.length > 0 ? (
                                    <div className="px-4">
                                        <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <MessageCircle className="w-3 h-3" />
                                            In Messages
                                        </h3>
                                        <div className="space-y-1">
                                            {messageSearchResults.map(res => (
                                                <button
                                                    key={res.id}
                                                    onClick={() => {
                                                        setSelectedConversationId(res.conversationId || null);
                                                        setFilterQuery('');
                                                    }}
                                                    className="w-full text-left p-3 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all group mb-1 border border-transparent hover:border-gray-100 dark:hover:border-white/5 shadow-sm hover:shadow-md"
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                                                            {res.title}
                                                        </span>
                                                        {res.timestamp && (
                                                            <span className="text-[10px] text-gray-400">
                                                                {formatDistanceToNow(res.timestamp, { addSuffix: true })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p
                                                        className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed"
                                                        dangerouslySetInnerHTML={{ __html: res.description || '' }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                        <div className="my-3 border-t border-gray-100 dark:border-white/5 mx-4" />
                                    </div>
                                ) : null}
                            </div>
                        )}

                        <h3 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inbox</h3>
                        <div className="space-y-0.5 px-2">
                            {filteredConversations.length > 0 ? (
                                filteredConversations.map(conv => {
                                    const display = getConversationDisplay(conv);
                                    const isSelected = selectedConversationId === conv.id;
                                    const isUnread = !conv.readBy?.includes(user?.uid || '') && conv.lastMessageAuthorId !== user?.uid;

                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => setSelectedConversationId(conv.id)}
                                            className={cn(
                                                "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left relative overflow-hidden group",
                                                isSelected
                                                    ? "bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                                                    : "hover:bg-gray-100 dark:hover:bg-zinc-800/50",
                                                isUnread && "bg-blue-50/60 dark:bg-blue-900/10 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20"
                                            )}
                                        >
                                            {isSelected && <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full" />}
                                            {isUnread && !isSelected && <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full animate-pulse" />}

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
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col bg-gray-50/50 dark:bg-zinc-950/50 transition-all duration-300 min-w-0",
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
                                <button
                                    onClick={() => {
                                        setIsInviteModalOpen(true);
                                    }}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                    title="Start Video Call"
                                >
                                    <Video className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative pb-[80px] md:pb-0">
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
                            Select a conversation from the sidebar or use the search bar to find people and start a chat.
                        </p>
                    </div>
                )}
            </div>

            <VideoCallInviteModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                currentParticipants={selectedConversation ? [
                    {
                        uid: getConversationDisplay(selectedConversation).uid || '',
                        displayName: getConversationDisplay(selectedConversation).name,
                        photoURL: getConversationDisplay(selectedConversation).photo
                    }
                ] : []}
                onSendInvite={handleSendInvite}
            />

            <HelpInfoModal
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
            />

        </div>
    );
}
