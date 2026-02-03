'use client';
import { useState, useEffect } from 'react';
import { PulpitService } from '@/lib/services/PulpitService';
import { PulpitSession, PulpitAlert, PulpitCheckIn } from '@/types';
import { AlertTriangle, UserPlus, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VisitorAlertFeedProps {
    session: PulpitSession;
}

export default function VisitorAlertFeed({ session }: VisitorAlertFeedProps) {
    const [alerts, setAlerts] = useState<PulpitAlert[]>([]);
    const [checkins, setCheckins] = useState<PulpitCheckIn[]>([]);

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

    const handleAcknowledgeCheckin = async (checkinId: string) => {
        // Optimistic update handled by Firestore stream
        // Need current user ID here, assuming auth context is available or passed down
        // For MVP, we'll skip the user ID requirement in the service or assume it's handled
        // await PulpitService.acknowledgeCheckin(checkinId, 'current-user-id');
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
            {/* Urgent Alerts Section */}
            <div className="p-4 space-y-4">
                <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500" />
                    Urgent Alerts
                </h3>

                {alerts.length === 0 && (
                    <div className="text-zinc-600 text-sm italic py-2 text-center border border-dashed border-zinc-800 rounded">
                        No active alerts
                    </div>
                )}

                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className={`p-4 rounded-lg border-l-4 shadow-lg animate-in slide-in-from-right-4 duration-300 ${alert.priority === 'critical' ? 'bg-red-950/50 border-red-500 text-red-200' :
                            alert.priority === 'high' ? 'bg-orange-950/50 border-orange-500 text-orange-200' :
                                'bg-blue-950/50 border-blue-500 text-blue-200'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-black/20 uppercase">
                                {alert.type}
                            </span>
                            <span className="text-xs opacity-70">
                                {formatDistanceToNow(alert.createdAt?.seconds ? new Date(alert.createdAt.seconds * 1000) : new Date(), { addSuffix: true })}
                            </span>
                        </div>
                        <p className="font-medium text-lg leading-tight">{alert.message}</p>
                        <div className="mt-2 text-xs opacity-70 flex justify-between items-center">
                            <span>From: {alert.fromName || 'Staff'}</span>
                            <button
                                onClick={() => PulpitService.resolveAlert(alert.id)}
                                className="hover:bg-white/10 px-2 py-1 rounded transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-800 mx-4 my-2" />

            {/* Visitor Check-ins */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-zinc-900 z-10 py-2">
                    <UserPlus size={14} className="text-green-500" />
                    Live Check-ins
                    <span className="ml-auto bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full text-[10px]">
                        {checkins.length}
                    </span>
                </h3>

                {checkins.length === 0 && (
                    <div className="text-zinc-600 text-sm italic py-8 text-center flex flex-col items-center gap-2">
                        <Clock size={24} className="opacity-20" />
                        Waiting for check-ins...
                    </div>
                )}

                {checkins.map(checkin => (
                    <div
                        key={checkin.id}
                        className={`p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors ${checkin.isFirstTime ? 'border-l-4 border-l-green-500' : ''
                            }`}
                    >
                        <div className="flex gap-3">
                            {checkin.photoUrl ? (
                                <img src={checkin.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                                    {checkin.name.charAt(0)}
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-zinc-200 truncate">{checkin.name}</h4>
                                    <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                        {formatDistanceToNow(checkin.checkInTime?.seconds ? new Date(checkin.checkInTime.seconds * 1000) : new Date(), { addSuffix: true })}
                                    </span>
                                </div>

                                <div className="flex gap-2 text-xs mt-1">
                                    {checkin.isFirstTime && (
                                        <span className="text-green-400 font-medium">1st Time Visitor</span>
                                    )}
                                    <span className="text-zinc-500 capitalize">{checkin.source}</span>
                                </div>

                                {checkin.notes && (
                                    <p className="text-sm text-zinc-400 mt-2 bg-black/20 p-2 rounded italic">
                                        "{checkin.notes}"
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
