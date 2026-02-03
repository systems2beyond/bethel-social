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
        const interval = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            // Calculate elapsed time if session is live
            if (session.status === 'live' && session.date) {
                const startTime = session.date.seconds ? new Date(session.date.seconds * 1000) : new Date(session.date);
                const diff = Math.max(0, now.getTime() - startTime.getTime());

                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                setElapsedTime(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [session]);

    return (
        <div className="relative">
            {/* Subtle top border gradient */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

            <div className="flex items-center justify-between bg-gradient-to-b from-zinc-900 to-zinc-950 px-8 py-5">
                {/* Left: Current Time */}
                <div className="flex items-center gap-6">
                    <div className="flex items-baseline">
                        <span className="text-5xl font-light text-white font-mono tabular-nums tracking-tight">
                            {format(currentTime, 'h:mm')}
                        </span>
                        <span className="text-lg text-zinc-400 ml-2 font-medium">
                            {format(currentTime, 'a').toUpperCase()}
                        </span>
                    </div>
                    <div className="h-8 w-px bg-zinc-800" />
                    <div className="text-zinc-400 text-sm font-medium tracking-wide">
                        {format(currentTime, 'EEEE, MMMM d')}
                    </div>
                </div>

                {/* Right: Timer & Status */}
                <div className="flex items-center gap-8">
                    {/* Service Timer */}
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-semibold mb-1">
                                Service Timer
                            </span>
                            <span
                                className={`text-3xl font-mono tabular-nums font-medium tracking-tight ${
                                    session.status === 'live' ? 'text-emerald-400' : 'text-zinc-600'
                                }`}
                            >
                                {elapsedTime}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-12 w-px bg-zinc-800" />

                    {/* Send Alert Button */}
                    <button
                        onClick={() => setShowAlertComposer(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 hover:text-orange-300 border border-orange-500/40 transition-all font-medium text-sm"
                        title="Send Urgent Alert"
                    >
                        <AlertTriangle size={18} />
                        <span className="uppercase tracking-wider text-xs font-bold">Send Alert</span>
                    </button>

                    {/* Divider */}
                    <div className="h-12 w-px bg-zinc-800" />

                    {/* ON/OFF AIR Status */}
                    <div
                        className={`
                            relative flex items-center gap-3 px-5 py-2.5 rounded-lg font-bold uppercase tracking-[0.15em] text-sm
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
                                className={`w-2.5 h-2.5 rounded-full ${
                                    session.status === 'live' ? 'bg-red-500' : 'bg-zinc-600'
                                }`}
                            />
                            {session.status === 'live' && (
                                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping opacity-75" />
                            )}
                        </div>
                        {session.status === 'live' ? 'On Air' : 'Off Air'}
                    </div>

                    {/* Exit Button */}
                    <button
                        onClick={() => router.push('/admin')}
                        className="p-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-all"
                        title="Exit Pulpit View"
                    >
                        <X size={20} />
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
