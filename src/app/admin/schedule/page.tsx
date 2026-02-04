'use client';

import React, { useState, useEffect } from 'react';
import { VolunteerNav } from '@/components/Admin/VolunteerNav';
import { ServiceScheduler } from '@/components/Admin/ServiceScheduler';
import { PulpitSession } from '@/types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SchedulePage() {
    const { userData } = useAuth();
    const churchId = userData?.churchId;
    const [sessions, setSessions] = useState<PulpitSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<PulpitSession | null>(null);

    useEffect(() => {
        const fetchSessions = async () => {
            if (!churchId) return;
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

                const snapshot = await getDocs(q);
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
    }, [churchId]);

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <VolunteerNav />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar: Session List */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900">Services</h2>
                            <Link href="/admin/pastor-care">
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700">
                                    + New
                                </Button>
                            </Link>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                            {loading ? (
                                <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                            ) : sessions.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    No services found.
                                </div>
                            ) : (
                                sessions.map(session => {
                                    const date = new Date(session.date.seconds * 1000);
                                    const isSelected = selectedSession?.id === session.id;
                                    const isPast = date < new Date();

                                    return (
                                        <button
                                            key={session.id}
                                            onClick={() => setSelectedSession(session)}
                                            className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex flex-col gap-1 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                                        >
                                            <span className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                                {session.sermonTitle || 'Untitled Service'}
                                            </span>
                                            <div className="flex items-center text-xs text-gray-500">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {date.toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center text-xs text-gray-400">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                            <div className="bg-white rounded-xl shadow-sm h-64 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                            </div>
                        ) : selectedSession ? (
                            <ServiceScheduler session={selectedSession} />
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                                <Calendar className="w-16 h-16 text-gray-200 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900">No Service Selected</h3>
                                <p className="text-gray-500 max-w-sm mt-2">
                                    Select a service from the list to manage its volunteer schedule.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
