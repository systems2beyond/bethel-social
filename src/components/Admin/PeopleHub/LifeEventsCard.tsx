
// Force update
import React from 'react';
import { Button } from "@/components/ui/button";
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
    Sparkles
} from "lucide-react";
import { LifeEvent } from "@/types";
import Link from 'next/link';

interface LifeEventsCardProps {
    events: LifeEvent[];
    loading?: boolean;
}

const getEventIcon = (type: string) => {
    switch (type) {
        case 'hospitalized':
        case 'surgery':
        case 'serious_illness':
            return { icon: AlertCircle, color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
        case 'baby_born':
        case 'pregnancy_announced':
            return { icon: Baby, color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' };
        case 'wedding':
        case 'engagement':
            return { icon: Heart, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' };
        case 'job_loss':
        case 'new_job':
        case 'retirement':
            return { icon: Briefcase, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' };
        case 'graduation':
            return { icon: GraduationCap, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' };
        case 'moved':
            return { icon: Home, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' };
        default:
            return { icon: Heart, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
    }
};

const formatEventType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const LifeEventsCard: React.FC<LifeEventsCardProps & { className?: string }> = ({ events, loading, className }) => {
    const urgentEvents = events.filter(e => e.priority === 'urgent' || e.priority === 'high');
    const displayEvents = urgentEvents.length > 0 ? urgentEvents : events.slice(0, 5);

    return (
        <div className={cn(
            "rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col",
            className
        )}>
            {/* Header with gradient accent */}
            <div className="relative px-6 py-5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex-shrink-0">
                <div className="relative flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            Pastoral Needs
                            {urgentEvents.length > 0 && (
                                <Badge className="ml-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
                                    {urgentEvents.length} Urgent
                                </Badge>
                            )}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Recent life events requiring attention
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-bold rounded-xl h-9">
                        <Link href="/admin/people-hub/life-events">
                            View All <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1">
                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <div className="animate-pulse space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-lg" />
                                ))}
                            </div>
                        </div>
                    ) : displayEvents.length === 0 ? (
                        <div className="text-center py-10 px-4 h-full flex flex-col items-center justify-center">
                            <div className="inline-flex p-4 rounded-full bg-purple-50 dark:bg-purple-900/20 mb-4">
                                <Heart className="h-8 w-8 text-purple-400" />
                            </div>
                            <p className="text-muted-foreground font-medium">No active life events</p>
                            <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
                        </div>
                    ) : (
                        displayEvents.map((event) => {
                            const { icon: EventIcon, color } = getEventIcon(event.eventType);
                            return (
                                <div
                                    key={event.id}
                                    className={cn(
                                        "group flex items-start gap-4 p-4 rounded-xl",
                                        "bg-gray-50 dark:bg-zinc-800/50",
                                        "hover:bg-gray-100 dark:hover:bg-zinc-800",
                                        "transition-all duration-200 cursor-pointer"
                                    )}
                                >
                                    {/* Icon */}
                                    <div className={cn(
                                        "flex-shrink-0 p-2.5 rounded-xl",
                                        color
                                    )}>
                                        <EventIcon className="h-4 w-4" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {event.memberName}
                                            </p>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                {new Date(event.eventDate.seconds * 1000).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-rose-500 dark:text-rose-400 mb-1 uppercase tracking-wider">
                                            {formatEventType(event.eventType)}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                            {event.description}
                                        </p>
                                        {event.assignedTo && (
                                            <Badge variant="outline" className="mt-2 text-[10px] h-5 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                                                Assigned: {event.assignedTo}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
