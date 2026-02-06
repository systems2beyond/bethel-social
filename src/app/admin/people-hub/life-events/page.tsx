
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canAccessPeopleHub } from '@/lib/permissions';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LifeEventsCard } from '@/components/Admin/PeopleHub/LifeEventsCard';
import { LifeEventModal } from '@/components/Admin/PeopleHub/LifeEventModal';
import { LifeEvent } from "@/types";
import { PlusCircle, ArrowLeft, HeartHandshake, Loader2, CheckCircle } from "lucide-react";

export default function LifeEventsPage() {
    const { userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [events, setEvents] = useState<LifeEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (!userData || !canAccessPeopleHub(userData.role)) {
            return;
        }

        const lifeEventsRef = collection(db, 'lifeEvents');
        const unsubscribe = onSnapshot(lifeEventsRef, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as LifeEvent[];
            setEvents(eventsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching life events:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authLoading, userData]);

    const activeEvents = events.filter(e => e.isActive);
    const resolvedEvents = events.filter(e => !e.isActive);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500/20" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header - Copper Style */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin/people-hub"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 shadow-sm">
                                        <HeartHandshake className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">Life Events</h1>
                                    <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-100 dark:border-rose-800">
                                        {activeEvents.length} Active
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Nurturing our church family through every milestone
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm font-semibold"
                            >
                                <PlusCircle className="mr-2 h-4 w-4" /> Log New Event
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                <Tabs defaultValue="active" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <TabsList className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-1 rounded-xl shadow-sm">
                            <TabsTrigger
                                value="active"
                                className="rounded-lg data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 dark:data-[state=active]:bg-rose-900/20 dark:data-[state=active]:text-rose-400 px-6 py-2"
                            >
                                Active Needs
                            </TabsTrigger>
                            <TabsTrigger
                                value="resolved"
                                className="rounded-lg px-6 py-2"
                            >
                                Resolved
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="active" className="mt-0 outline-none">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <LifeEventsCard events={activeEvents} />
                        </div>
                    </TabsContent>

                    <TabsContent value="resolved" className="mt-0 outline-none">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                            {resolvedEvents.length > 0 ? (
                                <LifeEventsCard events={resolvedEvents} />
                            ) : (
                                <div className="p-20 text-center text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="p-4 rounded-full bg-gray-50 dark:bg-zinc-800/50">
                                        <CheckCircle className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="font-medium">No archived events recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <LifeEventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
}

