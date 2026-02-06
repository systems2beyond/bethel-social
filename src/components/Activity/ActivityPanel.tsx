'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, ChevronRight, ChevronDown, ScrollText, Clock, ExternalLink, Sparkles, Users } from 'lucide-react';
import { useActivity } from '@/context/ActivityContext';
import { useBible } from '@/context/BibleContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

import { ViewResourceModal } from '@/components/Meeting/ViewResourceModal';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const MAX_ITEMS_SHOWN = 5;
const MAX_RECENT_ITEMS = 8;

export function ActivityPanel() {
    const router = useRouter();
    const { isActivityPanelOpen, setActivityPanelOpen, notifications, invitations, usersMap, markAsViewed } = useActivity();
    const { openCollaboration, openNote } = useBible();
    const { user } = useAuth();

    if (!user) return null;

    // Both sections collapsed by default
    const [invitesExpanded, setInvitesExpanded] = useState(false);
    const [notifsExpanded, setNotifsExpanded] = useState(false);

    // ViewResourceModal state
    const [resourceModalOpen, setResourceModalOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<{
        title: string;
        content: string;
        collaborationId: string;
    } | null>(null);

    // Create combined recent items, sorted by date
    const recentItems = useMemo(() => {
        const allItems = [
            ...invitations.map(i => ({ ...i, itemType: 'invite' as const })),
            ...notifications.map(n => ({ ...n, itemType: 'notification' as const }))
        ];

        // Sort by createdAt descending
        allItems.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });

        return allItems.slice(0, MAX_RECENT_ITEMS);
    }, [invitations, notifications]);

    const unviewedInvites = invitations.filter(i => !i.viewed);
    const unviewedNotifs = notifications.filter(n => !n.viewed);

    const handleClearAll = async (type: 'invite' | 'notification') => {
        const items = type === 'invite' ? invitations : notifications;
        await Promise.all(items.filter(i => !i.viewed).map(i => markAsViewed(i.id, type)));
    };

    const handleViewMore = () => {
        router.push('/fellowship');
        setActivityPanelOpen(false);
    };

    const handleItemClick = async (item: any, type: 'invite' | 'notification') => {
        console.log('[ActivityPanel] Clicked:', { type, itemType: item.type, groupId: item.groupId, postId: item.postId, hasGroupId: !!item.groupId });

        markAsViewed(item.id, type);

        // For Group Invites and Mentions
        if (item.type === 'group_invite' || item.type === 'mention' || item.groupId) {
            console.log('[ActivityPanel] Entering Group Navigation Block');
            if (item.groupId) {
                const url = `/groups/${item.groupId}${item.postId ? `?postId=${item.postId}` : ''}`;
                console.log('[ActivityPanel] Navigating to:', url);
                router.push(url);
            } else {
                console.error('[ActivityPanel] Item has type match but NO groupId!', item);
            }
            setActivityPanelOpen(false);
            return;
        }

        // For shared scrolls (invites)
        if (type === 'invite') {
            setSelectedResource({
                title: item.noteTitle || item.title || 'Shared Scroll',
                content: item.previewContent || item.content || item.noteContent || item.description || '<p>No preview content available (Check Console)</p>',
                collaborationId: item.noteId || item.resourceId
            });
            setResourceModalOpen(true);
            setActivityPanelOpen(false);
            return;
        }

        // For notifications
        if (item.resourceId) {
            if (item.type === 'note_shared' || item.type === 'note') {
                openNote(item.resourceId, item.resourceTitle || item.title);
                setActivityPanelOpen(false);
            } else {
                // For other resources (collaborations/scrolls)

                // 1. Initial State with Loading
                setSelectedResource({
                    title: item.resourceTitle || item.title || 'Shared Resource',
                    content: '<div class="flex items-center justify-center p-8"><span class="animate-pulse text-indigo-500 font-medium">Loading content...</span></div>',
                    collaborationId: item.resourceId
                });
                setResourceModalOpen(true);
                setActivityPanelOpen(false);

                // 2. Resolve Content
                let finalContent = item.previewContent || item.content || '';

                // A. Try Local Lookup in invitations (Active Context)
                if (!finalContent) {
                    const localMatch = invitations.find(inv => inv.resourceId === item.resourceId);
                    if (localMatch) {
                        console.log('[ActivityPanel] Found local content match in invitations');
                        finalContent = localMatch.previewContent || localMatch.content || localMatch.noteContent || '';
                    }
                }

                // B. Async Fetch if still missing
                if (!finalContent) {
                    try {
                        console.log('[ActivityPanel] Fetching content for resource:', item.resourceId);
                        const q = query(collection(db, 'invitations'), where('resourceId', '==', item.resourceId), limit(1));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            const data = snap.docs[0].data();
                            finalContent = data.previewContent || data.content || data.noteContent || '';
                            console.log('[ActivityPanel] Fetched content successfully');
                        } else {
                            console.log('[ActivityPanel] No invitation found for resource.');
                            // Try to provide a helpful fallback
                            finalContent = '<p class="text-gray-500 italic text-center p-4">Content could not be loaded. You may need to open the Fellowship page directly.</p>';
                        }
                    } catch (e) {
                        console.error("[ActivityPanel] Failed to fetch content for notification", e);
                        finalContent = '<p class="text-red-400 italic text-center p-4">Error loading content.</p>';
                    }
                }

                // 3. Update Modal with resolved content
                setSelectedResource(prev => prev ? ({
                    ...prev,
                    content: finalContent || item.description || '<p>No content available.</p>'
                }) : null);
            }
        } else {
            setActivityPanelOpen(false);
        }
    };

    // Get limited items for display
    const limitedInvitations = invitations.slice(0, MAX_ITEMS_SHOWN);
    const limitedNotifications = notifications.slice(0, MAX_ITEMS_SHOWN);

    return (
        <>
            <AnimatePresence mode="wait">
                {isActivityPanelOpen && (
                    <div className="fixed inset-0 z-[10000] flex justify-end">
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setActivityPanelOpen(false)}
                            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        />

                        {/* Main Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-sm h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                                        <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Activity</h2>
                                        <p className="text-xs text-zinc-500">{unviewedInvites.length + unviewedNotifs.length} unread updates</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActivityPanelOpen(false)}
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {/* Collapsible Shared Scrolls Section */}
                                <CollapsibleSection
                                    title="Shared Scrolls"
                                    count={invitations.length}
                                    unviewedCount={unviewedInvites.length}
                                    isExpanded={invitesExpanded}
                                    onToggle={() => setInvitesExpanded(!invitesExpanded)}
                                    onClearAll={() => handleClearAll('invite')}
                                    colorClass="indigo"
                                >
                                    {limitedInvitations.length === 0 ? (
                                        <p className="text-xs text-center py-6 text-zinc-500 italic">No shared scrolls yet</p>
                                    ) : (
                                        <>
                                            <div className="space-y-1">
                                                {limitedInvitations.map((invite) => (
                                                    <ActivityItemComponent
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

                                {/* Collapsible Notifications Section */}
                                <CollapsibleSection
                                    title="Notifications"
                                    count={notifications.length}
                                    unviewedCount={unviewedNotifs.length}
                                    isExpanded={notifsExpanded}
                                    onToggle={() => setNotifsExpanded(!notifsExpanded)}
                                    onClearAll={() => handleClearAll('notification')}
                                    colorClass="zinc"
                                >
                                    {limitedNotifications.length === 0 ? (
                                        <p className="text-xs text-center py-6 text-zinc-500 italic">Everything caught up</p>
                                    ) : (
                                        <>
                                            <div className="space-y-1">
                                                {limitedNotifications.map((notif) => (
                                                    <ActivityItemComponent
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

                                {/* Recent Activity Section - Always Visible */}
                                <div className="border-t border-zinc-100 dark:border-zinc-900 mt-2">
                                    <div className="p-4 pb-2">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                                                <Sparkles className="w-3.5 h-3.5 text-white" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">
                                                Recent Activity
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="px-2 pb-4 space-y-1.5">
                                        {recentItems.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3">
                                                    <Clock className="w-6 h-6 text-zinc-400" />
                                                </div>
                                                <p className="text-xs text-zinc-500 italic">No recent activity</p>
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
                            </div>
                        </motion.div>
                    </div>
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
        </>
    );
}

// Collapsible Section Component
function CollapsibleSection({
    title,
    count,
    unviewedCount,
    isExpanded,
    onToggle,
    onClearAll,
    colorClass,
    children
}: {
    title: string;
    count: number;
    unviewedCount: number;
    isExpanded: boolean;
    onToggle: () => void;
    onClearAll: () => void;
    colorClass: 'indigo' | 'zinc';
    children: React.ReactNode;
}) {
    const badgeClasses = colorClass === 'indigo'
        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";

    return (
        <div className="border-b border-zinc-100 dark:border-zinc-900">
            <div className="w-full flex items-center justify-between p-4 bg-transparent">
                <button
                    onClick={onToggle}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 uppercase tracking-wider">{title}</h3>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", badgeClasses)}>
                        {count}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                </button>
                {unviewedCount > 0 && (
                    <button
                        onClick={onClearAll}
                        className="text-[10px] text-indigo-600 font-medium hover:underline"
                    >
                        Clear All
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white dark:bg-zinc-950"
                    >
                        <div className="px-2 pb-4">
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
            className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors group"
        >
            <span>View {count} more in Fellowship</span>
            <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
    );
}

// Compact Recent Activity Item
function RecentActivityItem({ item, usersMap, onClick }: { item: any; usersMap: any; onClick: () => void }) {
    const fromUid = item.fromUserId || item.fromUser?.uid;
    const fromUser = usersMap[fromUid] || item.fromUser || { displayName: 'User' };
    const isInvite = item.itemType === 'invite';
    const isGroupInvite = item.type === 'group_invite';
    const isMention = item.type === 'mention';

    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={cn(
                "w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 group relative",
                item.viewed
                    ? "opacity-60 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    : "bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-indigo-900/15 dark:to-transparent border-l-2 border-indigo-500"
            )}
        >
            {/* Avatar */}
            <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-xs font-bold overflow-hidden">
                    {fromUser.photoURL ? (
                        <img src={fromUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        fromUser.displayName?.[0] || 'U'
                    )}
                </div>
                {!item.viewed && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 border-2 border-white dark:border-zinc-950 rounded-full" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                        "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        isInvite
                            ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    )}>
                        {isGroupInvite ? 'Group Invite' : (isMention ? 'Mention' : (isInvite ? 'Scroll' : 'Update'))}
                    </span>
                    {/* ... Rest of component ... */}
                    <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {item.createdAt?.toDate ? formatRelativeTime(item.createdAt.toDate()) : 'Just now'}
                    </span>
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight truncate">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fromUser.displayName}</span>
                    {isInvite
                        ? (isGroupInvite
                            ? ` invited you to join "${item.groupName || 'a group'}"`
                            : ` shared "${item.noteTitle || item.title || 'Untitled'}"`)
                        : `: ${(item.message || item.text || 'New activity').slice(0, 40)}${(item.message || item.text || '').length > 40 ? '...' : ''}`
                    }
                </p>
            </div>

            {/* Icon */}
            <div className={cn(
                "shrink-0 p-1.5 rounded-lg transition-colors",
                isInvite
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
            )}>
                {isGroupInvite ? <Users className="w-3.5 h-3.5" /> : (isInvite ? <ScrollText className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />)}
            </div>
        </motion.button>
    );
}

function ActivityItemComponent({ item, usersMap, type, onClick }: { item: any; usersMap: any; type: 'invite' | 'notification', onClick: () => void }) {
    const fromUid = item.fromUserId || item.fromUser?.uid;
    const fromUser = usersMap[fromUid] || item.fromUser || { displayName: 'User' };

    const isGroupInvite = item.type === 'group_invite';
    const isMention = item.type === 'mention';

    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={cn(
                "w-full text-left p-4 rounded-2xl transition-all duration-200 flex items-start gap-4 group relative",
                item.viewed
                    ? "opacity-60 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    : "bg-gradient-to-tr from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-zinc-950 border border-indigo-100/50 dark:border-indigo-900/20 shadow-sm"
            )}
        >
            <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-bold overflow-hidden border border-zinc-200 dark:border-zinc-700">
                    {fromUser.photoURL ? (
                        <img src={fromUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        fromUser.displayName?.[0] || 'U'
                    )}
                </div>
                {!item.viewed && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 border-2 border-white dark:border-zinc-950 rounded-full" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        {type === 'invite'
                            ? (isGroupInvite ? 'Group Invite' : 'Shared Scroll')
                            : (isMention ? 'Mention' : 'Notification')}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Now'}
                    </span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{fromUser.displayName}</span>
                    {type === 'invite'
                        ? (isGroupInvite
                            ? ` invited you to join "${item.groupName || 'a group'}"`
                            : ` shared a scroll with you: "${item.noteTitle || item.title || 'Untitled'}"`)
                        : (isMention
                            ? ` mentioned you in "${item.groupName || 'a group'}"`
                            : (item.groupName
                                ? ` posted in "${item.groupName}"`
                                : ` sent an update: "${item.message || item.text || 'New activity'}"`))
                    }
                </p>
            </div>
        </motion.button>
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
