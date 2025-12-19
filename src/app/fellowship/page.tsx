'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, BookOpen, MessageSquare, Plus, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBible } from '@/context/BibleContext';
import MeetingList from '@/components/Fellowship/MeetingList';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';

export default function FellowshipPage() {
    const { user } = useAuth();
    const { openCollaboration } = useBible();
    const [activeTab, setActiveTab] = useState<'gatherings' | 'studies' | 'community'>('gatherings');
    const [invitations, setInvitations] = useState<any[]>([]);

    React.useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'invitations'),
            where('toUserId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [user]);

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
                                {invitations.length === 0 ? (
                                    <EmptyState
                                        icon={<BookOpen className="w-10 h-10 text-purple-500" />}
                                        title="Shared Scrolls"
                                        description="Collaborative notes and Bible studies from your meetings will appear here shortly."
                                        color="purple"
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {invitations.map((invite) => (
                                            <div
                                                key={invite.id}
                                                onClick={() => openCollaboration(invite.resourceId, invite.title)}
                                                className="group relative bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                                            >
                                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold shadow-sm">
                                                            {invite.fromUser?.displayName?.[0] || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                                {invite.fromUser?.displayName || 'Unknown'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                                Shared {invite.createdAt?.seconds ? formatDistanceToNow(new Date(invite.createdAt.seconds * 1000), { addSuffix: true }) : 'recently'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="p-2 rounded-full bg-gray-50 dark:bg-zinc-800 text-gray-400 group-hover:text-purple-500 group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 transition-colors">
                                                        <BookOpen className="w-4 h-4" />
                                                    </div>
                                                </div>

                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-purple-500 transition-colors">
                                                    {invite.title}
                                                </h3>

                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                                                    Click to view this shared scroll and collaborate in real-time.
                                                </p>

                                                <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                                                    <span>Open Scroll</span>
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            </div>
                                        ))}
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
            </main>
        </div>
    );
}

function EmptyState({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center rounded-3xl bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md border border-white/20 dark:border-white/5">
            <div className={`
                p-6 rounded-3xl mb-6 ring-1 ring-inset ring-white/10 shadow-2xl
                bg-gradient-to-br from-${color}-500/20 to-${color}-600/5
            `}>
                {icon}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {title}
            </h3>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
                {description}
            </p>
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
