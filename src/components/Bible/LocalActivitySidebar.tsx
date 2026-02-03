'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Wifi, ChevronRight, ChevronDown, MessageSquare, Plus, ArrowRight, ExternalLink, Edit3, ScrollText, Bell, Inbox, Sparkles, Clock, Search, BookOpen, Pin, Trash2, Video, Globe, PlayCircle, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, limit, doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useActivity } from '@/context/ActivityContext';
import { useBible } from '@/context/BibleContext';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ViewResourceModal } from '@/components/Meeting/ViewResourceModal';
import { unifiedSearch, type UnifiedSearchResults } from '@/lib/search/unified-search';

interface LocalActivitySidebarProps {
    onJoinScroll: (id: string, title?: string) => void;
    currentScrollId: string;
    className?: string;
}

interface ActiveScroll {
    id: string;
    title: string;
    description?: string;
    authorName?: string;
    participantCount?: number;
    lastActive?: any;
    isPublic?: boolean;
}

interface PinnedVerse {
    reference: string;
    text: string;
    id: string;
}

// QuickSearchResults replaced by UnifiedSearchResults
// interface QuickSearchResults ... removed


type TabType = 'activity' | 'live' | 'quick-note' | 'inbox';

const MAX_ITEMS_SHOWN = 5;
const MAX_RECENT_ITEMS = 6;

export function LocalActivitySidebar({ className }: { className?: string }) {
    const router = useRouter();
    const { user } = useAuth();
    const { invitations, notifications, sentInvitations, usersMap, markAsViewed, setActivityPanelOpen } = useActivity();
    const {
        openNote,
        openCollaboration,
        openBible,
        openVideo,
        openStudyWithSearch,
        collaborationId: currentScrollId
    } = useBible();
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('activity');


    const [recentDMs, setRecentDMs] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'direct_messages'),
            where('participants', 'array-contains', user.uid),
            orderBy('lastMessageTimestamp', 'desc'),
            limit(5)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const dms = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setRecentDMs(dms);
        });
        return () => unsub();
    }, [user]);

    // Handle loading state
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    // Bible Hub State
    const [searchQuery, setSearchQuery] = useState('');
    const [quickResults, setQuickResults] = useState<UnifiedSearchResults | null>(null); // Use UnifiedSearchResults directly
    const [isSearching, setIsSearching] = useState(false);
    const [pinnedVerses, setPinnedVerses] = useState<PinnedVerse[]>([]);
    const [quickNoteContent, setQuickNoteContent] = useState('');

    const handleQuickNoteSave = async () => {
        if (!user || !quickNoteContent.trim()) return;
        try {
            const noteDocId = 'bible-study-general'; // Or use Date-based ID
            // We'll append to a "Quick Notes" collection or a daily note for consistency
            const notesRef = doc(db, 'users', user.uid, 'notes', 'quick-notes'); // Dedicated quick notes doc

            // Check if doc exists, if not create
            // We'll append to an array 'entries'
            await setDoc(notesRef, {
                updatedAt: new Date(),
                type: 'quick-notes',
                entries: arrayUnion({
                    content: quickNoteContent,
                    createdAt: new Date(),
                    id: Date.now().toString()
                })
            }, { merge: true });

            // Also create a standalone note if that's preferred "consistent with notes page"
            // Let's stick to syncing with the main notes system if possible.
            // Actually, let's just create a NEW note so it appears in the Notes list as a distinct item
            const newNoteId = `note-${Date.now()}`;
            await setDoc(doc(db, 'users', user.uid, 'notes', newNoteId), {
                title: `Quick Note - ${new Date().toLocaleTimeString()}`,
                content: `<p>${quickNoteContent}</p>`,
                createdAt: new Date(),
                updatedAt: new Date(),
                isQuickNote: true
            });

            setQuickNoteContent('');
            setIsExpanded(false);
        } catch (e) {
            console.error('Failed to save quick note', e);
        }
    };

    // Search Handler
    const handleQuickSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setQuickResults(null);

        try {
            // Unified Search Only (Mirrors BibleStudyModal)
            const results = await unifiedSearch.search(searchQuery, user?.uid || undefined);
            setQuickResults(results);
        } catch (e) {
            console.error('Search failed', e);
            setQuickResults(null);
        } finally {
            setIsSearching(false);
        }
    };

    // ... (Pinned Verses Sync & togglePin Unchanged) ...
    // Pinned Verses Sync
    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid, 'settings', 'pinned-verses'), (snap) => {
            if (snap.exists()) {
                setPinnedVerses(snap.data().verses || []);
            }
        });
        return () => unsub();
    }, [user]);

    const togglePin = async (verse: PinnedVerse) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid, 'settings', 'pinned-verses');
        const isPinned = pinnedVerses.some(p => p.id === verse.id);

        try {
            if (isPinned) {
                await updateDoc(ref, { verses: arrayRemove(verse) });
            } else {
                await setDoc(ref, { verses: arrayUnion(verse) }, { merge: true });
            }
        } catch (e) {
            console.error('Pin failed', e);
        }
    };

    // ... (ViewResourceModal State & Collapsible Logic Unchanged) ...
    // State for ViewResourceModal
    const [resourceModalOpen, setResourceModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<{
        title: string;
        content: string;
        collaborationId: string;
    } | null>(null);

    // Collapsible section states (collapsed by default)
    const [invitesExpanded, setInvitesExpanded] = useState(false);
    const [notifsExpanded, setNotifsExpanded] = useState(false);

    // Stats for tabs
    const unviewedInvitesCount = invitations.filter(i => !i.viewed).length;
    const unviewedNotifsCount = notifications.filter(n => !n.viewed).length;
    const totalUnread = unviewedInvitesCount + unviewedNotifsCount;

    // Create combined recent items, sorted by date
    const recentItems = useMemo(() => {
        const allItems = [
            ...invitations.map(i => ({ ...i, itemType: 'invite' as const })),
            ...notifications.map(n => ({ ...n, itemType: 'notification' as const })),
            ...recentDMs.map(dm => ({
                ...dm,
                itemType: 'message' as const,
                createdAt: dm.lastMessageTimestamp,
                fromUserId: dm.lastMessageAuthorId,
                message: dm.lastMessage,
                viewed: dm.readBy && user ? dm.readBy.includes(user.uid) : false
            }))
        ];

        allItems.sort((a, b) => {
            const getDate = (d: any) => {
                if (!d) return new Date(0);
                if (typeof d === 'number') return new Date(d);
                if (d?.toDate) return d.toDate();
                if (d instanceof Date) return d;
                return new Date(0);
            };
            const dateA = getDate(a.createdAt);
            const dateB = getDate(b.createdAt);
            return dateB.getTime() - dateA.getTime();
        });

        return allItems.slice(0, MAX_RECENT_ITEMS);
    }, [invitations, notifications, recentDMs, user]);

    // Live Note Sessions (Filtered for user)
    const localScrolls = useMemo(() => {
        const scrolls: ActiveScroll[] = [];
        const seenIds = new Set<string>();

        // Combine received and sent invitations of type 'scroll'
        const allPotentialScrolls = [...invitations, ...sentInvitations]
            .filter(item => item.type === 'scroll')
            .sort((a, b) => {
                const getDate = (d: any) => {
                    if (!d) return new Date(0);
                    if (typeof d === 'number') return new Date(d);
                    if (d?.toDate) return d.toDate();
                    return new Date(0);
                };
                const dateA = getDate(a.createdAt);
                const dateB = getDate(b.createdAt);
                return dateB.getTime() - dateA.getTime();
            });

        allPotentialScrolls.forEach(data => {
            const scrollId = data.resourceId;
            if (scrollId && scrollId !== currentScrollId && !seenIds.has(scrollId)) {
                seenIds.add(scrollId);

                // Determine author name
                let authorName = data.fromUser?.displayName || 'Session Member';
                if (data.fromUser?.uid === user?.uid) {
                    authorName = 'You';
                }

                scrolls.push({
                    id: scrollId,
                    title: data.resourceTitle || 'Bible Study Session',
                    description: data.message || (data.fromUser?.uid === user?.uid ? 'Shared and collaborative session' : 'Participating in shared session'),
                    authorName,
                    participantCount: 0, // Removing misleading random count
                });
            }
        });

        return scrolls.slice(0, 5);
    }, [invitations, sentInvitations, currentScrollId, user?.uid]);

    const handleViewMore = () => {
        router.push('/fellowship');
        setIsExpanded(false);
    };

    const handleItemClick = async (item: any, type: 'invite' | 'notification' | 'message') => {
        console.log('handleItemClick called:', { item, type });
        markAsViewed(item.id, type);

        if (type === 'message') {
            router.push(`/fellowship?tab=community&conversationId=${item.id}&messageId=${item.lastMessageId || ''}`);
            setIsExpanded(false);
            return;
        }

        // For Group Invites and Mentions
        if (item.type === 'group_invite' || item.type === 'mention' || item.groupId) {
            if (item.groupId) {
                const url = `/groups/${item.groupId}${item.postId ? `?postId=${item.postId}` : ''}`;
                router.push(url);
            }
            setIsExpanded(false);
            return;
        }

        let resolvedContent = item.content || item.noteContent || item.previewContent || '';
        const resourceId = item.noteId || item.resourceId;

        // 1. Initial State for Modal (Loading...)
        const shouldShowModal = type === 'invite' || (resourceId && item.type !== 'note_shared' && item.type !== 'note');

        if (shouldShowModal) {
            setSelectedResource({
                title: item.noteTitle || item.title || item.resourceTitle || 'Shared Resource',
                content: resolvedContent || '<div class="flex items-center justify-center p-8"><span class="animate-pulse text-indigo-500 font-medium">Loading content...</span></div>',
                collaborationId: resourceId
            });
            setResourceModalOpen(true);
            // Close sidebar to focus on modal
            setIsExpanded(false);
            setActivityPanelOpen(false);
        }

        // 2. Resolve Content (Async if needed)

        // A. Try Local Lookup in invitations (Active Context)
        if (!resolvedContent && resourceId) {
            const localMatch = invitations.find(inv => inv.resourceId === resourceId);
            if (localMatch) {
                console.log('[Sidebar] Found local content match in invitations');
                resolvedContent = localMatch.content || localMatch.noteContent || localMatch.previewContent || '';
            }
        }

        // B. Async Fetch if still missing
        if (!resolvedContent && resourceId) {
            try {
                console.log('[Sidebar] Fetching content for resource:', resourceId);
                const q = query(collection(db, 'invitations'), where('resourceId', '==', resourceId), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    resolvedContent = data.content || data.noteContent || data.previewContent || '';
                    console.log('[Sidebar] Fetched content successfully');
                } else {
                    console.log('[Sidebar] No invitation found for resource.');
                    // Failover: Just show a fallback
                    resolvedContent = '<p class="text-gray-500 italic text-center p-4">Content could not be loaded. Please open the Fellowship page directly.</p>';
                }
            } catch (e) {
                console.error('[Sidebar] Error fetching content', e);
                resolvedContent = '<p class="text-red-400 italic text-center p-4">Error loading content.</p>';
            }
        }

        // 3. Append Comment if applicable
        if (item.type === 'note_comment' || item.type === 'comment') {
            const commentText = item.message || item.text || 'New comment';
            const commentHtml = `<div class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg mb-4 border-l-4 border-indigo-500">
                <p class="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">Comment:</p>
                <p class="text-sm text-slate-700 dark:text-slate-200">${commentText}</p>
            </div>`;
            resolvedContent = commentHtml + (resolvedContent || '');
        }

        // 4. Update Modal (if currently open) with resolved content
        // We only update if we opened it (shouldShowModal is true)
        if (shouldShowModal) {
            setSelectedResource(prev => prev ? ({
                ...prev,
                content: resolvedContent || item.description || '<p class="text-center p-4 italic text-slate-500">No content available.</p>'
            }) : null);
            return;
        }

        // For direct notes (personal)
        if (resourceId && (item.type === 'note_shared' || item.type === 'note')) {
            openNote(resourceId, item.resourceTitle || item.title);
        }

        setIsExpanded(false);
        setActivityPanelOpen(false);
    };

    // Limited items for collapsible sections
    const limitedInvitations = invitations.slice(0, MAX_ITEMS_SHOWN);
    const limitedNotifications = notifications.slice(0, MAX_ITEMS_SHOWN);

    // FIX: Ensure hooks are called before conditional return
    // moved `if (!user) return null` to inside the return statement or ensure it doesn't block hooks
    // Actually, looking at the code, `useMemo` for `recentItems` and `localScrolls` depend on `user`.
    // And `useEffect` depends on `user`.
    // If user is null, we can return null, BUT we must ensure all hooks run consistently.
    // The previous code had `if (!user) return null;` at line 380, which is AFTER all hooks.
    // Wait, let's verify if there are any hooks AFTER line 380.
    // Lines 382+ is the return statement.
    // So `LocalActivitySidebar` seems safe regarding `!user` check as it was at the very end.

    // However, to be absolutely safe and explicit:
    if (!user) return null;

    return (
        <div className={cn("fixed right-0 top-[55%] -translate-y-1/2 z-[9999] pointer-events-none", className)}>
            <motion.div
                initial={false}
                animate={{ x: isExpanded ? 0 : '100%' }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative flex items-start pointer-events-auto"
            >
                {/* Toggle Handle - Attached to the left of the content */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute left-0 top-8 -translate-x-full flex flex-col items-center gap-2 py-4 px-1.5 bg-indigo-600 text-white rounded-l-xl shadow-xl border-y border-l border-indigo-400/30 transition-all hover:pr-2.5 z-10"
                >
                    <div className="relative">
                        <Users className="w-5 h-5" />
                        {totalUnread > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] flex items-center justify-center font-bold">
                                    {totalUnread}
                                </span>
                            </span>
                        )}
                    </div>
                    <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold tracking-widest uppercase">
                        Bible Hub
                    </div>
                    <ChevronRight className={cn("w-4 h-4 mt-1 transition-transform", isExpanded && "rotate-180")} />
                </button>

                {/* Content Sidebar Panel */}
                <div className="w-80 h-[550px] bg-white dark:bg-[#0f172a] border border-indigo-100 dark:border-indigo-900/40 rounded-l-2xl shadow-2xl overflow-hidden flex flex-col">
                    {/* Header & Tabs */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white shrink-0">
                        <div className="p-4 pb-2 flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2 text-sm">
                                <BookOpen className="w-4 h-4 text-indigo-200" />
                                Activity
                            </h3>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <Plus className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        {/* Quick Search */}
                        <div className="px-3 pb-3">
                            <form onSubmit={handleQuickSearch} className="relative">
                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                                    {isSearching ? (
                                        <Loader2 className="w-3.5 h-3.5 text-indigo-200 animate-spin" />
                                    ) : (
                                        <Search className="w-3.5 h-3.5 text-indigo-200" />
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search scripture..."
                                    className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-indigo-400/30 rounded-lg text-xs text-white placeholder-indigo-200 focus:outline-none focus:bg-white/20 transition-all"
                                />
                            </form>
                        </div>

                        {/* Tab Bar */}
                        <div className="flex px-2 pb-0 justify-around border-t border-white/10 pt-1">
                            <TabButton
                                id="activity"
                                active={activeTab === 'activity'}
                                label="Activity"
                                icon={<Bell className="w-4 h-4" />}
                                count={totalUnread}
                                onClick={() => setActiveTab('activity')}
                            />
                            <TabButton
                                id="quick-note"
                                active={activeTab === 'quick-note'}
                                label="Quick Note"
                                icon={<Edit3 className="w-4 h-4" />}
                                count={0}
                                onClick={() => setActiveTab('quick-note')}
                            />
                            <TabButton
                                id="live"
                                active={activeTab === 'live'}
                                label="Live"
                                icon={<Wifi className="w-4 h-4" />}
                                count={localScrolls.length}
                                onClick={() => setActiveTab('live')}
                            />
                            <TabButton
                                id="inbox"
                                active={activeTab === 'inbox'}
                                label="Inbox"
                                icon={<Inbox className="w-4 h-4" />}
                                count={recentDMs.length}
                                onClick={() => setActiveTab('inbox')}
                            />
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Quick Results & Pins Section */}
                        {activeTab === 'activity' && (
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-3">
                                {/* Search Results */}
                                {quickResults && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Results</span>
                                            <button onClick={() => setQuickResults(null)} className="text-[10px] text-indigo-500 hover:text-indigo-600">Clear</button>
                                        </div>

                                        {/* Bible Results (Mapped like BibleStudyModal) */}
                                        {quickResults.bible?.length > 0 && quickResults.bible.slice(0, 3).map((hit: any, i: number) => (
                                            <div
                                                key={`bible-${i}`}
                                                onClick={() => {
                                                    openBible({
                                                        book: hit.metadata.book,
                                                        chapter: hit.metadata.chapter,
                                                        verse: hit.metadata.verse
                                                    }, true);
                                                    setIsExpanded(false);
                                                }}
                                                className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-500/20 relative group cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors mb-1"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{hit.title}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            togglePin({ reference: hit.title, text: hit.description, id: hit.title });
                                                        }}
                                                        className={cn("p-1 rounded-full bg-white dark:bg-zinc-800 shadow-sm transition-all",
                                                            pinnedVerses.some(p => p.id === hit.title) ? "text-indigo-500" : "text-slate-400 hover:text-indigo-500")}
                                                    >
                                                        <Pin className="w-3 h-3 fill-current" />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-3 italic">
                                                    "{hit.description}"
                                                </p>
                                            </div>
                                        ))}

                                        {/* Video & Web Results */}
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {quickResults.videos?.map((v: any, i: number) => {
                                                // Map similar to Modal/Service logic
                                                let thumb = v.thumbnail;
                                                if (!thumb && v.pagemap?.cse_thumbnail?.[0]?.src) thumb = v.pagemap.cse_thumbnail[0].src;

                                                return (
                                                    <div
                                                        key={`video-${i}`}
                                                        onClick={() => {
                                                            openVideo({
                                                                url: v.link || v.url || '#',
                                                                title: v.title,
                                                                provider: 'youtube'
                                                            });
                                                            setIsExpanded(false);
                                                        }}
                                                        className="p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10 cursor-pointer hover:border-red-200 dark:hover:border-red-900/50 transition-colors"
                                                    >
                                                        <div className="aspect-video bg-slate-200 dark:bg-slate-700 rounded mb-1.5 relative overflow-hidden group">
                                                            <img src={thumb || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80'} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <PlayCircle className="w-5 h-5 text-white/90 drop-shadow-md" />
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] font-medium truncate">{v.title}</p>
                                                    </div>
                                                )
                                            })}

                                            <div className="space-y-1.5">
                                                {quickResults.web?.slice(0, 2).map((w: any, i: number) => (
                                                    <div
                                                        key={`web-${i}`}
                                                        onClick={() => {
                                                            window.open(w.link || w.url, '_blank');
                                                            setIsExpanded(false);
                                                        }}
                                                        className="p-1.5 bg-slate-50 dark:bg-white/5 rounded border border-slate-100 dark:border-white/10 flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                                    >
                                                        <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span className="text-[9px] font-medium truncate text-slate-600 dark:text-slate-300">{w.title || w.snippet}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pinned Verses */}
                                {!quickResults && pinnedVerses.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Pin className="w-3 h-3 text-indigo-500" />
                                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Pinned Verses</span>
                                        </div>
                                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                                            {pinnedVerses.map(pin => (
                                                <div
                                                    key={pin.id}
                                                    onClick={() => {
                                                        const match = pin.reference.match(/^(.+?)\s(\d+):(\d+)$/);
                                                        if (match) {
                                                            openBible({
                                                                book: match[1],
                                                                chapter: parseInt(match[2]),
                                                                verse: parseInt(match[3])
                                                            }, true);
                                                            setIsExpanded(false);
                                                        }
                                                    }}
                                                    className="group flex items-start justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10 hover:border-indigo-200 transition-all cursor-pointer"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">{pin.reference}</p>
                                                        <p className="text-[9px] text-slate-500 truncate italic">"{pin.text}"</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            togglePin(pin);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {activeTab === 'activity' && (
                                <motion.div
                                    key="activity"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex flex-col"
                                >
                                    {/* Collapsible Shared Scrolls */}
                                    <CollapsibleSection
                                        title="Shared Scrolls"
                                        count={invitations.length}
                                        unviewedCount={unviewedInvitesCount}
                                        isExpanded={invitesExpanded}
                                        onToggle={() => setInvitesExpanded(!invitesExpanded)}
                                        colorClass="indigo"
                                    >
                                        {limitedInvitations.length === 0 ? (
                                            <p className="text-xs text-center py-4 text-slate-500 italic">No shared scrolls yet</p>
                                        ) : (
                                            <>
                                                <div className="space-y-1">
                                                    {limitedInvitations.map((invite) => (
                                                        <ActivityItem
                                                            key={invite.id}
                                                            item={invite}
                                                            usersMap={usersMap}
                                                            type="invite"
                                                            onClick={() => handleItemClick(invite, 'invite')}
                                                        />
                                                    ))}
                                                </div>
                                                {invitations.length > MAX_ITEMS_SHOWN && (
                                                    <ViewMoreButton onClick={handleViewMore} count={invitations.length - MAX_ITEMS_SHOWN} />
                                                )}
                                            </>
                                        )}
                                    </CollapsibleSection>

                                    {/* Collapsible Notifications */}
                                    <CollapsibleSection
                                        title="Notifications"
                                        count={notifications.length}
                                        unviewedCount={unviewedNotifsCount}
                                        isExpanded={notifsExpanded}
                                        onToggle={() => setNotifsExpanded(!notifsExpanded)}
                                        colorClass="zinc"
                                    >
                                        {limitedNotifications.length === 0 ? (
                                            <p className="text-xs text-center py-4 text-slate-500 italic">Everything caught up!</p>
                                        ) : (
                                            <>
                                                <div className="space-y-1">
                                                    {limitedNotifications.map((notif) => (
                                                        <ActivityItem
                                                            key={notif.id}
                                                            item={notif}
                                                            usersMap={usersMap}
                                                            type="notification"
                                                            onClick={() => handleItemClick(notif, 'notification')}
                                                        />
                                                    ))}
                                                </div>
                                                {notifications.length > MAX_ITEMS_SHOWN && (
                                                    <ViewMoreButton onClick={handleViewMore} count={notifications.length - MAX_ITEMS_SHOWN} />
                                                )}
                                            </>
                                        )}
                                    </CollapsibleSection>

                                    {/* Recent Activity - Always Visible */}
                                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1">
                                        <div className="p-3 pb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md">
                                                    <Clock className="w-3 h-3 text-white" />
                                                </div>
                                                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                    Recent Activity
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="px-2 pb-3 space-y-1">
                                            {recentItems.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-2">
                                                        <Clock className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 italic">No recent activity</p>
                                                </div>
                                            ) : (
                                                recentItems.map((item) => (
                                                    <RecentActivityItem
                                                        key={item.id}
                                                        item={item}
                                                        usersMap={usersMap}
                                                        onClick={() => handleItemClick(item, item.itemType)}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'quick-note' && (
                                <motion.div
                                    key="quick-note"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 space-y-3 h-full flex flex-col"
                                >
                                    <div className="flex-1 flex flex-col space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                                <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Quick Note</h3>
                                        </div>

                                        <textarea
                                            value={quickNoteContent}
                                            onChange={(e) => setQuickNoteContent(e.target.value)}
                                            placeholder="Jot down a thought or revelation..."
                                            className="flex-1 w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                                        />

                                        <button
                                            onClick={handleQuickNoteSave}
                                            disabled={!quickNoteContent.trim()}
                                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                        >
                                            <Pin className="w-3.5 h-3.5" />
                                            Save to Notes
                                        </button>
                                        <p className="text-[10px] text-center text-slate-400">
                                            Saved to your personal notes (Quick Notes)
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'live' && (
                                <motion.div
                                    key="live"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-3 space-y-3"
                                >
                                    {loading ? (
                                        <LoadingState />
                                    ) : localScrolls.length > 0 ? (
                                        localScrolls.map((scroll) => (
                                            <LiveScrollItem
                                                key={scroll.id}
                                                scroll={scroll}
                                                onClick={() => {
                                                    openCollaboration(scroll.id, scroll.title);
                                                    setIsExpanded(false);
                                                }}
                                            />
                                        ))
                                    ) : (
                                        <EmptyState
                                            icon={<Wifi className="w-8 h-8" />}
                                            message="No active sessions nearby."
                                        />
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'inbox' && (
                                <motion.div
                                    key="inbox"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-3 space-y-3"
                                >
                                    {recentDMs.length === 0 ? (
                                        <EmptyState
                                            icon={<MessageSquare className="w-8 h-8" />}
                                            message="No recent messages."
                                        />
                                    ) : (
                                        <div className="space-y-2">
                                            {recentDMs.map((dm) => (
                                                <div key={dm.id} className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-slate-100 dark:border-zinc-700/50" onClick={() => {
                                                    router.push('/fellowship?tab=community');
                                                    setIsExpanded(false);
                                                }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">Conversation</p>
                                                            <p className="text-[10px] text-slate-500 truncate">{dm.lastMessageAuthorId === user?.uid && "You: "}{dm.lastMessage}</p>
                                                        </div>
                                                        {dm.lastMessageTimestamp && (
                                                            <span className="text-[9px] text-slate-400 whitespace-nowrap">
                                                                msg
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Studying Together</span>
                    </div>
                </div>
            </motion.div >

            {/* ViewResourceModal for shared scrolls */}
            < ViewResourceModal
                isOpen={resourceModalOpen}
                onClose={() => {
                    setResourceModalOpen(false);
                    setSelectedResource(null);
                }
                }
                title={selectedResource?.title || ''}
                content={selectedResource?.content || ''}
                type="scroll"
                collaborationId={selectedResource?.collaborationId}
            />
        </div >
    );
}

// Collapsible Section Component
function CollapsibleSection({
    title,
    count,
    unviewedCount,
    isExpanded,
    onToggle,
    colorClass,
    children
}: {
    title: string;
    count: number;
    unviewedCount: number;
    isExpanded: boolean;
    onToggle: () => void;
    colorClass: 'indigo' | 'zinc';
    children: React.ReactNode;
}) {
    const badgeClasses = colorClass === 'indigo'
        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";

    return (
        <div className="border-b border-slate-100 dark:border-slate-800">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h4>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", badgeClasses)}>
                        {count}
                    </span>
                    {unviewedCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                </div>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-2 pb-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// View More Button Component
function ViewMoreButton({ onClick, count }: { onClick: () => void; count: number }) {
    return (
        <button
            onClick={onClick}
            className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
        >
            <span>View {count} more</span>
            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
    );
}

// Compact Recent Activity Item
function RecentActivityItem({ item, usersMap, onClick }: { item: any; usersMap: any; onClick: () => void }) {
    const fromUid = item.fromUserId || item.fromUser?.uid;
    const fromUser = usersMap[fromUid] || item.fromUser || { displayName: 'User' };
    const isInvite = item.itemType === 'invite';
    const isMessage = item.itemType === 'message';

    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all",
                item.viewed
                    ? "opacity-60 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    : "bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-indigo-900/15 border-l-2 border-indigo-500"
            )}
        >
            {/* Avatar */}
            <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 overflow-hidden">
                    {fromUser.photoURL ? (
                        <img src={fromUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        fromUser.displayName?.[0] || 'U'
                    )}
                </div>
                {!item.viewed && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full border border-white dark:border-slate-900" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-tight truncate">
                    <span className="font-semibold">{fromUser.displayName}</span>
                    {isInvite
                        ? (item.type === 'group_invite'
                            ? ` invited you to join "${item.groupName || 'a group'}"`
                            : ` shared "${(item.noteTitle || item.title || 'Untitled').slice(0, 20)}${(item.noteTitle || item.title || '').length > 20 ? '...' : ''}"`)
                        : isMessage
                            ? `: ${item.message}`
                            : `: ${(item.message || item.text || 'Update').slice(0, 25)}...`
                    }
                </p>
                <span className="text-[8px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-2 h-2" />
                    {item.createdAt?.toDate ? formatRelativeTime(item.createdAt.toDate()) : 'Just now'}
                </span>
            </div>

            {/* Icon */}
            <div className={cn(
                "shrink-0 p-1 rounded",
                isInvite
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            )}>
                {item.type === 'group_invite' ? <Users className="w-3 h-3" /> : (isInvite ? <ScrollText className="w-3 h-3" /> : (isMessage ? <MessageSquare className="w-3 h-3" /> : <Bell className="w-3 h-3" />))}
            </div>
        </div>
    );
}

function TabButton({ id, active, label, icon, count, onClick }: { id: string, active: boolean, label: string, icon: React.ReactNode, count: number, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center gap-1 py-3 px-6 relative transition-all group",
                active ? "text-white" : "text-indigo-200 hover:text-white"
            )}
        >
            <div className="relative">
                {icon}
                {count > 0 && (
                    <span className={cn(
                        "absolute -top-1 -right-1.5 px-1 min-w-[12px] h-3 rounded-full text-[8px] font-bold flex items-center justify-center border-2 border-indigo-600 shadow-sm",
                        active ? "bg-white text-indigo-600" : "bg-red-500 text-white"
                    )}>
                        {count}
                    </span>
                )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
            {active && (
                <motion.div
                    layoutId="activeTabSide"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full shadow-[0_-2px_8px_rgba(255,255,255,0.4)]"
                />
            )}
        </button>
    );
}

function LiveScrollItem({ scroll, onClick }: { scroll: ActiveScroll, onClick: () => void }) {
    return (
        <div
            className="group p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:bg-white dark:hover:bg-indigo-900/10 transition-all cursor-pointer relative overflow-hidden"
            onClick={onClick}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                    <ScrollText className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="flex flex-row-reverse -space-x-1 space-x-reverse">
                        {[...Array(Math.min(3, scroll.participantCount || 0))].map((_, i) => (
                            <div key={i} className="w-5 h-5 rounded-full border border-white dark:border-zinc-900 bg-indigo-500 text-[8px] flex items-center justify-center text-white font-bold">
                                {String.fromCharCode(65 + i)}
                            </div>
                        ))}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Active Session</span>
                </div>
            </div>

            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {scroll.title}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 italic">
                "{scroll.description}"
            </p>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-white/5">
                <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1">
                    By {scroll.authorName}
                </span>
                <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Join <ArrowRight className="w-3 h-3" />
                </div>
            </div>
        </div>
    );
}

function ActivityItem({ item, usersMap, type, onClick }: { item: any; usersMap: any; type: 'invite' | 'notification', onClick: () => void }) {
    const fromUid = item.fromUserId || item.fromUser?.uid;
    const fromUser = usersMap[fromUid] || item.fromUser || { displayName: 'User' };

    return (
        <div
            onClick={onClick}
            className={cn(
                "w-full text-left p-2.5 rounded-lg transition-all duration-200 flex items-start gap-2.5 group relative cursor-pointer border",
                item.viewed
                    ? "opacity-60 bg-transparent border-transparent hover:opacity-100 hover:bg-slate-50 dark:hover:bg-white/5"
                    : "bg-white dark:bg-zinc-900 border-indigo-100 dark:border-indigo-900/20 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/50"
            )}
        >
            <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-xs font-bold overflow-hidden border border-white dark:border-zinc-800 shadow-sm group-hover:scale-105 transition-transform">
                    {fromUser.photoURL ? (
                        <img src={fromUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        fromUser.displayName?.[0] || 'U'
                    )}
                </div>
                {!item.viewed && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 border border-white dark:border-zinc-900 rounded-full" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">
                        {type === 'invite'
                            ? (item.type === 'group_invite' ? 'Group Invite' : 'Shared Scroll')
                            : 'Update'}
                    </span>
                    {item.createdAt?.toDate && (
                        <div className="flex items-center gap-1 text-[8px] text-slate-400 font-medium whitespace-nowrap">
                            <Clock className="w-2 h-2" />
                            {formatRelativeTime(item.createdAt.toDate())}
                        </div>
                    )}
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{fromUser.displayName}</span>
                    {type === 'invite'
                        ? (item.type === 'group_invite'
                            ? ` invited you to join "${item.groupName || 'a group'}"`
                            : ` shared "${item.noteTitle || item.title || 'Untitled'}"`)
                        : `: ${(item.message || item.text || 'New activity').slice(0, 40)}...`
                    }
                </p>
            </div>
        </div>
    );
}

function EmptyState({ icon, message }: { icon: React.ReactNode, message: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-full mb-4 text-slate-300 dark:text-zinc-600 shadow-inner">
                {icon}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">{message}</p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Scanning...</p>
        </div>
    );
}

// Helper function for relative time formatting
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
}
