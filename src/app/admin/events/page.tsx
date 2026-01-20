'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar, MapPin, Edit, Ticket, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import { EventsService } from '@/lib/services/EventsService';
import { Event } from '@/types';
import { useRouter } from 'next/navigation';

import SuggestedEventsList from '@/components/Admin/Events/SuggestedEventsList';

export default function EventsListPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'active' | 'past' | 'suggestions'>('active');
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

    const handleDelete = async (e: React.MouseEvent, eventId: string) => {
        e.preventDefault(); // Prevent link navigation
        if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            return;
        }

        try {
            await EventsService.deleteEvent(eventId);
            setEvents(prev => prev.filter(ev => ev.id !== eventId));
        } catch (error) {
            console.error('Failed to delete event', error);
            alert('Failed to delete event. Please try again.');
        }
    };

    // Filter events based on view
    const displayedEvents = events.filter(event => {
        if (view === 'suggestions') return false; // Handled separately

        const now = new Date();
        // Reset time to start of day for comparison if you want strict "today" logic, 
        // but typically "now" is fine.

        // Helper to get effective end date
        const endDate = event.endDate?.toDate ? event.endDate.toDate() :
            (event.startDate?.toDate ? event.startDate.toDate() : null);

        if (!endDate) return view === 'active'; // Keep timeless drafts in active

        if (view === 'active') {
            return endDate >= now; // Future or ongoing
        } else {
            return endDate < now; // Past
        }
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center">
                <div>
                    <Link href="/admin" className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-4 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 -ml-3">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Event Management</h1>
                    <p className="text-gray-500 dark:text-gray-400">Create and manage church events and tickets.</p>
                </div>
                <div className="flex gap-4">
                    {/* Tab Switcher */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setView('active')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'active'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setView('past')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'past'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            Past
                        </button>
                        <button
                            onClick={() => setView('suggestions')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${view === 'suggestions'
                                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400'
                                }`}
                        >
                            Suggestions
                        </button>
                    </div>

                    <Link
                        href="/admin/events/new"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Create Event
                    </Link>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            {view === 'suggestions' ? (
                <SuggestedEventsList />
            ) : loading ? (
                <div className="flex h-96 items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedEvents.map((event) => (
                        <div
                            key={event.id}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                        >
                            {/* Card Content... */}
                            {event.media?.[0]?.url ? (
                                <div className="h-48 w-full bg-gray-100 dark:bg-gray-900 relative">
                                    <img
                                        src={event.media[0].url}
                                        alt={event.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold shadow-sm ${event.status === 'published' ? 'bg-green-100 text-green-700' :
                                            event.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {(event.status || 'draft').toUpperCase()}
                                        </span>
                                        {event.registrationConfig?.enabled ? (
                                            (event.registrationConfig.ticketPrice || 0) > 0 ? (
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 shadow-sm flex items-center gap-1">
                                                    <Ticket className="w-3 h-3" /> Ticketed
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 shadow-sm flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> RSVP
                                                </span>
                                            )
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 shadow-sm">
                                                Standard
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : event.imageUrl && (
                                <div className="h-48 w-full bg-gray-100 dark:bg-gray-900 relative">
                                    <img
                                        src={event.imageUrl}
                                        alt={event.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold shadow-sm ${event.status === 'published' ? 'bg-green-100 text-green-700' :
                                            event.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {(event.status || 'draft').toUpperCase()}
                                        </span>
                                        {event.registrationConfig?.enabled ? (
                                            (event.registrationConfig.ticketPrice || 0) > 0 ? (
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 shadow-sm flex items-center gap-1">
                                                    <Ticket className="w-3 h-3" /> Ticketed
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 shadow-sm flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> RSVP
                                                </span>
                                            )
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 shadow-sm">
                                                Standard
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                            }


                            <div className="p-5">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{event.title}</h3>

                                <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-300">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>{event.startDate?.toDate ? event.startDate.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Date TBD'}</span>
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
                                        href={`/admin/events/${event.id}/registrations`}
                                        className="flex-1 flex items-center justify-center gap-2 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30 text-pink-600 dark:text-pink-400 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        {/* Use BarChart3 equivalent or keep Ticket if preferred, but user asked for "Analytics" */}
                                        <Ticket className="w-4 h-4" />
                                        Analytics
                                    </Link>
                                    <button
                                        onClick={(e) => handleDelete(e, event.id)}
                                        className="p-2 flex items-center justify-center bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                        title="Delete Event"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {displayedEvents.length === 0 && !error && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <Calendar className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No {view} events found</h3>
                            <p className="text-gray-500 mb-6">
                                {view === 'active' ? 'Create a new event to get started.' : 'Past events will appear here.'}
                            </p>
                            {view === 'active' && (
                                <Link
                                    href="/admin/events/new"
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                                >
                                    Create Event
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
