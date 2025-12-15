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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const now = Timestamp.now();

                // 1. Fetch Events
                const eventsQuery = query(
                    collection(db, 'events'),
                    where('date', '>=', now),
                    orderBy('date', 'asc')
                );
                const eventsSnapshot = await getDocs(eventsQuery);
                const eventsData = eventsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _source: 'event'
                }));
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

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
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
        // Events source - keyword matching
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
        const dateA = a._source === 'event' ? a.date.seconds * 1000 : a.startTime;
        const dateB = b._source === 'event' ? b.date.seconds * 1000 : b.startTime;
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
        </div>
    );
}
