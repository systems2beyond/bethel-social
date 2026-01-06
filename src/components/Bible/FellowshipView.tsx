import React, { useState } from 'react';
import { Users, Wifi, Share2, Globe, Settings, Lock, Eye, Edit2, X, Check, Loader2 } from 'lucide-react';
import TiptapEditor, { EditorToolbar } from '../Editor/TiptapEditor'; // Assuming default import
import { Editor } from '@tiptap/react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import ShareScrollModal from './ShareScrollModal';
import { collection, query, where, onSnapshot, orderBy, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChevronRight, MessageSquare, Bell } from 'lucide-react';

interface FellowshipViewProps {
    content: string;
    collaborationId: string;
    userName: string;
    userColor: string;
    onAskAi: (query: string, autoSend?: boolean) => void;
    // ---
    onlineCount?: number; // Placeholder for now, can perform awareness logic later or inside
    scrollId: string;
    onJoinScroll: (id: string, title?: string) => void;
    fallbackId?: string;
    onEditorReady?: (editor: Editor | null) => void;
    debugLabel?: string;
}

import { cn } from '@/lib/utils'; // Added import

export function FellowshipView({ content, collaborationId, userName, userColor, onAskAi, onlineCount, scrollId, onJoinScroll, fallbackId, onEditorReady, debugLabel }: FellowshipViewProps) {
    const { user, userData, loading } = useAuth();
    const [showSettings, setShowSettings] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [allowEditing, setAllowEditing] = useState(true);

    // Share Modal State
    const [showShareModal, setShowShareModal] = useState(false);

    const [editor, setEditor] = useState<Editor | null>(null);
    // Invitations State
    const [invitations, setInvitations] = useState<any[]>([]);
    const [invitationSidebarOpen, setInvitationSidebarOpen] = useState(false);

    // Reliability State
    const [connectionError, setConnectionError] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<{ name: string, color: string }[]>([]);

    // Stabilize editor configuration internally
    // This isolates Tiptap configuration from parent re-renders unless primitives change
    const editorProps = React.useMemo(() => ({
        content: content,
        onChange: (html: string) => { }, // Read-only from this level in theory, but Tiptap handles real-time
        collaborationId: collaborationId,
        user: { name: userName, color: userColor },
        onAskAi: onAskAi
    }), [content, collaborationId, userName, userColor, onAskAi]);

    // Listen for invitations
    React.useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, 'invitations'),
            where('toUserId', '==', user.uid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invites = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInvitations(invites);
            setConnectionError(false); // Clear error on success
        }, (error) => {
            console.error("Firestore Listener Error:", error);
            if (error.code === 'permission-denied' || error.message.includes('BLOCKED') || error.code === 'unavailable') {
                setConnectionError(true);
            }
        });

        return () => unsubscribe();
    }, [user?.uid]);

    // Cleanup: Ephemeral Invites -> Fallback Redirect
    // DISABLED: This was causing premature redirection of invites when the host changed chapters or re-rendered.
    // We will rely on manual session ending or a more robust presence system in the future.
    /*
    React.useEffect(() => {
        return () => {
            if (!userData?.uid || !scrollId.includes(userData.uid)) return;

            console.log('Host leaving session, redirecting invites to fallback...');
            const cleanup = async () => {
                try {
                    const q = query(
                        collection(db, 'invitations'),
                        where('fromUserId', '==', userData.uid),
                        where('resourceId', '==', scrollId),
                        where('status', '==', 'pending')
                    );
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        const batch = writeBatch(db);
                        snapshot.docs.forEach(d => {
                            // Redirect to fallback ID (General Fellowship Room) instead of deleting
                            batch.update(doc(db, 'invitations', d.id), {
                                resourceId: fallbackId || scrollId, // Use fallback if available, else keep generic
                                title: `${d.data().title} (Session Ended)`,
                                isLive: false
                            });
                        });
                        await batch.commit();
                        console.log(`Redirected ${snapshot.size} invitations to fallback.`);
                    }
                } catch (err) {
                    console.error("Cleanup/Redirect failed:", err);
                }
            };
            cleanup();
        };
    }, [scrollId, userData?.uid, fallbackId]);
    */

    // --- DEBUG LOGGING ---
    console.log('[FellowshipView] Re-rendered. Props:', {
        collaborationId: editorProps.collaborationId,
        scrollId: scrollId,
        fallbackId: fallbackId,
        debugLabel: debugLabel
    });
    console.log('[FellowshipView] Current Invitations:', invitations);
    // ---------------------

    // Derived: Current Scroll Title (mock or from invite)
    const activeInvite = invitations.find(i => i.resourceId === scrollId);
    const activeScrollTitle = activeInvite?.title || "Fellowship Scroll";

    // Removed local share handler and state in favor of component content

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#0B1120]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B1120] p-6 text-center">
                <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-4">
                    <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Sign in to join Fellowship</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
                    You need to be signed in to see live notes and collaborate with others.
                </p>
                {/* Trigger a sign-in via the main app (assuming a global modal or redirect exists, 
                    but for now we instruct the user. In a real app we'd call openAuthModal()) */}
                <div className="text-xs text-indigo-500 font-medium">Please sign in via the main menu.</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0B1120]"> {/* Distinct Background */}
            {/* Fellowship Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-indigo-100 dark:border-indigo-900/30 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20 text-white animate-pulse-slow">
                        <Users className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {activeScrollTitle}
                            {isPublic ? (
                                <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[10px] flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-mono">
                                    <Globe className="w-3 h-3" /> Public
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center gap-1 text-slate-500 font-mono">
                                    <Lock className="w-3 h-3" /> Shared
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Wifi className={cn("w-3 h-3", connectionError ? "text-amber-500" : "text-green-500")} />
                                {connectionError ? "Connecting..." : "Live Connection"} • ID: {scrollId.slice(0, 8)}...
                            </p>
                            {/* Presence Avatars */}
                            <div className="flex -space-x-1.5 ml-2">
                                {onlineUsers.map((u, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full border border-white dark:border-zinc-900 flex items-center justify-center text-[8px] font-bold text-white relative group"
                                        style={{ backgroundColor: u.color }}
                                        title={u.name}>
                                        {u.name[0]}
                                    </div>
                                ))}
                                {onlineUsers.length > 3 && (
                                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-zinc-800 border border-white dark:border-zinc-900 flex items-center justify-center text-[8px] text-slate-500">
                                        +{onlineUsers.length - 3}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Red Warning Removed - UI Simplified */}
                    <button
                        onClick={() => setInvitationSidebarOpen(!invitationSidebarOpen)}
                        className={`relative p-2 rounded-full transition-colors ${invitationSidebarOpen ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500'}`}
                        title="Shared Scrolls"
                    >
                        <Bell className="w-4 h-4" />
                        {invitations.length > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`hidden sm:block p-2 rounded-full transition-colors ${showSettings ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500'}`}
                        title="Collaboration Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => {
                            console.log('[FellowshipView] Clicking Share. ID to share:', editorProps.collaborationId);
                            setShowShareModal(true);
                        }}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-indigo-500"
                        title="Share Scroll"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white dark:bg-[#0f172a] border-b border-indigo-100 dark:border-indigo-900/30 overflow-hidden"
                    >
                        <div className="p-4 grid gap-4 grid-cols-2">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                                        <Eye className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Visibility</p>
                                        <p className="text-[10px] text-slate-500">Who can see this scroll</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsPublic(!isPublic)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isPublic ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                                        <Edit2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Permissions</p>
                                        <p className="text-[10px] text-slate-500">Allow others to edit</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAllowEditing(!allowEditing)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${allowEditing ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${allowEditing ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invitation Sidebar */}
            <AnimatePresence>
                {invitationSidebarOpen && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 260, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="border-r border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-[#0B1120] overflow-hidden flex flex-col"
                    >
                        <div className="p-3 border-b border-indigo-50 dark:border-indigo-900/20 bg-slate-50/50 dark:bg-[#0B1120] flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare className="w-3 h-3" />
                                Shared with You
                            </h4>
                            {invitations.length > 0 && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('Clear all pending invitations?')) return;
                                        console.log('[FellowshipView] Clearing all invitations...');
                                        try {
                                            const batch = writeBatch(db);
                                            invitations.forEach(inv => {
                                                console.log('[FellowshipView] Deleting invite:', inv.id, inv.resourceId);
                                                batch.delete(doc(db, 'invitations', inv.id));
                                            });
                                            await batch.commit();
                                            console.log('[FellowshipView] Successfully cleared all invitations');
                                            alert('All invitations cleared!');
                                        } catch (e) {
                                            console.error('[FellowshipView] Failed to clear invites', e);
                                            alert('Failed to clear invites. Check console.');
                                        }
                                    }}
                                    className="text-[9px] text-red-400 hover:text-red-500 hover:underline"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {invitations.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    No pending invites
                                </div>
                            ) : (
                                invitations.map(invite => (
                                    <div
                                        key={invite.id}
                                        onClick={() => {
                                            // Ideally we pass a callback to parent to switch the scrollId
                                            // But since we can't easily change props from here without lifting state up even more...
                                            // We might need to dispatch a custom event or use a context.
                                            // FOR NOW: Let's assume the parent can watch for URL changes or we just reload (hacky)
                                            // OR: We create a simple internal redirect if we are inside a system that supports it.
                                            // User requested: "preview... add to notes or collaborate"

                                            // Handle Join
                                            if (onJoinScroll) {
                                                console.log('[FellowshipView] Clicked Invitation. Target ID:', invite.resourceId, 'Title:', invite.title);
                                                onJoinScroll(invite.resourceId, invite.title);
                                                setInvitationSidebarOpen(false);
                                            } else {
                                                console.error('[FellowshipView] onJoinScroll prop is missing!');
                                            }
                                        }}
                                        className="p-3 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                                INVITATION
                                            </span>
                                            <span className="text-[9px] text-gray-400">
                                                {invite.createdAt?.seconds ? new Date(invite.createdAt.seconds * 1000).toLocaleTimeString() : 'Just now'}
                                            </span>
                                        </div>
                                        <h5 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1 group-hover:text-indigo-600 transition-colors">
                                            {invite.title}
                                        </h5>
                                        <div className="text-[8px] font-mono text-gray-300 dark:text-gray-600 truncate mb-2">
                                            ID: {invite.resourceId}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {invite.fromUser?.photoURL ? (
                                                <img src={invite.fromUser.photoURL} className="w-5 h-5 rounded-full ring-1 ring-white dark:ring-zinc-800" alt="Sender" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[8px] font-bold text-indigo-600">
                                                    {invite.fromUser?.displayName?.[0] || '?'}
                                                </div>
                                            )}
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {invite.fromUser?.displayName} invited you
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Editor Container with Special Styling */}
            <div className="flex-1 overflow-hidden relative flex">
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-[0.03] pointer-events-none" /> {/* Subtle pattern */}
                    <div className="h-full flex flex-col">
                        <div className="border-b border-indigo-50 dark:border-indigo-900/20 px-2 bg-white/50 dark:bg-[#0B1120]/50 backdrop-blur-sm">
                            {/* Toolbar placeholder */}
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <TiptapEditor
                                {...editorProps}
                                authReady={!!user} // Use Firebase User object for immediate auth check
                                onEditorReady={(e) => {
                                    setEditor(e);
                                    if (onEditorReady) onEditorReady(e);
                                }}
                                onAwarenessUpdate={setOnlineUsers}
                                debugLabel={debugLabel}
                                className="h-full overflow-y-auto px-6 py-6 custom-scrollbar prose-indigo max-w-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Fellowship Footer / Status */}
            <div className="shrink-0 bg-indigo-50 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-900/20 px-4 py-2 flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>Participating as {userData?.displayName || 'Anonymous'}</span>
                </div>
                {/* Share Modal Portal */}
                {/* Share Modal */}
                <ShareScrollModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    title="Share Fellowship Scroll"
                    scrollId={editorProps.collaborationId}
                    currentContent={editor?.getHTML() || ''}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2 text-[9px] text-slate-400 dark:text-zinc-600 opacity-50 pointer-events-none select-none">
                    <span>{editorProps.collaborationId ? 'Synced' : 'Offline'}</span>
                    <span>•</span>
                    <span>v1.3.1 (Reliability Fix)</span>
                </div>
            </div>
        </div>
    );
}

// React.memo to prevent unnecessary re-renders
// React.memo with default shallow equality check.
// This works perfectly now because we pass primitives (strings) as props.
// As long as content, collaborationId, etc. are === equal, it won't re-render.
export default React.memo(FellowshipView);
