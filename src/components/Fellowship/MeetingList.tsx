'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Calendar, Video, Check, X, Clock } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Meeting {
    id: string;
    title: string;
    date: string;
    meetLink: string;
    createdBy: string;
    attendeeUids?: string[];
    attendeeResponses?: { [uid: string]: 'accepted' | 'declined' | 'tentative' };
}

export default function MeetingList() {
    const { user } = useAuth();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);

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

        const unsub1 = onSnapshot(q1, (snap1) => {
            const list1 = snap1.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
            updateList(list1, 'created');
        }, (error) => {
            console.error("Error fetching created meetings:", error);
            setLoading(false); // Ensure loader stops even on error
        });

        const unsub2 = onSnapshot(q2, (snap2) => {
            const list2 = snap2.docs.map(d => ({ id: d.id, ...d.data() } as Meeting));
            updateList(list2, 'invited');
        }, (error) => {
            console.error("Error fetching invited meetings:", error);
            setLoading(false);
        });

        let createdList: Meeting[] = [];
        let invitedList: Meeting[] = [];

        const updateList = (list: Meeting[], type: 'created' | 'invited') => {
            if (type === 'created') createdList = list;
            if (type === 'invited') invitedList = list;

            // Merge and Dedupe
            const all = [...createdList, ...invitedList];
            const unique = Array.from(new Map(all.map(m => [m.id, m])).values());

            // Sort by date descending
            unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setMeetings(unique);
            setLoading(false);
        };

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

    if (meetings.length === 0) {
        return (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Gatherings Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                    Start a new meeting or wait for an invitation.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {meetings.map(m => (
                <MeetingCard key={m.id} meeting={m} currentUserId={user?.uid || ''} />
            ))}
        </div>
    );
}

function MeetingCard({ meeting, currentUserId }: { meeting: Meeting, currentUserId: string }) {
    const isHost = meeting.createdBy === currentUserId;
    const response = meeting.attendeeResponses?.[currentUserId] || 'pending';

    // Meeting is "past" only after 2 hours from start time (duration buffer)
    const isPast = new Date(meeting.date).getTime() + (2 * 60 * 60 * 1000) < Date.now();

    const canJoin = isHost || response === 'accepted' || response === 'pending';

    // Status Badge Logic
    let statusBadge = null;
    if (isHost) {
        statusBadge = <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full uppercase tracking-wider border border-blue-200 dark:border-blue-900">Host</span>;
    } else if (response === 'accepted') {
        statusBadge = <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold rounded-full uppercase tracking-wider border border-green-200 dark:border-green-900">Going</span>;
    } else if (response === 'declined') {
        statusBadge = <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-full uppercase tracking-wider border border-red-200 dark:border-red-900">Declined</span>;
    } else {
        statusBadge = <span className="px-3 py-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-bold rounded-full uppercase tracking-wider border border-yellow-200 dark:border-yellow-900 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />Invite</span>;
    }

    const handleRespond = async (status: 'accepted' | 'declined') => {
        try {
            const respondFn = httpsCallable(functions, 'respondToMeeting');
            await respondFn({ meetingId: meeting.id, response: status });
            toast.success(status === 'accepted' ? 'Meeting accepted' : 'Meeting declined');
        } catch (e: any) {
            toast.error('Failed to respond: ' + e.message);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
                group flex items-center justify-between p-4 rounded-xl transition-all duration-200
                ${isPast ? 'opacity-60' : 'hover:bg-zinc-900/50 cursor-pointer'}
                border-b border-zinc-800/50 last:border-0
            `}
        >
            <div className="flex items-start gap-4 min-w-0">
                {/* Date - Text Format like Notes */}
                <div className="flex flex-col items-start gap-1 shrink-0 pt-0.5">
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                        {new Date(meeting.date).toLocaleString([], { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-xl font-bold text-white leading-none">
                        {new Date(meeting.date).getDate()}
                    </span>
                </div>

                {/* Content */}
                <div className="flex flex-col min-w-0 gap-1">
                    <div className="flex items-center gap-2">
                        <h3 className={`text-base font-semibold truncate ${isPast ? 'text-zinc-500' : 'text-zinc-100 group-hover:text-white'}`}>
                            {meeting.title}
                        </h3>
                        {/* Status Badge - Neon Glow */}
                        {isHost && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-purple-500/30 bg-purple-900/20 text-purple-300 font-medium shadow-[0_0_10px_rgba(168,85,247,0.3)]">HOST</span>
                        )}
                        {!isHost && response === 'accepted' && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-green-500/30 bg-green-900/20 text-green-300 font-medium shadow-[0_0_10px_rgba(34,197,94,0.3)]">GOING</span>
                        )}
                        {!isHost && response === 'declined' && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-red-500/30 bg-red-900/20 text-red-400 font-medium shadow-[0_0_10px_rgba(239,68,68,0.3)]">DECLINED</span>
                        )}
                        {!isHost && response === 'pending' && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-900/20 text-amber-300 font-medium shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse">INVITE</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        <span>
                            {new Date(meeting.date).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <span className="truncate">Google Meet</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 shrink-0">
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

                {meeting.meetLink && (
                    <a
                        href={meeting.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`
                            flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-xs font-bold tracking-wide transition-all
                            ${canJoin
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 border border-blue-400/20'
                                : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed hidden'
                            }
                        `}
                    >
                        <Video className="w-4 h-4" />
                        <span>JOIN</span>
                    </a>
                )}
            </div>
        </motion.div>
    );
}
