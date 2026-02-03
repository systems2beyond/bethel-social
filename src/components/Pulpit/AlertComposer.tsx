'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PulpitService } from '@/lib/services/PulpitService';
import { AlertTriangle, X, Loader2, Send } from 'lucide-react';

interface AlertComposerProps {
    sessionId: string;
    churchId: string;
    onClose: () => void;
    onSuccess?: () => void;
}

const ALERT_TYPES = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'security', label: 'Security' },
    { value: 'media', label: 'Media' },
    { value: 'children', label: 'Children' },
    { value: 'parking', label: 'Parking' },
    { value: 'general', label: 'General' },
] as const;

const ALERT_PRIORITIES = [
    { value: 'critical', label: 'Critical', color: 'text-red-400' },
    { value: 'high', label: 'High', color: 'text-orange-400' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
    { value: 'low', label: 'Low', color: 'text-blue-400' },
] as const;

export default function AlertComposer({ sessionId, churchId, onClose, onSuccess }: AlertComposerProps) {
    const { user, userData } = useAuth();
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'urgent' | 'security' | 'media' | 'children' | 'parking' | 'general'>('urgent');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('critical');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user) return;

        setSending(true);
        setError(null);

        try {
            await PulpitService.createAlert({
                sessionId,
                churchId,
                type,
                priority,
                message: message.trim(),
                fromUserId: user.uid,
                fromName: userData?.displayName || user.displayName || 'Staff',
                fromRole: userData?.role || 'staff',
                acknowledged: false,
                resolved: false,
            });

            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Failed to send alert:', err);
            setError('Failed to send alert. Please try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Send Urgent Message</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Message */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Enter your urgent message..."
                            className="w-full h-24 px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 resize-none"
                            autoFocus
                            required
                        />
                    </div>

                    {/* Type & Priority Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as typeof type)}
                                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
                            >
                                {ALERT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as typeof priority)}
                                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
                            >
                                {ALERT_PRIORITIES.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Sender Info */}
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span>Sending as:</span>
                        <span className="text-zinc-300 font-medium">
                            {userData?.displayName || user?.displayName || 'Staff'}
                        </span>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={sending || !message.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-medium shadow-lg shadow-red-600/20"
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Send Alert
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
