'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EventCard } from '@/components/Events/EventCard';
import { MeetingCard } from '@/components/Meeting/MeetingCard';
import { CalendarX, Loader2 } from 'lucide-react';

export default function EventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [meetings, setMeetings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [debugLog, setDebugLog] = useState<string[]>([]); // Temporary Debug Log

    useEffect(() => {
        const fetchData = async () => {
            const logs: string[] = []; // Collect logs
            try {
                const now = Timestamp.now();
                logs.push(`Fetch Start: ${new Date().toISOString()}`);

                // 1. Fetch Events - REMOVED orderBy to ensure we get mixed types (Strings & Timestamps)
                // 1. Fetch Events
                // Query all events and filter client-side to handle potential data type mismatches (Strings vs Timestamps)
                const eventsQuery = query(collection(db, 'events'));
                logs.push('Querying events collection (no filter/sort)...');
                const eventsSnapshot = await getDocs(eventsQuery);
                logs.push(`Snapshot size: ${eventsSnapshot.size}`);
                const eventsData = eventsSnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        // Hydrate dates
                        const fixDate = (val: any) => {
                            if (!val) return null;
                            if (val.toDate && typeof val.toDate === 'function') return val; // Already Timestamp
                            if (typeof val === 'object' && typeof val.seconds === 'number') {
                                return new Timestamp(val.seconds, val.nanoseconds || 0); // Reconstruct from object
                            }
                            if (typeof val === 'string') {
                                try { return Timestamp.fromDate(new Date(val)); } catch (e) { return null; }
                            }
                            return null;
                        };

                        let startDate = fixDate(data.startDate || data.date);
                        let endDate = fixDate(data.endDate);

                        return {
                            id: doc.id,
                            ...data,
                            startDate,
                            endDate,
                            _source: 'event'
                        };
                    })
                    // Client-side filter: Only show future events
                    .filter(event => {
                        if (!event.startDate) {
                            // DEEP DEBUG: Log keys to see what's actually there
                            logs.push(`Skipping ${event.id}: No startDate. Keys: ${Object.keys(event).join(', ')}`);
                            return false;
                        }
                        const isFuture = event.startDate.toMillis() >= now.toMillis();
                        const isPublished = event.status === 'published';

                        if (!isFuture) logs.push(`Skipping ${event.id}: Past event (${event.startDate.toDate().toLocaleDateString()})`);
                        if (!isPublished) logs.push(`Skipping ${event.id}: Not published (${event.status})`);

                        return isFuture && isPublished;
                    });

                logs.push(`Events after filter: ${eventsData.length}`);
                setEvents(eventsData);

                // 2. Fetch Meetings (Need to be careful with query indexes, might need to fetch all and filter client side if index missing)
                // Assuming 'startTime' is number (unix) not Timestamp based on type def, BUT Firestore usually uses Timestamps. 
                // Let's check Meeting type again. It says `startTime: number`.
                // If it's number, we compare with Date.now().

                const meetingsQuery = query(
                    collection(db, 'meetings'),
                    where('startTime', '>=', Date.now()),
                    orderBy('startTime', 'asc')
                );

                const meetingsSnapshot = await getDocs(meetingsQuery);
                const meetingsData = meetingsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _source: 'meeting'
                }));
                setMeetings(meetingsData);

            } catch (error: any) {
                console.error('Error fetching data:', error);
                logs.push(`ERROR: ${error.message}`);
            } finally {
                setLoading(false);
                setDebugLog(logs);
            }
        };

        fetchData();
    }, []);

    // Categorization Helper
    const getCategory = (item: any) => {
        if (item._source === 'meeting') {
            if (item.type === 'bible-study') return 'Bible Study';
            return 'Meeting'; // Covers fellowship, prayer. Maybe separate Fellowship?
        }

        // Use explicit category if available
        if (item.category) return item.category;

        // Fallback (Legacy)
        const title = (item.title || '').toLowerCase();
        if (title.includes('bible study')) return 'Bible Study';
        if (title.includes('sunday school')) return 'Sunday School';
        if (title.includes('meeting')) return 'Meeting'; // Explicit meetings
        return 'General'; // Everything else
    };

    const categorized = {
        'General': [] as any[],
        'Meeting': [] as any[],
        'Bible Study': [] as any[],
        'Sunday School': [] as any[]
    };

    [...events, ...meetings].sort((a, b) => {
        const dateA = a._source === 'event' ? (a.startDate?.seconds * 1000 || 0) : a.startTime;
        const dateB = b._source === 'event' ? (b.startDate?.seconds * 1000 || 0) : b.startTime;
        return dateA - dateB;
    }).forEach(item => {
        const cat = getCategory(item);
        if (categorized[cat as keyof typeof categorized]) {
            categorized[cat as keyof typeof categorized].push(item);
        } else {
            categorized['General'].push(item);
        }
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const Section = ({ title, items }: { title: string, items: any[] }) => (
        <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                {title}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                    {items.length}
                </span>
            </h2>
            {items.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => (
                        item._source === 'event' ? (
                            <EventCard key={item.id} event={item} />
                        ) : (
                            <MeetingCard
                                key={item.id}
                                meeting={item}
                                onJoin={(id) => {
                                    window.open(`/meet/${id}`, '_blank');
                                }}
                            />
                        )
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
                    <CalendarX className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No upcoming events in this category.</p>
                </div>
            )}
        </section>
    );

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Church Calendar</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Gather with us for worship, study, and community.
                </p>
            </div>

            {/* General Events First */}
            {categorized['General'].length > 0 && <Section title="General Events" items={categorized['General']} />}

            <Section title="Meetings" items={categorized['Meeting']} />
            <Section title="Bible Study" items={categorized['Bible Study']} />
            <Section title="Sunday School" items={categorized['Sunday School']} />

            {/* ERROR DEBUGGING PANEL - To be removed after fix */}
            <div className="mt-12 p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg text-xs font-mono overflow-auto max-h-60 border border-red-500">
                <h3 className="font-bold text-red-500 mb-2">Debug Info (Take a screenshot if empty):</h3>
                {debugLog.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
                <div className="mt-2 text-blue-500">Total Events in State: {events.length}</div>
            </div>
        </div>
    );
}
