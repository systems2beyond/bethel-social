import React from 'react';
import { Calendar, Clock, Video, Users, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Meeting } from '@/types';

interface MeetingCardProps {
    meeting: Meeting;
    onJoin?: (id: string) => void;
}

export function MeetingCard({ meeting, onJoin }: MeetingCardProps) {
    const startDate = new Date(meeting.startTime);

    const status = meeting.status || 'scheduled';
    const isLive = status === 'active';
    const isCompleted = status === 'completed';

    // Type-specific styling
    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'bible-study':
                return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
            case 'fellowship':
                return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
            case 'prayer':
                return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            default:
                return 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700';
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border", getTypeStyles(meeting.type))}>
                                {meeting.type.replace('-', ' ')}
                            </span>
                            {isLive && (
                                <span className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full animate-pulse">
                                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                                    LIVE
                                </span>
                            )}
                            {meeting.participants && meeting.participants.length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                                    <Users className="w-3 h-3" />
                                    {meeting.participants.length}
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {meeting.topic}
                        </h3>
                    </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{startDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>
                            {startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                            <span className="mx-1.5 opacity-50">•</span>
                            {meeting.durationMinutes} mins
                        </span>
                    </div>
                    {meeting.description && (
                        <p className="mt-2 text-gray-500 line-clamp-2 leading-relaxed">
                            {meeting.description}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onJoin?.(meeting.id)}
                        disabled={isCompleted}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-lg transition-all shadow-sm",
                            isLive
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 group-hover:shadow-blue-500/30"
                                : isCompleted
                                    ? "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                    : "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
                        )}
                    >
                        <Video className="w-4 h-4" />
                        {isLive ? 'Join Meeting' : isCompleted ? 'Ended' : 'View Details'}
                    </button>
                    {/* Add to Calendar button could go here */}
                </div>
            </div>
        </div>
    );
}
