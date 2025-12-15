'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EventCard } from '@/components/Events/EventCard';
import { CalendarX, Loader2 } from 'lucide-react';

export default function EventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Fetch future events
                const now = Timestamp.now();
                const q = query(
                    collection(db, 'events'),
                    where('date', '>=', now),
                    orderBy('date', 'asc')
                );

                const snapshot = await getDocs(q);
                const eventsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setEvents(eventsData);
            } catch (error) {
                console.error('Error fetching events:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Upcoming Events</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Join us for worship, fellowship, and community service.
                </p>
            </div>

            {events.length > 0 ? (
                <div className="grid gap-6">
                    {events.map(event => (
                        <EventCard key={event.id} event={event} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                    <CalendarX className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">No upcoming events found</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Check back soon or look at our latest posts!</p>
                </div>
            )}
        </div>
    );
}
