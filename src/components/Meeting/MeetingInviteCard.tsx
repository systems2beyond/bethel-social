'use client';

import React from 'react';
import { Calendar, Video, Clock, Users, ArrowRight, Share2, MessageSquare, QrCode, FileText } from 'lucide-react';
import { Meeting } from '@/types';
import { format } from 'date-fns';

interface MeetingInviteCardProps {
    meeting: Meeting;
    onJoin: () => void;
    onViewDetails: () => void;
}

export default function MeetingInviteCard({ meeting, onJoin, onViewDetails }: MeetingInviteCardProps) {
    const status = meeting.status || 'scheduled';
    const isLive = status === 'active';
    const isCompleted = status === 'completed';

    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Context Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                            {meeting.type}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {meeting.topic}
                        </span>
                    </div>
                </div>

                {isLive ? (
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full animate-pulse">
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                        LIVE
                    </span>
                ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {format(meeting.startTime, 'MMM d, h:mm a')}
                    </span>
                )}
            </div>

            {/* Content Body */}
            <div className="p-4">
                <div className="flex items-start gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{meeting.durationMinutes} min</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Users className="w-4 h-4" />
                                <span>{meeting.participants.length} attending</span>
                            </div>
                        </div>

                        {meeting.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                {meeting.description}
                            </p>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={onJoin}
                                disabled={isCompleted}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${isLive
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
                                        : isCompleted
                                            ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 cursor-not-allowed'
                                            : 'bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                <Video className="w-4 h-4" />
                                {isLive ? 'Join Now' : isCompleted ? 'Ended' : 'View Details'}
                            </button>

                            <button
                                onClick={onViewDetails}
                                className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                                title="View Meeting Details & Files"
                            >
                                <FileText className="w-4 h-4 text-blue-500" />
                                <span>Materials</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
