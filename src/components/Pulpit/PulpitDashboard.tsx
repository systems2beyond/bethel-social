'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PulpitService } from '@/lib/services/PulpitService';
import TeleprompterView from '@/components/Pulpit/TeleprompterView';
import VisitorAlertFeed from '@/components/Pulpit/VisitorAlertFeed';
import PulpitControlCenter from '@/components/Pulpit/PulpitControlCenter';
import { PulpitSession } from '@/types';
import { Loader2, Plus, MonitorPlay } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function PulpitContent() {
    const { user, userData, loading: authLoading } = useAuth();
    const [session, setSession] = useState<PulpitSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const noteId = searchParams.get('noteId');

    // Track which session+noteId combos have been synced to prevent write loops
    const syncedNoteRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user || authLoading) return;

        // Ensure user has access (staff/admin)
        if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin' && userData.role !== 'pastor_admin' && userData?.role !== 'media_admin')) {
            router.push('/');
            return;
        }

        setLoading(true);

        // Real-time subscription for active session
        const churchId = userData?.churchId || 'default_church';
        const q = query(
            collection(db, 'pulpit_sessions'),
            where('churchId', '==', churchId),
            where('status', 'in', ['live', 'scheduled']),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (!snapshot.empty) {
                let activeSession = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PulpitSession;

                // If there's a noteId and an existing session, update the session with the note content
                // Use ref to prevent write loops - only sync once per session+noteId combo
                const syncKey = `${activeSession.id}:${noteId}`;
                if (noteId && syncedNoteRef.current !== syncKey) {
                    try {
                        const noteDoc = await getDoc(doc(db, 'users', user.uid, 'notes', noteId));
                        if (noteDoc.exists()) {
                            const noteData = noteDoc.data();
                            activeSession = {
                                ...activeSession,
                                sermonTitle: noteData.title || activeSession.sermonTitle,
                                sermonNotes: noteData.content || activeSession.sermonNotes
                            };
                            // Mark as synced BEFORE writing to prevent loop
                            syncedNoteRef.current = syncKey;
                            // Update in Firestore
                            await PulpitService.updateTeleprompter(activeSession.id, noteData.content || '');
                        }
                    } catch (error) {
                        console.error("Error updating session with note:", error);
                    }
                }

                setSession(activeSession);
            } else {
                setSession(null);
            }
            setLoading(false);
        }, (err) => {
            console.error('Session subscription error:', err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, authLoading, router, userData, noteId]);

    const handleCreateSession = async () => {
        if (!user) return;
        setInitializing(true);
        try {
            const today = new Date();
            let sermonTitle = `Service - ${today.toLocaleDateString()}`;
            let sermonNotes = '# Welcome!\n\nUse this space for your sermon notes.\n\n- Point 1\n- Point 2\n- Point 3';

            // If launched with a noteId, fetch that note first
            if (noteId) {
                try {
                    const noteDoc = await getDoc(doc(db, 'users', user.uid, 'notes', noteId));
                    if (noteDoc.exists()) {
                        const noteData = noteDoc.data();
                        sermonTitle = noteData.title || sermonTitle;
                        sermonNotes = noteData.content || sermonNotes;
                    }
                } catch (error) {
                    console.error("Error fetching note for session:", error);
                }
            }

            const sessionData = {
                churchId: userData?.churchId || 'default_church',
                date: today,
                status: 'scheduled' as const,
                sermonTitle,
                sermonNotes,
                bibleReferences: [],
                teleprompterSettings: {
                    fontSize: 48,
                    scrollSpeed: 2,
                    backgroundColor: '#000000',
                    textColor: '#ffffff',
                    mirrorMode: false
                },
                visitorFeedEnabled: true,
                alertsEnabled: true,
                createdBy: user.uid,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const id = await PulpitService.createSession(sessionData);
            setSession({ id, ...sessionData } as PulpitSession);
        } catch (error) {
            console.error('Failed to create session:', error);
        } finally {
            setInitializing(false);
        }
    };

    // Auto-initialize if launched with a noteId and no active session exists
    useEffect(() => {
        if (!authLoading && !loading && !session && noteId && !initializing && user) {
            handleCreateSession();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, loading, session, noteId, user]);

    if (authLoading || loading || (noteId && initializing)) {
        return (
            <div className="flex h-dvh w-full items-center justify-center bg-zinc-950 text-white flex-col gap-4">
                <Loader2 className="animate-spin text-zinc-500" size={32} />
                {noteId && initializing && <p className="text-zinc-500 mt-4">Initializing session from note...</p>}
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex h-dvh w-full flex-col items-center justify-center bg-zinc-950 text-white gap-6">
                <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 text-center max-w-md shadow-2xl">
                    <div className="mx-auto w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                        <MonitorPlay size={32} className="text-zinc-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Pulpit Dashboard</h1>
                    <p className="text-zinc-400 mb-8 leading-relaxed">
                        No active session found for today. Verify your sermon notes and start the service HUD.
                    </p>

                    <button
                        onClick={handleCreateSession}
                        disabled={initializing}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {initializing ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <Plus size={20} />
                        )}
                        Initialize New Session
                    </button>
                    <button
                        onClick={() => router.push('/admin')}
                        className="mt-4 text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
                    >
                        Return to Admin Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-dvh bg-zinc-950 text-white overflow-hidden">
            <div className="flex-1 flex min-h-0">
                {/* Main Content (Teleprompter) - 70% */}
                <div className="flex-[0.7] border-r border-zinc-800 bg-black h-full relative">
                    <TeleprompterView session={session} />
                </div>

                {/* Sidebar (Feed) - 30% */}
                <div className="flex-[0.3] h-full bg-zinc-900">
                    <VisitorAlertFeed session={session} />
                </div>
            </div>

            {/* Bottom Control Bar */}
            <div className="h-20 shrink-0 z-50">
                <PulpitControlCenter session={session} />
            </div>
        </div>
    );
}

export default function PulpitDashboard() {
    return (
        <Suspense fallback={
            <div className="flex h-dvh w-full items-center justify-center bg-zinc-950 text-white">
                <Loader2 className="animate-spin text-zinc-500" size={32} />
            </div>
        }>
            <PulpitContent />
        </Suspense>
    );
}
