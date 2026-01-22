'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, BookOpen, MessageSquare, Plus, Calendar, Trash2, Bell, Share2, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBible } from '@/context/BibleContext';
import MeetingList from '@/components/Fellowship/MeetingList';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ViewResourceModal } from '@/components/Meeting/ViewResourceModal';
import { cn } from '@/lib/utils';
import { useActivity } from '@/context/ActivityContext';
import { EmptyState } from '@/components/Fellowship/EmptyState';

export default function FellowshipPage() {
    const { user } = useAuth();
    const {
        invitations,
        setSelectedResource,
        selectedResource
    } = useActivity();

    const [activeTab, setActiveTab] = useState<'gatherings' | 'studies' | 'community'>('gatherings');
    const [sentInvitations, setSentInvitations] = useState<any[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, any>>({}); // Cache for user details

    const handleDeleteInvitation = async (inviteId: string) => {
        if (confirm('Are you sure you want to delete this shared scroll?')) {
            try {
                await deleteDoc(doc(db, 'invitations', inviteId));
            } catch (error) {
                console.error("Error deleting invitation:", error);
                alert("Failed to delete. Please try again.");
            }
        }
    };

    React.useEffect(() => {
        if (!user) return;

        // Sent Invitations (Index: fromUser.uid + createdAt)
        const qSent = query(
            collection(db, 'invitations'),
            where('fromUser.uid', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubSent = onSnapshot(qSent, (snapshot) => {
            setSentInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Fellowship Page: Error fetching sent invitations", error);
        });

        return () => unsubSent();
    }, [user]);

    // Fetch user details for Sent Invitations
    React.useEffect(() => {
        const fetchUsers = async () => {
            const userIdsToFetch = new Set<string>();
            sentInvitations.forEach(invite => {
                if (invite.toUserId && !usersMap[invite.toUserId]) {
                    userIdsToFetch.add(invite.toUserId);
                }
            });

            if (userIdsToFetch.size === 0) return;

            const newUsersMap = { ...usersMap };
            await Promise.all(Array.from(userIdsToFetch).map(async (uid) => {
                try {
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        newUsersMap[uid] = userDoc.data();
                    } else {
                        newUsersMap[uid] = { displayName: 'Unknown User' };
                    }
                } catch (e) {
                    console.error("Error fetching user", uid, e);
                    newUsersMap[uid] = { displayName: 'Error' };
                }
            }));
            setUsersMap(newUsersMap);
        };

        if (sentInvitations.length > 0) {
            fetchUsers();
        }
    }, [sentInvitations]);

    return (
        <div className="relative min-h-[calc(100vh-theme(spacing.16))] bg-gray-50 dark:bg-black/95 md:pt-0 overflow-hidden">

            {/* Subtle Texture Only */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none brightness-100 dark:brightness-50" />

            <main className="relative z-10 w-full p-4 md:p-6 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col items-start text-left gap-6">
                    <div className="space-y-4 flex flex-col items-start">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider"
                        >
                            <Users className="w-3 h-3" />
                            Community Hub
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white"
                        >
                            Fellowship
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-gray-500 dark:text-gray-400 max-w-md"
                        >
                            Connect with your church family, join gatherings, and grow together in faith.
                        </motion.p>
                    </div>

                    {/* Glass Tabs - Centered Below Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="p-1.5 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-xl shadow-black/5 flex items-center gap-1 w-full md:w-auto overflow-x-auto"
                    >
                        <TabButton
                            active={activeTab === 'gatherings'}
                            onClick={() => setActiveTab('gatherings')}
                            icon={<Calendar className="w-4 h-4" />}
                            label="Gatherings"
                        />
                        <TabButton
                            active={activeTab === 'studies'}
                            onClick={() => setActiveTab('studies')}
                            icon={<BookOpen className="w-4 h-4" />}
                            label="Scrolls"
                        />
                        <TabButton
                            active={activeTab === 'community'}
                            onClick={() => setActiveTab('community')}
                            icon={<MessageSquare className="w-4 h-4" />}
                            label="Community"
                        />
                    </motion.div>
                </div>

                {/* Content Area */}
                <div className="min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {activeTab === 'gatherings' && (
                            <motion.div
                                key="gatherings"
                                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                            >
                                <MeetingList />
                            </motion.div>
                        )}

                        {activeTab === 'studies' && (
                            <motion.div
                                key="studies"
                                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                                transition={{ duration: 0.4 }}
                            >
                                {invitations.length === 0 && sentInvitations.length === 0 ? (
                                    <EmptyState
                                        icon={<BookOpen className="w-10 h-10 text-purple-500" />}
                                        title="Shared Scrolls"
                                        description="Collaborative notes and Bible studies from your meetings will appear here shortly."
                                        color="purple"
                                    />
                                ) : (
                                    <div className="space-y-8">
                                        {/* Received Invitations */}
                                        {invitations.length > 0 && (
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1">Received</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {invitations.map((invite) => {
                                                        const hasMessage = !!invite.message;
                                                        const glowColor = hasMessage ? 'cyan' : 'purple';

                                                        return (
                                                            <div
                                                                key={invite.id}
                                                                onClick={() => setSelectedResource(invite)}
                                                                className={`group relative bg-black/80 dark:bg-zinc-900 border rounded-2xl p-4 hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden ring-1 animate-pulse-slow
                                                                    ${hasMessage
                                                                        ? 'border-cyan-500/30 ring-cyan-500/50 shadow-[0_0_15px_-3px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_-5px_rgba(34,211,238,0.6)]'
                                                                        : 'border-purple-500/30 ring-purple-500/50 shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_-5px_rgba(168,85,247,0.6)]'}
                                                                `}
                                                            >
                                                                {/* Neon Gradient Border Effect */}
                                                                <div className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500
                                                                    ${hasMessage
                                                                        ? 'from-blue-500/20 via-cyan-500/20 to-teal-500/20'
                                                                        : 'from-cyan-500/20 via-purple-500/20 to-pink-500/20'}
                                                                `} />

                                                                <div className="relative z-10">
                                                                    <div className="flex items-start justify-between mb-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg
                                                                                ${hasMessage
                                                                                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/30'
                                                                                    : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30'}
                                                                            `}>
                                                                                {invite.fromUser?.displayName?.[0] || '?'}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-100">
                                                                                    {invite.fromUser?.displayName || 'Unknown'}
                                                                                </p>
                                                                                <p className={`text-[10px] flex items-center gap-1 ${hasMessage ? 'text-cyan-300' : 'text-purple-300'}`}>
                                                                                    Received {invite.createdAt?.seconds ? formatDistanceToNow(new Date(invite.createdAt.seconds * 1000), { addSuffix: true }) : 'recently'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={`p-1.5 rounded-full ${hasMessage ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'}`}>
                                                                                <BookOpen className="w-3 h-3" />
                                                                            </div>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteInvitation(invite.id);
                                                                                }}
                                                                                className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors"
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    <h3 className={`text-base font-bold text-white mb-1 transition-colors ${hasMessage ? 'group-hover:text-cyan-300' : 'group-hover:text-purple-300'}`}>
                                                                        {invite.title}
                                                                    </h3>

                                                                    {hasMessage ? (
                                                                        <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-2 mb-3">
                                                                            <p className="text-xs text-cyan-200 italic line-clamp-2">
                                                                                "{invite.message}"
                                                                            </p>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                                                                            Click to view and join collaboration.
                                                                        </p>
                                                                    )}

                                                                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide opacity-80 group-hover:opacity-100 ${hasMessage ? 'text-cyan-400' : 'text-purple-400'}`}>
                                                                        <span>Open Scroll</span>
                                                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                            <path d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Sent Invitations */}
                                        {sentInvitations.length > 0 && (
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1">Sent by You</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {sentInvitations.map((invite) => (
                                                        <div
                                                            key={invite.id}
                                                            onClick={() => setSelectedResource(invite)}
                                                            className="group relative bg-white/5 dark:bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all duration-200 cursor-pointer"
                                                        >
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-bold">
                                                                        You
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-gray-300">
                                                                            To: {usersMap[invite.toUserId]?.displayName || 'Loading...'}
                                                                        </p>
                                                                        <p className="text-[10px] text-gray-500">
                                                                            Sent {invite.createdAt?.seconds ? formatDistanceToNow(new Date(invite.createdAt.seconds * 1000), { addSuffix: true }) : 'recently'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="px-2 py-0.5 rounded-full bg-gray-800 text-[10px] font-medium text-gray-400 border border-gray-700">
                                                                        Sent
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteInvitation(invite.id);
                                                                        }}
                                                                        className="p-1.5 rounded-full hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <h3 className="text-base font-bold text-gray-200 mb-1">
                                                                {invite.title}
                                                            </h3>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'community' && (
                            <motion.div
                                key="community"
                                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                                transition={{ duration: 0.4 }}
                            >
                                <EmptyState
                                    icon={<MessageSquare className="w-10 h-10 text-green-500" />}
                                    title="Community Board"
                                    description="A place to share prayer requests, praise reports, and general discussion."
                                    color="green"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Shared Scroll Preview Modal */}
                {selectedResource && (
                    <ViewResourceModal
                        isOpen={!!selectedResource}
                        onClose={() => setSelectedResource(null)}
                        title={selectedResource.title || 'Untitled Scroll'}
                        content={selectedResource.previewContent || '<p>No preview content available.</p>'}
                        type="scroll"
                        // For collaboration, we use the resourceId from the invitation
                        meetingId={selectedResource.resourceId} // Keep for meeting context if needed
                        collaborationId={selectedResource.resourceId} // Explicitly override for standard scrolls
                    />
                )}
            </main>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`
                relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
                ${active ? 'text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'}
            `}
        >
            {active && (
                <motion.div
                    layoutId="activeTabFellowship"
                    className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-xl shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
            )}
            <span className="relative z-10 flex items-center gap-2">
                {icon}
                {label}
            </span>
        </button>
    );
}
