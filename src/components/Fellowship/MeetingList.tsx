'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Calendar, Video, Check, X, Clock, BookOpen, Sparkles, ChevronDown } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Meeting {
    id: string;
    title: string;
    date: string;
    meetLink: string;
    createdBy: string;
    attendeeUids?: string[];
    attendeeResponses?: Record<string, 'accepted' | 'declined' | 'tentative'>;
    status?: 'scheduled' | 'active' | 'completed';
    description?: string;
    linkedResourceId?: string;
    linkedResourceType?: 'scroll' | 'bible';
    linkedResourceTitle?: string;
    linkedResourceContent?: string;
}

import CreateMeetingModal from '@/components/Meeting/CreateMeetingModal'; // Ensure this path is correct based on structure

export default function MeetingList() {
    const { user } = useAuth();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Fetch meetings where user is creator
        const q1 = query(
            collection(db, 'meetings'),
            where('createdBy', '==', user.uid),
            // orderBy('date', 'desc') // Requires composite index potentially
        );

        // Fetch meetings where user is invitee
        const q2 = query(
            collection(db, 'meetings'),
            where('attendeeUids', 'array-contains', user.uid),
            // orderBy('date', 'desc')
        );

        // Note: Firestore doesn't support logical OR queries efficiently across different fields easily in one go for real-time.
        // We will listen to both and merge client-side.

        const handleSnapshot = (snapshot: any, type: 'created' | 'invited') => {
            return snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as Meeting[];
        };

        // Combine logic (simplified for brevity, ensuring unique ID)
        let createdMeetings: Meeting[] = [];
        let invitedMeetings: Meeting[] = [];

        const updateState = () => {
            const all = [...createdMeetings, ...invitedMeetings];
            const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
            // Sort by Date Descending
            unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setMeetings(unique);
            setLoading(false);
        };

        const unsub1 = onSnapshot(q1, (snap) => {
            createdMeetings = handleSnapshot(snap, 'created');
            updateState();
        }, (error) => {
            console.error("Error fetching created meetings:", error);
            setLoading(false); // Ensure loader stops even on error
        });

        const unsub2 = onSnapshot(q2, (snap) => {
            invitedMeetings = handleSnapshot(snap, 'invited');
            updateState();
        }, (error) => {
            console.error("Error fetching invited meetings:", error);
            setLoading(false);
        });

        return () => {
            unsub1();
            unsub2();
        };
    }, [user]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Gatherings</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                    <Calendar className="w-4 h-4" />
                    New Gathering
                </button>
            </div>

            {meetings.length === 0 ? (
                <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                        <Calendar className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">No Gatherings Yet</h3>
                    <p className="text-gray-500 dark:text-zinc-500 max-w-sm mx-auto mt-2">
                        Schedule a new meeting to fellowship with others.
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-6 text-blue-400 hover:text-blue-300 text-sm font-medium hover:underline"
                    >
                        Create your first meeting
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {meetings.map(m => (
                        <MeetingCard key={m.id} meeting={m} currentUserId={user?.uid || ''} />
                    ))}
                </div>
            )}

            <CreateMeetingModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            // We could pass initial data if triggered from elsewhere
            />
        </div>
    );
}

import { MeetingChat } from '@/components/Meeting/MeetingChat';
import { ViewResourceModal } from '@/components/Meeting/ViewResourceModal';

function MeetingCard({ meeting, currentUserId }: { meeting: Meeting, currentUserId: string }) {
    const isHost = meeting.createdBy === currentUserId;
    const response = meeting.attendeeResponses?.[currentUserId] || 'pending';
    const [expanded, setExpanded] = useState(false);
    const [viewingResource, setViewingResource] = useState(false);

    // Status Logic
    const status = meeting.status || 'scheduled';
    const isActive = status === 'active';
    const isCompleted = status === 'completed';
    const isPast = isCompleted || (new Date(meeting.date).getTime() + (2 * 60 * 60 * 1000) < Date.now() && status !== 'active');

    const canJoin = isHost || response === 'accepted' || response === 'pending';

    const handleRespond = async (status: 'accepted' | 'declined') => {
        try {
            const respondFn = httpsCallable(functions, 'respondToMeeting');
            await respondFn({ meetingId: meeting.id, response: status });
            toast.success(status === 'accepted' ? 'Meeting accepted' : 'Meeting declined');
        } catch (e: any) {
            toast.error('Failed to respond: ' + e.message);
        }
    };

    const handleUpdateStatus = async (newStatus: 'active' | 'completed') => {
        try {
            const updateFn = httpsCallable(functions, 'updateMeetingStatus');
            await updateFn({ meetingId: meeting.id, status: newStatus });
            toast.success(newStatus === 'active' ? 'Meeting started!' : 'Meeting ended.');
        } catch (e: any) {
            toast.error('Failed to update status: ' + e.message);
        }
    };

    const handleGenerateRecap = async () => {
        toast.promise(
            async () => {
                const generateFn = httpsCallable(functions, 'generateMeetingRecap');
                await generateFn({ meetingId: meeting.id });
            },
            {
                loading: 'Generating Meeting Minutes with AI...',
                success: 'Recap generated and saved to your Notes!',
                error: (err) => `Failed: ${err.message}`
            }
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
                group flex flex-col rounded-xl transition-all duration-300 overflow-hidden
                ${expanded ? 'bg-neutral-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-xl my-4' : 'bg-neutral-100 dark:bg-transparent hover:bg-neutral-200 dark:hover:bg-zinc-900/50 cursor-pointer border-b border-gray-200 dark:border-zinc-800/50 last:border-0'}
            `}
            onClick={() => !expanded && setExpanded(true)}
        >
            {/* Header / Summary Row */}
            <div className="flex items-center justify-between p-4">
                <div className="flex items-start gap-4 min-w-0">
                    <div className="flex flex-col items-start gap-1 shrink-0 pt-0.5">
                        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                            {new Date(meeting.date).toLocaleString([], { month: 'short' }).toUpperCase()}
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                            {new Date(meeting.date).getDate()}
                        </span>
                    </div>

                    <div className="flex flex-col min-w-0 gap-1">
                        <div className="flex items-center gap-2">
                            <h3 className={`text-base font-semibold truncate ${isPast && !isActive ? 'text-gray-500 dark:text-zinc-500' : 'text-gray-900 dark:text-zinc-100'}`}>
                                {meeting.title}
                            </h3>

                            {/* Badges */}
                            {isActive && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-wide animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    LIVE
                                </span>
                            )}
                            {isHost && (
                                <span className="text-[10px] px-2 py-0.5 rounded border border-purple-500/30 bg-purple-900/20 text-purple-300 font-medium">HOST</span>
                            )}
                            {!isHost && response === 'accepted' && (
                                <span className="text-[10px] px-2 py-0.5 rounded border border-green-500/30 bg-green-900/20 text-green-300 font-medium">GOING</span>
                            )}
                            {!isHost && response === 'pending' && (
                                <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-900/20 text-amber-300 font-medium animate-pulse">INVITE</span>
                            )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span>{new Date(meeting.date).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</span>
                            {meeting.linkedResourceId && (
                                <span className="flex items-center gap-1 text-blue-400">
                                    • <BookOpen className="w-3 h-3" /> Linked Scroll
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions (Collapsed) */}
                {!expanded && (
                    <div className="flex items-center gap-3">
                        {/* Invite Actions */}
                        {!isHost && response === 'pending' && !isPast && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRespond('declined'); }}
                                    className="text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1"
                                >
                                    Decline
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRespond('accepted'); }}
                                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium border border-zinc-700"
                                >
                                    Accept
                                </button>
                            </>
                        )}

                        {canJoin && meeting.meetLink && !isPast && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(meeting.meetLink, '_blank');
                                }}
                                className={`
                                px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                                ${isActive
                                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                                    }
                            `}>
                                {isActive ? 'JOIN LIVE' : 'JOIN'}
                            </button>
                        )}
                        <ChevronDown className="w-5 h-5 text-zinc-600" />
                    </div>
                )}
                {expanded && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                        className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                )}
            </div>
            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 border-t border-zinc-800/50 pt-4 flex flex-col md:flex-row gap-6">
                            {/* Left: Controls & Context */}
                            <div className="flex-1 space-y-6">
                                {meeting.description && (
                                    <div className="text-sm text-zinc-400 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800">
                                        {meeting.description}
                                    </div>
                                )}

                                {/* Invite Actions (Expanded) */}
                                {!isHost && response === 'pending' && !isPast && (
                                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                        <span className="text-xs text-amber-500 font-medium flex-1">You are invited to this meeting.</span>
                                        <button
                                            onClick={() => handleRespond('declined')}
                                            className="text-xs text-zinc-400 hover:text-white px-3 py-1.5"
                                        >
                                            Decline
                                        </button>
                                        <button
                                            onClick={() => handleRespond('accepted')}
                                            className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-lg font-bold"
                                        >
                                            Accept
                                        </button>
                                    </div>
                                )}

                                {/* Host Controls */}
                                {isHost && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Host Controls</h4>
                                        <div className="flex gap-2">
                                            {!isActive && !isCompleted && (
                                                <button
                                                    onClick={() => handleUpdateStatus('active')}
                                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-green-500/20"
                                                >
                                                    START MEETING
                                                </button>
                                            )}
                                            {isActive && (
                                                <button
                                                    onClick={() => handleUpdateStatus('completed')}
                                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-red-500/20"
                                                >
                                                    END MEETING
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Meeting Actions */}
                                <div className="space-y-3">
                                    {canJoin && meeting.meetLink && (
                                        <a
                                            href={meeting.meetLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`
                                        block w-full text-center py-3 rounded-xl font-bold transition-all
                                        ${isActive
                                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02]'
                                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                                                }
                                    `}
                                        >
                                            {isActive ? 'Join Live Meeting' : 'Join Google Meet'}
                                        </a>
                                    )}

                                    {/* Resources Section */}
                                    <div className="space-y-2 pt-2">
                                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                                            Resources
                                            {/* Placeholder for "Add" button */}
                                            {/* <button className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 hover:text-white">+ Add</button> */}
                                        </h4>

                                        {meeting.linkedResourceId ? (
                                            <>
                                                <button
                                                    onClick={() => setViewingResource(true)}
                                                    className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200 rounded-xl font-medium border border-zinc-700/50 transition-colors text-left group/resource"
                                                >
                                                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover/resource:bg-blue-500/20">
                                                        <BookOpen className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{meeting.linkedResourceTitle || 'Attached Scroll'}</div>
                                                        <div className="text-xs text-zinc-500">Click to open</div>
                                                    </div>
                                                </button>

                                                <ViewResourceModal
                                                    isOpen={viewingResource}
                                                    onClose={() => setViewingResource(false)}
                                                    title={meeting.linkedResourceTitle || 'Attached Scroll'}
                                                    content={meeting.linkedResourceContent || ''}
                                                    meetingId={meeting.id}
                                                />
                                            </>
                                        ) : (
                                            <div className="text-xs text-zinc-500 italic p-2 text-center border border-dashed border-zinc-800 rounded-xl">
                                                No resources attached
                                            </div>
                                        )}
                                    </div>

                                    {/* Recap for Ended Meetings */}
                                    {isCompleted && (
                                        <button
                                            onClick={handleGenerateRecap}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-xl font-medium transition-colors"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Generate AI Recap to Notes
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Right: Chat */}
                            <div className="w-full md:w-96 h-[600px] border-l border-zinc-800 pl-0 md:pl-6 flex flex-col">
                                <MeetingChat meetingId={meeting.id} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
