'use client';

import React, { useEffect, useState } from 'react';
import { PersonActivity } from '@/types';
import { subscribeToPersonActivities } from '@/lib/crm';
import { Clock, Tag, User, Bell, FileText, Workflow, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityTimelineProps {
    personId: string;
    personType: 'visitor' | 'member';
    maxItems?: number;
}

const ACTIVITY_ICONS = {
    status_change: CheckCircle,
    tag_added: Tag,
    tag_removed: XCircle,
    note_added: FileText,
    contacted: Bell,
    form_submitted: FileText,
    workflow_enrolled: Workflow,
    custom: Clock
};

const ACTIVITY_COLORS = {
    status_change: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
    tag_added: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
    tag_removed: 'text-red-500 bg-red-50 dark:bg-red-900/20',
    note_added: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20',
    contacted: 'text-green-500 bg-green-50 dark:bg-green-900/20',
    form_submitted: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    workflow_enrolled: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
    custom: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20'
};

export default function ActivityTimeline({ personId, personType, maxItems }: ActivityTimelineProps) {
    const [activities, setActivities] = useState<PersonActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToPersonActivities(personId, (data) => {
            setActivities(maxItems ? data.slice(0, maxItems) : data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [personId, maxItems]);

    if (loading) {
        return (
            <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {activities.map((activity, index) => {
                const Icon = ACTIVITY_ICONS[activity.activityType] || Clock;
                const colorClass = ACTIVITY_COLORS[activity.activityType] || ACTIVITY_COLORS.custom;
                const timestamp = activity.createdAt?.toDate ? activity.createdAt.toDate() : new Date();

                return (
                    <div key={activity.id} className="flex gap-3 relative">
                        {/* Timeline line */}
                        {index < activities.length - 1 && (
                            <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-zinc-700"></div>
                        )}

                        {/* Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${colorClass} flex items-center justify-center z-10`}>
                            <Icon className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-white dark:bg-zinc-800 rounded-lg p-3 border border-gray-200 dark:border-zinc-700">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {activity.description}
                                    </p>
                                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                            {Object.entries(activity.metadata).map(([key, value]) => {
                                                if (key === 'tagName' || key === 'notes') return null;
                                                return (
                                                    <div key={key} className="flex gap-2">
                                                        <span className="font-medium">{key}:</span>
                                                        <span>{String(value)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {format(timestamp, 'MMM d, h:mm a')}
                                    </span>
                                    {activity.automated && (
                                        <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded">
                                            Auto
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
