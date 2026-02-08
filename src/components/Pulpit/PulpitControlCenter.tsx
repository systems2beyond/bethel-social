'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PulpitSession } from '@/types';
import { format } from 'date-fns';
import { X, AlertTriangle } from 'lucide-react';
import AlertComposer from './AlertComposer';

interface PulpitControlCenterProps {
    session: PulpitSession;
}

export default function PulpitControlCenter({ session }: PulpitControlCenterProps) {
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [showAlertComposer, setShowAlertComposer] = useState(false);

    useEffect(() => {
        if (session?.status !== 'live') {
            setElapsedTime('00:00:00');
            return;
        }

        // Helper to parse various timestamp formats (same as alerts popout)
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

        const updateTimer = () => {
            const now = new Date();
            setCurrentTime(now);
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

    return (
        <div className="relative">
            {/* Subtle top border gradient */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

            <div className="flex items-center justify-between bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5">
                {/* Left: Current Time */}
                <div className="flex items-center gap-3 md:gap-4 lg:gap-6">
                    <div className="flex items-baseline">
                        <span className="text-2xl md:text-4xl lg:text-5xl font-light text-white font-mono tabular-nums tracking-tight">
                            {format(currentTime, 'h:mm')}
                        </span>
                        <span className="text-sm md:text-base lg:text-lg text-zinc-400 ml-1 md:ml-2 font-medium">
                            {format(currentTime, 'a').toUpperCase()}
                        </span>
                    </div>
                    <div className="h-6 md:h-8 w-px bg-zinc-800 hidden sm:block" />
                    <div className="text-zinc-400 text-xs md:text-sm font-medium tracking-wide hidden sm:block">
                        {format(currentTime, 'EEEE, MMMM d')}
                    </div>
                </div>

                {/* Right: Timer & Status */}
                <div className="flex items-center gap-3 md:gap-5 lg:gap-8">
                    {/* Service Timer */}
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] md:text-[10px] text-zinc-500 uppercase tracking-[0.15em] md:tracking-[0.2em] font-semibold mb-0.5 md:mb-1">
                                <span className="hidden sm:inline">Service </span>Timer
                            </span>
                            <span
                                className={`text-xl md:text-2xl lg:text-3xl font-mono tabular-nums font-medium tracking-tight ${session.status === 'live' ? 'text-emerald-400' : 'text-zinc-600'
                                    }`}
                            >
                                {elapsedTime}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-8 md:h-10 lg:h-12 w-px bg-zinc-800" />

                    {/* Send Alert Button */}
                    <button
                        onClick={() => setShowAlertComposer(true)}
                        className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-3 md:py-2 lg:px-4 lg:py-2.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 hover:text-orange-300 border border-orange-500/40 transition-all font-medium text-sm"
                        title="Send Urgent Alert"
                    >
                        <AlertTriangle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                        <span className="uppercase tracking-wider text-[10px] md:text-xs font-bold">Alert</span>
                    </button>

                    {/* Divider */}
                    <div className="h-8 md:h-10 lg:h-12 w-px bg-zinc-800" />

                    {/* ON/OFF AIR Status */}
                    <div
                        className={`
                            relative flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 lg:px-5 lg:py-2.5 rounded-lg font-bold uppercase tracking-[0.1em] md:tracking-[0.15em] text-xs md:text-sm
                            transition-all duration-300
                            ${session.status === 'live'
                                ? 'bg-red-600/20 text-red-400 border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                                : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50'
                            }
                        `}
                    >
                        {/* Pulsing dot for live */}
                        <div className="relative">
                            <div
                                className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${session.status === 'live' ? 'bg-red-500' : 'bg-zinc-600'
                                    }`}
                            />
                            {session.status === 'live' && (
                                <div className="absolute inset-0 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-red-500 animate-ping opacity-75" />
                            )}
                        </div>
                        <span className="hidden sm:inline">{session.status === 'live' ? 'On Air' : 'Off Air'}</span>
                        <span className="sm:hidden">{session.status === 'live' ? 'Live' : 'Off'}</span>
                    </div>

                    {/* Exit Button */}
                    <button
                        onClick={() => router.push('/admin')}
                        className="p-1.5 md:p-2 lg:p-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-all"
                        title="Exit Pulpit View"
                    >
                        <X className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
            </div>

            {/* Alert Composer Modal */}
            {showAlertComposer && (
                <AlertComposer
                    sessionId={session.id}
                    churchId={session.churchId}
                    onClose={() => setShowAlertComposer(false)}
                />
            )}
        </div>
    );
}
