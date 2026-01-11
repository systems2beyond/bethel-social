'use client';

import React, { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';
import { EventsService } from '@/lib/services/EventsService';
import { Loader2, Ticket, Calendar, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function TicketEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Use the shared service which filters for valid manual events (with startDate)
                // Passing true to include drafts so admins can design tickets before publishing
                const eventsData = await EventsService.getAllEvents(true);
                setEvents(eventsData);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-8">
            <header className="mb-8">
                <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-2 inline-block">← Back to Dashboard</Link>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ticket Management</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Select an event to design and manage its tickets.</p>
            </header>

            <div className="grid gap-4">
                {events.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Events Found</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Create an event first to start managing tickets.</p>
                        <Link href="/admin/events" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Go to Events
                        </Link>
                    </div>
                ) : (
                    events.map((event) => (
                        <Link
                            key={event.id}
                            href={`/admin/tickets/${event.id}`}
                            className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all group flex items-center justify-between"
                        >
                            <div className="flex items-center space-x-6">
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Ticket className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {event.title}
                                    </h3>
                                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1 space-x-4">
                                        <span className="flex items-center">
                                            <Calendar className="w-3 h-3 mr-1" />
                                            {event.startDate?.toDate ? format(event.startDate.toDate(), 'MMM d, yyyy') : 'Date TBA'}
                                        </span>
                                        {event.location && (
                                            <span>📍 {event.location}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
