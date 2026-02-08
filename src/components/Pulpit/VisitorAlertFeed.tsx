import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PulpitService } from '@/lib/services/PulpitService';
import { PulpitSession, PulpitAlert, PulpitCheckIn } from '@/types';
import { AlertTriangle, UserPlus, CheckCircle, Clock, Eye, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VisitorAlertFeedProps {
    session: PulpitSession;
}

export default function VisitorAlertFeed({ session }: VisitorAlertFeedProps) {
    const { user } = useAuth();
    const [alerts, setAlerts] = useState<PulpitAlert[]>([]);
    const [checkins, setCheckins] = useState<PulpitCheckIn[]>([]);

    // Track alerts that are pending resolution to prevent write loops
    const resolvingAlertIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        const unsubscribeAlerts = PulpitService.streamAlerts(session.churchId, (newAlerts) => {
            // Only show urgent type OR critical priority alerts on the Pulpit view
            const urgentAlerts = newAlerts.filter(
                alert => alert.type === 'urgent' || alert.priority === 'critical'
            );
            setAlerts(urgentAlerts);
        });

        const unsubscribeCheckins = PulpitService.streamCheckins(session.churchId, session.id, (newCheckins) => {
            setCheckins(newCheckins);
        });

        return () => {
            unsubscribeAlerts();
            unsubscribeCheckins();
        };
    }, [session.churchId, session.id]);

    useEffect(() => {
        // Auto-resolve acknowledged alerts after 2 minutes
        // Use ref to track which alerts are being resolved to prevent write loops
        const acknowledgedAlerts = alerts.filter(a => a.acknowledged && !a.resolved);
        const timers: NodeJS.Timeout[] = [];

        acknowledgedAlerts.forEach(alert => {
            // Skip if already resolving this alert
            if (resolvingAlertIds.current.has(alert.id)) return;

            const acknowledgedAt = alert.acknowledgedAt?.seconds
                ? new Date(alert.acknowledgedAt.seconds * 1000)
                : new Date();
            const timeSinceAck = Date.now() - acknowledgedAt.getTime();
            const twoMinutes = 2 * 60 * 1000;

            if (timeSinceAck >= twoMinutes) {
                // Mark as resolving before calling to prevent loop
                resolvingAlertIds.current.add(alert.id);
                PulpitService.resolveAlert(alert.id).catch(() => {
                    // Remove from set on error so it can be retried
                    resolvingAlertIds.current.delete(alert.id);
                });
            } else {
                const timer = setTimeout(() => {
                    if (!resolvingAlertIds.current.has(alert.id)) {
                        resolvingAlertIds.current.add(alert.id);
                        PulpitService.resolveAlert(alert.id).catch(() => {
                            resolvingAlertIds.current.delete(alert.id);
                        });
                    }
                }, twoMinutes - timeSinceAck);
                timers.push(timer);
            }
        });

        return () => timers.forEach(clearTimeout);
    }, [alerts]);

    const handleAcknowledgeAlert = async (alertId: string) => {
        if (!user) return;
        await PulpitService.acknowledgeAlert(alertId, user.uid);
    };

    const handleAcknowledgeCheckin = async (checkinId: string) => {
        if (!user) return;
        await PulpitService.acknowledgeCheckin(checkinId, user.uid);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
            {/* Urgent Alerts Section */}
            <div className="p-3 space-y-2">
                <h3 className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 px-1">
                    <AlertTriangle size={11} className="text-red-500" />
                    Urgent Alerts
                </h3>

                {alerts.length === 0 && (
                    <div className="text-zinc-600 text-[11px] italic py-2 text-center border border-dashed border-zinc-800 rounded opacity-50">
                        No active alerts
                    </div>
                )}

                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className={`p-2 rounded border-l-4 shadow-sm animate-in slide-in-from-right-4 duration-300 ${alert.priority === 'critical' ? 'bg-red-950/30 border-red-500/60 text-red-100' :
                            alert.priority === 'high' ? 'bg-orange-950/30 border-orange-500/60 text-orange-100' :
                                'bg-blue-950/30 border-blue-500/60 text-blue-100'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-0.5">
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-black/20 uppercase tracking-widest leading-none">
                                {alert.type}
                            </span>
                            <span className="text-[8px] opacity-40 leading-none">
                                {formatDistanceToNow(alert.createdAt?.seconds ? new Date(alert.createdAt.seconds * 1000) : new Date(), { addSuffix: true })}
                            </span>
                        </div>
                        <p className="font-medium text-[13px] leading-tight my-1 text-white/90">{alert.message}</p>

                        <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-white/5">
                            <div className="text-[9px] opacity-40 truncate pr-2">
                                {alert.fromName || 'Staff'}
                            </div>

                            <div className="flex gap-1">
                                {!alert.acknowledged ? (
                                    <button
                                        onClick={() => handleAcknowledgeAlert(alert.id)}
                                        onTouchEnd={(e) => { e.preventDefault(); handleAcknowledgeAlert(alert.id); }}
                                        className="bg-white/10 active:bg-white/30 text-white text-[9px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 font-bold uppercase tracking-wider select-none"
                                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                                    >
                                        <Eye size={10} /> Mark Read
                                    </button>
                                ) : (
                                    <span className="text-green-400 text-[9px] flex items-center gap-1 font-bold uppercase tracking-wider opacity-60">
                                        <CheckCircle size={10} /> Seen
                                    </span>
                                )}
                                <button
                                    onClick={() => PulpitService.resolveAlert(alert.id)}
                                    className="hover:bg-red-500/20 text-white/40 hover:text-red-300 p-0.5 rounded transition-colors"
                                    title="Dismiss"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-800 mx-3 my-1" />

            {/* Visitor Check-ins */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <h3 className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 sticky top-0 bg-zinc-900 z-10 py-1 px-1">
                    <UserPlus size={11} className="text-green-500" />
                    Live Check-ins
                    <span className="ml-auto bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full text-[8px] font-mono">
                        {checkins.length}
                    </span>
                </h3>

                {checkins.length === 0 && (
                    <div className="text-zinc-700 text-[11px] italic py-6 text-center flex flex-col items-center gap-1.5 opacity-40">
                        <Clock size={16} className="opacity-20" />
                        Awaiting check-ins
                    </div>
                )}

                {checkins.map(checkin => (
                    <div
                        key={checkin.id}
                        className={`p-2 rounded border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors group ${checkin.isFirstTime ? 'border-l-2 border-l-green-500/70' : ''
                            }`}
                    >
                        <div className="flex gap-2 items-start">
                            {checkin.photoUrl ? (
                                <img src={checkin.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-zinc-800 opacity-80" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600 font-bold text-[10px]">
                                    {checkin.name.charAt(0)}
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="font-semibold text-zinc-300 text-[12px] truncate pr-1">{checkin.name}</h4>
                                    <span className="text-[8px] text-zinc-600 whitespace-nowrap flex-shrink-0">
                                        {formatDistanceToNow(checkin.checkInTime?.seconds ? new Date(checkin.checkInTime.seconds * 1000) : new Date(), { addSuffix: true })}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div className="flex gap-1.5 text-[8px] items-center">
                                        {checkin.isFirstTime && (
                                            <span className="text-green-500 font-bold bg-green-950/20 px-1 py-px rounded uppercase tracking-tighter">1st Visit</span>
                                        )}
                                        <span className="text-zinc-600 uppercase tracking-tighter font-medium">{checkin.source}</span>
                                    </div>

                                    {!checkin.acknowledged ? (
                                        <button
                                            onClick={() => handleAcknowledgeCheckin(checkin.id)}
                                            onTouchEnd={(e) => { e.preventDefault(); handleAcknowledgeCheckin(checkin.id); }}
                                            className="bg-zinc-800 active:bg-zinc-600 text-zinc-300 text-[8px] px-1 py-0.5 rounded transition-all uppercase font-bold select-none"
                                            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                                        >
                                            Mark Read
                                        </button>
                                    ) : (
                                        <CheckCircle size={10} className="text-green-500/40" />
                                    )}
                                </div>

                                {checkin.notes && (
                                    <p className="text-[11px] text-zinc-500 mt-1 pl-1.5 border-l border-zinc-800 italic leading-relaxed line-clamp-2">
                                        {checkin.notes}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
