'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar, MapPin, Edit, Ticket, Loader2 } from 'lucide-react';
import { EventsService } from '@/lib/services/EventsService';
import { Event } from '@/types';
import { useRouter } from 'next/navigation';

export default function EventsListPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            setError(null);
            const data = await EventsService.getAllEvents(true); // Include drafts
            setEvents(data);
        } catch (error: any) {
            console.error('Failed to load events', error);
            if (error?.code === 'unavailable' || error?.message?.includes('network') || error?.message?.includes('block')) {
                setError('Failed to load events. Please check your internet connection or disable ad-blockers.');
            } else {
                setError('Failed to load events. Please try again later.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Event Management</h1>
                    <p className="text-gray-500 dark:text-gray-400">Create and manage church events and tickets.</p>
                </div>
                <Link
                    href="/admin/events/new"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Create Event
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            {loading ? (
                <div className="flex h-96 items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                        >
                            {/* Card Content... */}
                            {event.media?.[0]?.url && (
                                <div className="h-48 w-full bg-gray-100 dark:bg-gray-900 relative">
                                    <img
                                        src={event.media[0].url}
                                        alt={event.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-2 right-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${event.status === 'published' ? 'bg-green-100 text-green-700' :
                                            event.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {event.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="p-5">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{event.title}</h3>

                                <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-300">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{event.startDate?.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        <span>{event.location || 'No location set'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <Link
                                        href={`/admin/events/${event.id}`}
                                        className="flex-1 flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </Link>
                                    <Link
                                        href={`/admin/tickets/${event.id}`}
                                        className="flex-1 flex items-center justify-center gap-2 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30 text-pink-600 dark:text-pink-400 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Ticket className="w-4 h-4" />
                                        Tickets
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}

                    {events.length === 0 && !error && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <Calendar className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No events yet</h3>
                            <p className="text-gray-500 mb-6">Create your first event to get started.</p>
                            <Link
                                href="/admin/events/new"
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                            >
                                Create Event
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
