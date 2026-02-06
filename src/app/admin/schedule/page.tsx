'use client';

import React, { useState, useEffect } from 'react';
import { VolunteerNav } from '@/components/Admin/VolunteerNav';
import { ServiceScheduler } from '@/components/Admin/ServiceScheduler';
import { PulpitSession } from '@/types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Loader2, Calendar, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SchedulePage() {
    const { userData, loading: authLoading } = useAuth();
    const churchId = userData?.churchId;
    const [sessions, setSessions] = useState<PulpitSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<PulpitSession | null>(null);

    useEffect(() => {
        const fetchSessions = async () => {
            if (authLoading) return;
            if (!churchId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                // Fetch upcoming sessions (and recent ones for context)
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Start of today

                // Getting sessions from the last 7 days and future
                // Since firestore comparisons can be tricky with multiple fields, just order by createdAt desc and filter properly or use scheduledStartTime if available.
                // Assuming scheduledStartTime exists on PulpitSession, which it should.

                const q = query(
                    collection(db, 'pulpit_sessions'),
                    where('churchId', '==', churchId),
                    orderBy('date', 'desc'),
                    limit(20)
                );

                const timeoutId = setTimeout(() => {
                    setLoading(false);
                }, 5000);

                const snapshot = await getDocs(q);
                clearTimeout(timeoutId);
                const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PulpitSession));
                setSessions(fetched);

                if (fetched.length > 0) {
                    setSelectedSession(fetched[0]);
                }
            } catch (error) {
                console.error('Error loading sessions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSessions();
    }, [churchId, authLoading]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header - Copper Style */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                                        <Calendar className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">Service Schedule</h1>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-100 dark:border-emerald-800">
                                        {sessions.length} Services
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Coordinate volunteers for upcoming services
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                <VolunteerNav />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Sidebar: Session List */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Recent Services</h2>
                            <Link href="/admin/events">
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                                    All Services
                                </Button>
                            </Link>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden divide-y divide-gray-50 dark:divide-zinc-800/50 max-h-[700px] overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500/50" /></div>
                            ) : sessions.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Calendar className="w-8 h-8 text-gray-200 dark:text-zinc-800 mx-auto mb-2" />
                                    <p className="text-xs text-muted-foreground">No services found.</p>
                                </div>
                            ) : (
                                sessions.map(session => {
                                    const date = session.date?.seconds
                                        ? new Date(session.date.seconds * 1000)
                                        : new Date();
                                    const isSelected = selectedSession?.id === session.id;

                                    return (
                                        <button
                                            key={session.id}
                                            onClick={() => setSelectedSession(session)}
                                            className={cn(
                                                "w-full text-left p-4 transition-all duration-200 flex flex-col gap-1 relative",
                                                isSelected
                                                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                                                    : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                            )}
                                        >
                                            {isSelected && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
                                            )}
                                            <span className={cn(
                                                "font-bold text-sm leading-snug",
                                                isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'
                                            )}>
                                                {session.sermonTitle || 'Standard Service'}
                                            </span>
                                            <div className="flex items-center gap-3 mt-1">
                                                <div className="flex items-center text-[11px] text-muted-foreground">
                                                    <Calendar className="w-3 h-3 mr-1 opacity-70" />
                                                    {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </div>
                                                <div className="flex items-center text-[11px] text-muted-foreground">
                                                    <Clock className="w-3 h-3 mr-1 opacity-70" />
                                                    {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Main Content: Scheduler */}
                    <div className="md:col-span-3">
                        {loading ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 h-96 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/20" />
                            </div>
                        ) : selectedSession ? (
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-8 opacity-5">
                                        <Calendar className="w-32 h-32 text-emerald-500" />
                                    </div>
                                    <ServiceScheduler session={selectedSession} />
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-12 text-center flex flex-col items-center justify-center h-full min-h-[500px] shadow-sm">
                                <div className="p-6 rounded-full bg-gray-50 dark:bg-zinc-800/50 mb-6">
                                    <Calendar className="w-12 h-12 text-gray-200 dark:text-zinc-700" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">No Service Selected</h3>
                                <p className="text-muted-foreground max-w-sm mt-3 leading-relaxed">
                                    Select a service from the sidebar to manage its dynamic volunteer roles and confirm assignments.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
