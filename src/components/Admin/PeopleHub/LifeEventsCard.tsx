'use client';

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Heart,
    Baby,
    Briefcase,
    GraduationCap,
    Home,
    AlertCircle,
    ArrowRight,
    Plus,
    Users,
    Calendar,
    ChevronRight,
    Loader2
} from "lucide-react";
import { LifeEvent } from "@/types";
import Link from 'next/link';

interface LifeEventsCardProps {
    events: LifeEvent[];
    loading?: boolean;
    onSelectEvent?: (event: LifeEvent) => void;
}

const getEventIcon = (type: string) => {
    switch (type) {
        case 'hospitalized':
        case 'surgery':
        case 'serious_illness':
            return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' };
        case 'baby_born':
        case 'pregnancy_announced':
            return { icon: Baby, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10' };
        case 'wedding':
        case 'engagement':
            return { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' };
        case 'job_loss':
        case 'new_job':
        case 'retirement':
            return { icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' };
        case 'graduation':
            return { icon: GraduationCap, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' };
        case 'moved':
            return { icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' };
        default:
            return { icon: Heart, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10' };
    }
};

const formatEventType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const LifeEventsCard: React.FC<LifeEventsCardProps & { className?: string }> = ({ events, loading, className, onSelectEvent }) => {
    const urgentEvents = events.filter(e => e.priority === 'urgent' || e.priority === 'high');
    const displayEvents = urgentEvents.length > 0 ? urgentEvents.slice(0, 4) : events.slice(0, 4);

    return (
        <div className={cn(
            "bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden",
            className
        )}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
                            <Heart className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                Pastoral Care
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                {events.length > 0
                                    ? `${events.length} active ${events.length === 1 ? 'need' : 'needs'}`
                                    : 'Member life events'
                                }
                            </p>
                        </div>
                    </div>
                    {urgentEvents.length > 0 && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0 font-semibold">
                            {urgentEvents.length} Urgent
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                ) : displayEvents.length === 0 ? (
                    /* Empty State - Professional & Actionable */
                    <div className="py-8 px-4">
                        <div className="text-center">
                            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center mb-4 border border-gray-200 dark:border-zinc-700">
                                <Users className="w-7 h-7 text-gray-400 dark:text-zinc-500" />
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                No Active Needs
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-5 max-w-[200px] mx-auto">
                                Track member life events like hospitalizations, births, and milestones
                            </p>
                            <Link
                                href="/admin/people-hub/life-events"
                                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Life Event
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Events List */
                    <div className="space-y-2">
                        {displayEvents.map((event) => {
                            const { icon: EventIcon, color, bg } = getEventIcon(event.eventType);
                            const eventDate = event.eventDate?.seconds
                                ? new Date(event.eventDate.seconds * 1000)
                                : new Date();

                            return onSelectEvent ? (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => onSelectEvent(event)}
                                        className={cn(
                                            "group flex items-center gap-3 p-3 rounded-xl w-full text-left",
                                            "hover:bg-gray-50 dark:hover:bg-zinc-800/50",
                                            "transition-all duration-150 cursor-pointer"
                                        )}
                                    >
                                        <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", bg)}>
                                            <EventIcon className={cn("w-5 h-5", color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{event.memberName}</p>
                                                {(event.priority === 'urgent' || event.priority === 'high') && (
                                                    <span className={cn("flex-shrink-0 w-2 h-2 rounded-full", event.priority === 'urgent' ? 'bg-red-500' : 'bg-orange-500')} />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">{formatEventType(event.eventType)}</span>
                                                <span className="text-gray-300 dark:text-zinc-600">•</span>
                                                <span className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-zinc-600 group-hover:text-gray-400 dark:group-hover:text-zinc-500 transition-colors" />
                                    </button>
                                ) : (
                                    <Link
                                        key={event.id}
                                        href="/admin/people-hub/life-events"
                                        className={cn(
                                            "group flex items-center gap-3 p-3 rounded-xl",
                                            "hover:bg-gray-50 dark:hover:bg-zinc-800/50",
                                            "transition-all duration-150 cursor-pointer"
                                        )}
                                    >
                                        <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", bg)}>
                                            <EventIcon className={cn("w-5 h-5", color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{event.memberName}</p>
                                                {(event.priority === 'urgent' || event.priority === 'high') && (
                                                    <span className={cn("flex-shrink-0 w-2 h-2 rounded-full", event.priority === 'urgent' ? 'bg-red-500' : 'bg-orange-500')} />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">{formatEventType(event.eventType)}</span>
                                                <span className="text-gray-300 dark:text-zinc-600">•</span>
                                                <span className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-zinc-600 group-hover:text-gray-400 dark:group-hover:text-zinc-500 transition-colors" />
                                    </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer - View All */}
            {(events.length > 0 || !loading) && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                    <Link
                        href="/admin/people-hub/life-events"
                        className="flex items-center justify-center gap-2 w-full py-2 text-sm font-semibold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                    >
                        {events.length > 0 ? (
                            <>View All {events.length} Events</>
                        ) : (
                            <>Manage Life Events</>
                        )}
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}
        </div>
    );
};
