'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PulpitService } from '@/lib/services/PulpitService';
import AlertChat from '@/components/Pulpit/AlertChat';
import { PulpitSession } from '@/types';
import { Loader2, AlertTriangle, Radio } from 'lucide-react';

export default function AlertsPopupPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const [session, setSession] = useState<PulpitSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading || !user) return;

        // Check for admin access
        const adminRoles = ['admin', 'super_admin', 'pastor_admin', 'media_admin'];
        if (!userData || !adminRoles.includes(userData.role || '')) {
            setError('Access denied. Admin role required.');
            setLoading(false);
            return;
        }

        // Fetch active session
        const fetchSession = async () => {
            try {
                const activeSession = await PulpitService.getActiveSession(userData?.churchId || 'default_church');
                if (activeSession) {
                    setSession(activeSession);
                } else {
                    setError('No active service session found.');
                }
            } catch (err) {
                console.error('Error fetching session:', err);
                setError('Failed to load session.');
            } finally {
                setLoading(false);
            }
        };

        fetchSession();
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
            {/* Compact Header */}
            <header className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 shrink-0">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm text-zinc-200 font-medium">Urgent Messages</span>
                <div className="ml-auto flex items-center gap-2">
                    {session.status === 'live' ? (
                        <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                            <Radio size={12} className="animate-pulse" />
                            On Air
                        </span>
                    ) : (
                        <span className="text-xs text-zinc-500">Off Air</span>
                    )}
                </div>
            </header>

            {/* Alert Chat */}
            <div className="flex-1 overflow-hidden">
                <AlertChat session={session} />
            </div>
        </div>
    );
}
