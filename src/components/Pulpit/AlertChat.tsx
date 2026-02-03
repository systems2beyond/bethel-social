'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PulpitService } from '@/lib/services/PulpitService';
import { PulpitAlert, PulpitSession } from '@/types';
import { Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AlertChatProps {
    session: PulpitSession;
}

export default function AlertChat({ session }: AlertChatProps) {
    const { user, userData } = useAuth();
    const [alerts, setAlerts] = useState<PulpitAlert[]>([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Subscribe to alerts (urgent/critical only)
    useEffect(() => {
        const unsubscribe = PulpitService.streamAlerts(session.churchId, (newAlerts) => {
            // Filter to urgent type OR critical priority only
            const urgentAlerts = newAlerts.filter(
                alert => alert.type === 'urgent' || alert.priority === 'critical'
            );
            setAlerts(urgentAlerts);
        });

        return () => unsubscribe();
    }, [session.churchId]);

    // Auto-scroll to bottom when new alerts arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [alerts]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user || sending) return;

        setSending(true);
        try {
            await PulpitService.createAlert({
                sessionId: session.id,
                churchId: session.churchId,
                type: 'urgent',
                priority: 'critical',
                message: message.trim(),
                fromUserId: user.uid,
                fromName: userData?.displayName || user.displayName || 'Staff',
                fromRole: userData?.role || 'staff',
                acknowledged: false,
                resolved: false,
            });
            setMessage('');
            inputRef.current?.focus();
        } catch (error) {
            console.error('Failed to send alert:', error);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
                            <Send size={20} className="text-zinc-600" />
                        </div>
                        <p className="text-zinc-500 text-sm">No urgent messages yet</p>
                        <p className="text-zinc-600 text-xs mt-1">Messages will appear here in real-time</p>
                    </div>
                ) : (
                    <>
                        {/* Display alerts in chronological order (oldest first for chat feel) */}
                        {[...alerts].reverse().map((alert) => (
                            <div
                                key={alert.id}
                                className="animate-in slide-in-from-bottom-2 duration-200"
                            >
                                <div className={`p-3 rounded-xl max-w-[90%] ${
                                    alert.fromUserId === user?.uid
                                        ? 'ml-auto bg-red-600/90 text-white'
                                        : 'bg-zinc-800 text-zinc-100'
                                }`}>
                                    {/* Header */}
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                            alert.fromUserId === user?.uid ? 'text-red-200' : 'text-red-400'
                                        }`}>
                                            {alert.type}
                                        </span>
                                        <span className={`text-[10px] ${
                                            alert.fromUserId === user?.uid ? 'text-red-200' : 'text-zinc-500'
                                        }`}>
                                            {formatDistanceToNow(
                                                alert.createdAt?.seconds
                                                    ? new Date(alert.createdAt.seconds * 1000)
                                                    : new Date(),
                                                { addSuffix: true }
                                            )}
                                        </span>
                                    </div>

                                    {/* Message */}
                                    <p className="text-sm leading-relaxed">{alert.message}</p>

                                    {/* Sender */}
                                    <div className={`mt-2 text-[10px] ${
                                        alert.fromUserId === user?.uid ? 'text-red-200' : 'text-zinc-500'
                                    }`}>
                                        {alert.fromUserId === user?.uid ? 'You' : alert.fromName || 'Staff'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Compose Area - Fixed at bottom */}
            <form
                onSubmit={handleSend}
                className="shrink-0 p-3 border-t border-zinc-800 bg-zinc-900"
            >
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type urgent message..."
                        className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
                        disabled={sending}
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={sending || !message.trim()}
                        className="p-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                    >
                        {sending ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-2 text-center">
                    Press Enter to send • Visible on Pulpit view
                </p>
            </form>
        </div>
    );
}
