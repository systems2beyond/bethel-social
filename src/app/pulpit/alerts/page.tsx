'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { PulpitService } from '@/lib/services/PulpitService';
import AlertChat from '@/components/Pulpit/AlertChat';
import { PulpitSession } from '@/types';
import { Loader2, AlertTriangle, Radio, PlayCircle } from 'lucide-react';

export default function AlertsPopupPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const [session, setSession] = useState<PulpitSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState('00:00:00');

    // Timer effect - runs every second when live
    useEffect(() => {
        if (session?.status !== 'live') {
            setElapsedTime('00:00:00');
            return;
        }

        // Helper to parse various timestamp formats
        const parseTimestamp = (ts: unknown): Date | null => {
            if (!ts) return null;
            // Firestore Timestamp with toDate()
            if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
                return (ts as { toDate: () => Date }).toDate();
            }
            // Firestore Timestamp-like with seconds
            if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
                return new Date((ts as { seconds: number }).seconds * 1000);
            }
            // Already a Date
            if (ts instanceof Date) return ts;
            // String or number
            if (typeof ts === 'string' || typeof ts === 'number') {
                const d = new Date(ts);
                if (!isNaN(d.getTime())) return d;
            }
            return null;
        };

        const startTime = parseTimestamp(session.startedAt) || parseTimestamp(session.date);

        if (!startTime) {
            console.warn('[Timer] No valid start time found:', { startedAt: session.startedAt, date: session.date });
            setElapsedTime('--:--:--');
            return;
        }

        console.log('[Timer] Start time:', startTime.toISOString());

        const updateTimer = () => {
            const now = new Date();
            const diff = Math.max(0, now.getTime() - startTime.getTime());
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setElapsedTime(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateTimer(); // Initial update
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [session?.status, session?.startedAt, session?.date]);

    const handleStartSession = async () => {
        if (!session?.id) return;
        try {
            console.log('[Control Center] Starting session...', session.id);
            await PulpitService.startSession(session.id);
            console.log('[Control Center] Session started successfully!');
        } catch (err) {
            console.error('[Control Center] Error starting session:', err);
        }
    };

    const handleToggleOnAir = async () => {
        if (!session?.id) return;
        try {
            const newStatus = session.status === 'live' ? 'scheduled' : 'live';
            console.log('[Control Center] Toggling status to:', newStatus, 'for session:', session.id);
            await PulpitService.updateSessionStatus(session.id, newStatus);
            console.log('[Control Center] Status updated successfully!');
        } catch (err) {
            console.error('[Control Center] Error toggling status:', err);
        }
    };

    // Reset session status when window closes
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (session?.id && session?.status === 'live') {
                // Use beacon if possible (more reliable on unload) but Firestore SDK handles this reasonably well
                // Best effort to reset status
                PulpitService.updateSessionStatus(session.id, 'scheduled').catch(err => {
                    console.error('Failed to reset session status on unload:', err);
                });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Also trigger on unmount if we're still live (handling component unmount vs window close)
            if (session?.id && session?.status === 'live') {
                PulpitService.updateSessionStatus(session.id, 'scheduled').catch(err => {
                    console.error('Failed to reset session status on unmount:', err);
                });
            }
        };
    }, [session?.id, session?.status]);

    useEffect(() => {
        if (authLoading || !user || !userData?.churchId) return;

        // Check for admin access
        const adminRoles = ['admin', 'super_admin', 'pastor_admin', 'media_admin'];
        if (!adminRoles.includes(userData.role || '')) {
            setError('Access denied. Admin role required.');
            setLoading(false);
            return;
        }

        // Real-time subscription for active session
        const q = query(
            collection(db, 'pulpit_sessions'),
            where('churchId', '==', userData.churchId),
            where('status', 'in', ['live', 'scheduled']),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const sessionData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PulpitSession;
                console.log('[Control Center] Session update received:', {
                    id: sessionData.id,
                    status: sessionData.status,
                    startedAt: sessionData.startedAt,
                    date: sessionData.date
                });
                setSession(sessionData);
                setError(null);
            } else {
                setSession(null);
                setError('No active service session found.');
            }
            setLoading(false);
        }, (err) => {
            console.error('Subscription error:', err);
            setError('Failed to sync session data.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userData, authLoading]);

    // Loading state
    if (authLoading || loading) {
        return (
            <div className="h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="animate-spin text-zinc-500" size={24} />
            </div>
        );
    }

    // Error state
    if (error || !session) {
        return (
            <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="text-zinc-600 mb-4" size={32} />
                <p className="text-zinc-400 text-sm">{error || 'No active session'}</p>
                <button
                    onClick={() => window.close()}
                    className="mt-4 text-xs text-zinc-500 hover:text-zinc-300"
                >
                    Close Window
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen bg-zinc-950 flex flex-col">
            {/* Control Center Header */}
            <header className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="text-sm text-zinc-200 font-medium">Control Center</span>
                    <div className="ml-auto flex items-center gap-2">
                        {session.status === 'live' ? (
                            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                                <Radio size={12} className="animate-pulse" />
                                On Air
                            </span>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">Off Air</span>
                        )}
                    </div>
                </div>

                {/* Timer Display */}
                <div className={`text-center py-3 px-4 rounded-lg border ${session.status === 'live'
                    ? 'bg-red-950/30 border-red-900/50'
                    : 'bg-zinc-900/50 border-zinc-800'
                    }`}>
                    <div className={`font-mono text-3xl font-bold tracking-wider ${session.status === 'live' ? 'text-red-400' : 'text-zinc-600'
                        }`}>
                        {elapsedTime}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">
                        {session.status === 'live' ? 'Service Timer' : 'Timer Stopped'}
                    </div>
                </div>

                {/* Dashboard Controls */}
                <div className="flex items-center gap-3 p-2 bg-zinc-950/50 rounded-lg border border-zinc-800">
                    <button
                        onClick={handleStartSession}
                        disabled={session.status === 'live'}
                        className={`flex-1 py-1.5 px-3 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${session.status === 'live'
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                            }`}
                    >
                        <PlayCircle size={12} />
                        Start Timer
                    </button>

                    <div
                        onClick={handleToggleOnAir}
                        className="flex items-center gap-3 px-3 py-1.5 bg-zinc-900 rounded-md border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-all shrink-0"
                    >
                        <span className={`text-[10px] font-black uppercase tracking-widest ${session.status === 'live' ? 'text-red-500' : 'text-zinc-500'}`}>
                            {session.status === 'live' ? 'Live' : 'Off'}
                        </span>
                        <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${session.status === 'live' ? 'bg-red-600' : 'bg-zinc-700'}`}>
                            <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${session.status === 'live' ? 'translate-x-4.5' : 'translate-x-1'}`} />
                        </div>
                    </div>
                </div>
            </header>

            {/* Alert Chat */}
            <div className="flex-1 overflow-hidden">
                <AlertChat session={session} />
            </div>
        </div>
    );
}
