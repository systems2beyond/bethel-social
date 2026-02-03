'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { Group, GroupEvent } from '@/types'; // You'll need to export GroupEvent
import { GroupsService } from '@/lib/groups';
import { EventCard } from '@/components/Events/EventCard';
import { CreateEventModal } from './CreateEventModal';
import { useAuth } from '@/context/AuthContext';

interface GroupEventsTabProps {
    group: Group;
    isAdmin: boolean;
}

export const GroupEventsTab: React.FC<GroupEventsTabProps> = ({ group, isAdmin }) => {
    const [events, setEvents] = useState<GroupEvent[]>([]); // Use GroupEvent type!
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const { user } = useAuth();

    const fetchEvents = async () => {
        try {
            const data = await GroupsService.getGroupEvents(group.id);
            // Cast to GroupEvent[] - ensure types match or transform if needed
            setEvents(data as any[]);
        } catch (error) {
            console.error("Failed to fetch group events:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [group.id]);

    return (
        <div className="space-y-6">

            {/* Header / Actions */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-indigo-500" />
                    Upcoming Events
                </h3>
                {isAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md shadow-indigo-500/20 active:translate-y-0.5 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Create Event
                    </button>
                )}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : events.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-700">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        No events yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                        There are no upcoming events scheduled for this group.
                    </p>
                    {isAdmin && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="text-indigo-600 font-medium hover:underline"
                        >
                            Create the first event
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-6">
                    {events.map((event) => (
                        // Reusing EventCard - might need adapter if types slightly mismatch
                        // Assuming EventCard takes an 'Event' type that is compatible or we map it.
                        // For now, let's assume we map GroupEvent to Event for the card
                        <EventCard
                            key={event.id}
                            event={{
                                ...event,
                                // Adapter logic to satisfy Event interface if strictly typed differently
                                date: event.startDate, // Ensure date format matches (Timestamp vs map)
                                sourcePostId: '', // Dummy if needed
                                extractedData: {
                                    time: event.startDate.toDate ? event.startDate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                                }
                            } as any}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            <CreateEventModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                groupId={group.id}
                onEventCreated={fetchEvents}
            />
        </div>
    );
};
