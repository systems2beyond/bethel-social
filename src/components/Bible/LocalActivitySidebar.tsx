import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Wifi, ChevronRight, ChevronDown, MessageSquare, Plus, ArrowRight, ExternalLink, ScrollText, Bell, Inbox, Sparkles, Clock } from 'lucide-react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useActivity } from '@/context/ActivityContext';
import { useBible } from '@/context/BibleContext';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ViewResourceModal } from '@/components/Meeting/ViewResourceModal';

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

type TabType = 'activity' | 'live';

const MAX_ITEMS_SHOWN = 5;
const MAX_RECENT_ITEMS = 6;

export function LocalActivitySidebar({ onJoinScroll, currentScrollId, className }: LocalActivitySidebarProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { invitations, notifications, usersMap, markAsViewed, setActivityPanelOpen } = useActivity();
    const { openNote, openCollaboration } = useBible();
    const [localScrolls, setLocalScrolls] = useState<ActiveScroll[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('activity');

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
            ...notifications.map(n => ({ ...n, itemType: 'notification' as const }))
        ];

        allItems.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });

        return allItems.slice(0, MAX_RECENT_ITEMS);
    }, [invitations, notifications]);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'invitations'),
            where('type', '==', 'scroll'),
            limit(5)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const scrolls: ActiveScroll[] = [];
            const seenIds = new Set<string>();

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const scrollId = data.resourceId;

                if (scrollId && scrollId !== currentScrollId && !seenIds.has(scrollId)) {
                    seenIds.add(scrollId);
                    scrolls.push({
                        id: scrollId,
                        title: data.resourceTitle || 'Bible Study Session',
                        description: data.message || 'Collaborative Bible study session',
                        authorName: data.fromUser?.displayName || 'A fellow believer',
                        participantCount: Math.floor(Math.random() * 5) + 2,
                    });
                }
            });

            setLocalScrolls(scrolls);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, currentScrollId]);

    const handleViewMore = () => {
        router.push('/fellowship');
        setIsExpanded(false);
    };

    const handleItemClick = (item: any, type: 'invite' | 'notification') => {
        console.log('handleItemClick called:', { item, type });
        markAsViewed(item.id, type);

        // For invites (shared scrolls), show the ViewResourceModal with options
        if (type === 'invite') {
            setSelectedResource({
                title: item.noteTitle || item.title || 'Shared Scroll',
                content: item.content || item.noteContent || '',
                collaborationId: item.noteId || item.resourceId
            });
            setResourceModalOpen(true);
            setIsExpanded(false);
            setActivityPanelOpen(false);
            return;
        }

        // For other notifications
        if (item.resourceId) {
            if (item.type === 'note_shared' || item.type === 'note') {
                // Personal notes open directly
                openNote(item.resourceId, item.resourceTitle || item.title);
            } else {
                // For scroll/collaboration notifications, show the modal with options
                setSelectedResource({
                    title: item.resourceTitle || item.title || 'Shared Resource',
                    content: item.content || '',
                    collaborationId: item.resourceId
                });
                setResourceModalOpen(true);
                setIsExpanded(false);
                setActivityPanelOpen(false);
                return;
            }
        }
        setIsExpanded(false);
        setActivityPanelOpen(false);
    };

    // Limited items for collapsible sections
    const limitedInvitations = invitations.slice(0, MAX_ITEMS_SHOWN);
    const limitedNotifications = notifications.slice(0, MAX_ITEMS_SHOWN);

    if (!user) return null;

    return (
        <div className={cn("fixed right-0 top-1/2 -translate-y-1/2 z-[100] flex items-center", className)}>
            {/* Toggle Handle */}
            <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "flex flex-col items-center gap-2 py-4 px-1.5 bg-indigo-600 text-white rounded-l-xl shadow-xl border-y border-l border-indigo-400/30 transition-all",
                    isExpanded ? "translate-x-0" : "hover:px-3"
                )}
                initial={false}
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
                    Connect
                </div>
                <ChevronRight className={cn("w-4 h-4 mt-1 transition-transform", isExpanded && "rotate-180")} />
            </motion.button>

            {/* Content Sidebar */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        className="w-80 h-[550px] bg-white dark:bg-[#0f172a] border border-indigo-100 dark:border-indigo-900/40 rounded-l-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header & Tabs */}
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
                            <div className="p-4 pb-2 flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2 text-sm">
                                    <Sparkles className="w-4 h-4 text-indigo-200" />
                                    Fellowship Center
                                </h3>
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <Plus className="w-5 h-5 rotate-45" />
                                </button>
                            </div>

                            {/* Tab Bar */}
                            <div className="flex px-2 pb-0 justify-around border-b border-white/10">
                                <TabButton
                                    id="activity"
                                    active={activeTab === 'activity'}
                                    label="Activity"
                                    icon={<Bell className="w-4 h-4" />}
                                    count={totalUnread}
                                    onClick={() => setActiveTab('activity')}
                                />
                                <TabButton
                                    id="live"
                                    active={activeTab === 'live'}
                                    label="Live"
                                    icon={<Wifi className="w-4 h-4" />}
                                    count={localScrolls.length}
                                    onClick={() => setActiveTab('live')}
                                />
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                                                        onJoinScroll(scroll.id, scroll.title);
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
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="p-3 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Studying Together</span>
                            <button
                                onClick={handleViewMore}
                                className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                            >
                                View All <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ViewResourceModal for shared scrolls */}
            <ViewResourceModal
                isOpen={resourceModalOpen}
                onClose={() => {
                    setResourceModalOpen(false);
                    setSelectedResource(null);
                }}
                title={selectedResource?.title || ''}
                content={selectedResource?.content || ''}
                type="scroll"
                collaborationId={selectedResource?.collaborationId}
            />
        </div>
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
                        ? ` shared "${(item.noteTitle || item.title || 'Untitled').slice(0, 20)}${(item.noteTitle || item.title || '').length > 20 ? '...' : ''}"`
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
                {isInvite ? <ScrollText className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
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
                    <span className="text-[10px] text-slate-400 font-medium">{scroll.participantCount} active</span>
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
                        {type === 'invite' ? 'Shared Scroll' : 'Update'}
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
                        ? ` shared "${item.noteTitle || item.title || 'Untitled'}"`
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
