'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, Wifi, Share2, Globe, Settings, Lock, Eye, Edit2, X, Check, Loader2 } from 'lucide-react';
import TiptapEditor, { EditorToolbar } from '../Editor/TiptapEditor'; // Assuming default import
import CollaborationPanel from '../Editor/CollaborationPanel';
import { Comment, CommentReply, Suggestion, OnlineUser } from '@/types/collaboration';
import * as Y from 'yjs';
import { Editor } from '@tiptap/react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import ShareScrollModal from './ShareScrollModal';
import { collection, query, where, onSnapshot, orderBy, getDocs, writeBatch, doc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChevronRight, MessageSquare, Bell } from 'lucide-react';
import { useActivity } from '@/context/ActivityContext';
import { useBible } from '@/context/BibleContext';

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

    // Collaboration State
    const [isCollabSidebarOpen, setIsCollabSidebarOpen] = useState(false); // Controls the collaboration panel visibility
    const [comments, setComments] = useState<Comment[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    // const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]); // Already defined below, merging
    const [pendingSelection, setPendingSelection] = useState<{ from: number; to: number; text: string } | null>(null);
    const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
    const yDocRef = useRef<Y.Doc | null>(null);
    const commentsMapRef = useRef<Y.Map<Comment> | null>(null);

    // Share Modal State
    const [showShareModal, setShowShareModal] = useState(false);

    const [editor, setEditor] = useState<Editor | null>(null);
    const { setActivityPanelOpen, notifications, invitations } = useActivity();
    const { openBible } = useBible();

    // Auto-open Activity panel if ?activity=open in URL
    const searchParams = useSearchParams();
    useEffect(() => {
        if (searchParams.get('activity') === 'open') {
            setActivityPanelOpen(true);
        }
    }, [searchParams, setActivityPanelOpen]);

    // Reliability State
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
    const [onlineUsers, setOnlineUsers] = useState<{ name: string, color: string, uid?: string }[]>([]);

    // Derived: Current Scroll Title (mock or from invite) - MOVED UP for access in callbacks
    const activeInvite = invitations.find(i => i.resourceId === scrollId);
    const activeScrollTitle = activeInvite?.title || "Fellowship Scroll";

    // Handle verse link clicks
    const handleLinkClick = useCallback((href: string) => {
        if (href.startsWith('verse://')) {
            const ref = decodeURIComponent((href || '').replace('verse://', ''));
            const match = ref.match(/((?:[123]\s)?[A-Z][a-z]+\.?)\s(\d+):(\d+)(?:-(\d+))?/);
            if (match) {
                const book = match[1].trim();
                const chapter = parseInt(match[2]);
                const startVerse = parseInt(match[3]);
                const endVerse = match[4] ? parseInt(match[4]) : undefined;
                openBible({ book, chapter, verse: startVerse, endVerse }, true);
            }
        } else {
            window.open(href, '_blank');
        }
    }, [openBible]);

    // This isolates Tiptap configuration from parent re-renders unless primitives change
    const editorProps = React.useMemo(() => ({
        content: content,
        onChange: (html: string) => { }, // Read-only from this level in theory, but Tiptap handles real-time
        collaborationId: collaborationId,
        user: { name: userName, color: userColor, uid: user?.uid },
        onAskAi: onAskAi,
        onLinkClick: handleLinkClick
    }), [content, collaborationId, userName, userColor, onAskAi, handleLinkClick]);


    // ============== COLLABORATION HANDLERS ==============
    const handleYDocReady = useCallback((yDoc: Y.Doc) => {
        yDocRef.current = yDoc;
        const commentsMap = yDoc.getMap<Comment>('comments');
        commentsMapRef.current = commentsMap;

        // Sync comments from Y.Map to state
        const updateComments = () => {
            const c: Comment[] = [];
            commentsMap.forEach((v, k) => c.push(v));
            c.sort((a, b) => a.createdAt - b.createdAt);
            setComments(c);
        };

        commentsMap.observe(updateComments);
        updateComments();
    }, []);

    // Helper to notify participants
    const notifyParticipants = useCallback(async (text: string, actionType: 'comment' | 'reply' = 'comment') => {
        if (!user || !scrollId) return;

        try {
            // Find all invitations for this scroll to identify participants
            const q = query(collection(db, 'invitations'), where('resourceId', '==', scrollId));
            const snapshot = await getDocs(q);

            const recipientIds = new Set<string>();

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.toUserId) recipientIds.add(data.toUserId);
                if (data.fromUser?.uid) recipientIds.add(data.fromUser.uid);
            });

            // Remove self
            recipientIds.delete(user.uid);

            if (recipientIds.size === 0) return;

            const batch = writeBatch(db);
            recipientIds.forEach(uid => {
                const docRef = doc(collection(db, 'notifications'));
                batch.set(docRef, {
                    toUserId: uid,
                    fromUser: {
                        uid: user.uid,
                        displayName: userData?.displayName || user.displayName || userName || 'Anonymous',
                        photoURL: user.photoURL,
                    },
                    type: 'comment',
                    message: `${actionType === 'reply' ? 'Replied' : 'Commented'}: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
                    resourceId: scrollId,
                    resourceTitle: activeScrollTitle,
                    read: false,
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();
            console.log(`[FellowshipView] Notified ${recipientIds.size} users.`);
        } catch (e) {
            console.error("[FellowshipView] Failed to notify participants:", e);
        }
    }, [user, scrollId, activeScrollTitle, userData, userName]);


    const handleAddComment = useCallback(async (text: string, quotedText: string, from: number, to: number) => {
        console.log('[FellowshipView] handleAddComment called:', { text, quotedText, from, to });
        if (!commentsMapRef.current || !user) {
            console.error('[FellowshipView] Cannot add comment: map or user missing', { map: !!commentsMapRef.current, user: !!user });
            return;
        }
        const newComment: Comment = {
            id: `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            authorName: userData?.displayName || user.displayName || userName || 'Anonymous',
            authorColor: userColor,
            authorUid: user.uid,
            text,
            quotedText,
            anchorFrom: from,
            anchorTo: to,
            createdAt: Date.now(),
            resolved: false,
            replies: [],
            reactions: {},
        };
        console.log('[FellowshipView] Inserting comment into Yjs map:', newComment.id);
        commentsMapRef.current.set(newComment.id, newComment);
        setPendingSelection(null);

        // Notify others
        notifyParticipants(text, 'comment');

        // NEW: Notify mentioned users specifically
        const mentionMatches = text.match(/@([\w\s]+?)(?=\s|$|,|\.|!|\?)/g);
        console.log('[FellowshipView] Mention matches found:', mentionMatches);
        console.log('[FellowshipView] Online users for matching:', onlineUsers);

        if (mentionMatches && mentionMatches.length > 0) {
            for (const match of mentionMatches) {
                const mentionedName = match.substring(1).trim(); // Remove @ and trim
                console.log('[FellowshipView] Looking for user:', mentionedName);

                // Try to find user in online users (case-insensitive partial match)
                const onlineMatch = onlineUsers.find(u =>
                    (u.name && u.name.toLowerCase().includes(mentionedName.toLowerCase())) ||
                    (mentionedName && u.name && mentionedName.toLowerCase().includes(u.name.split(' ')[0].toLowerCase()))
                );

                console.log('[FellowshipView] Online match result:', onlineMatch);

                if (onlineMatch && onlineMatch.uid && onlineMatch.uid !== user.uid) {
                    // Send specific mention notification using addDoc for reliability
                    try {
                        await addDoc(collection(db, 'notifications'), {
                            toUserId: onlineMatch.uid,
                            fromUser: {
                                uid: user.uid,
                                displayName: userData?.displayName || user.displayName || userName || 'Anonymous',
                                photoURL: user.photoURL,
                            },
                            type: 'mention',
                            message: `Mentioned you: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
                            resourceId: scrollId,
                            resourceTitle: activeScrollTitle,
                            read: false,
                            createdAt: serverTimestamp()
                        });
                        console.log('[FellowshipView] ✅ Mention notification sent to:', onlineMatch.name, onlineMatch.uid);
                    } catch (e) {
                        console.error('[FellowshipView] ❌ Failed to send mention notification:', e);
                    }
                } else {
                    console.log('[FellowshipView] No valid match found for mention:', mentionedName);
                }
            }
        }
    }, [user, userColor, notifyParticipants, userData, userName, onlineUsers, scrollId, activeScrollTitle]);

    const handleAddReply = useCallback((commentId: string, text: string) => {
        if (!commentsMapRef.current || !user) return;
        const comment = commentsMapRef.current.get(commentId);
        if (!comment) return;

        const reply: CommentReply = {
            id: `reply_${Date.now()}`,
            authorName: userData?.displayName || user.displayName || userName || 'Anonymous',
            authorColor: userColor,
            authorUid: user.uid,
            text,
            createdAt: Date.now(),
        };

        commentsMapRef.current.set(commentId, {
            ...comment,
            replies: [...comment.replies, reply],
        });

        // NEW: Notify participants about the reply
        notifyParticipants(text, 'reply');
    }, [user, userColor, notifyParticipants]);

    const handleResolveComment = useCallback((commentId: string) => {
        if (!commentsMapRef.current) return;
        const comment = commentsMapRef.current.get(commentId);
        if (comment) {
            commentsMapRef.current.set(commentId, { ...comment, resolved: !comment.resolved });
        }
    }, []);

    const handleDeleteComment = useCallback((commentId: string) => {
        if (!commentsMapRef.current) return;
        commentsMapRef.current.delete(commentId);
    }, []);

    const handleReaction = useCallback((commentId: string, emoji: string) => {
        if (!commentsMapRef.current || !user) return;
        const comment = commentsMapRef.current.get(commentId);
        if (!comment) return;

        const reactions = { ...comment.reactions };
        const users = reactions[emoji] || [];
        const idx = users.indexOf(user.uid);
        if (idx >= 0) {
            users.splice(idx, 1);
        } else {
            users.push(user.uid);
        }
        reactions[emoji] = users;

        commentsMapRef.current.set(commentId, { ...comment, reactions });
    }, [user]);

    const handleScrollToComment = useCallback((from: number, to: number) => {
        if (editor) {
            // Tiptap way to scroll to position could be handled by setting selection and scrolling into view
            editor.commands.setTextSelection({ from, to });
            editor.commands.scrollIntoView();
        }
    }, [editor]);

    const handleAcceptSuggestion = useCallback((suggestionId: string) => {
        setSuggestions(s => s.filter(x => x.id !== suggestionId));
    }, []);

    const handleRejectSuggestion = useCallback((suggestionId: string) => {
        setSuggestions(s => s.filter(x => x.id !== suggestionId));
    }, []);

    // --- DEBUG LOGGING ---
    const renderLogs = {
        collaborationId: editorProps.collaborationId,
        scrollId: scrollId,
        fallbackId: fallbackId,
        debugLabel: debugLabel,
        hasUser: !!user,
        loading: loading,
        connectionStatus: connectionStatus
    };
    console.log('[FellowshipView] Re-rendered. Props:', renderLogs);
    console.log('[FellowshipView] Current Invitations:', invitations);
    // ---------------------



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
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0B1120]"> {/* Distinct Background */}
            {/* Fellowship Header - Glassmorphic */}
            <div className="z-20 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-xl border-b border-indigo-100/50 dark:border-indigo-900/30 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
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
                                <Wifi className={cn("w-3 h-3",
                                    connectionStatus === 'connected' ? "text-green-500" :
                                        connectionStatus === 'connecting' ? "text-amber-500 animate-pulse" :
                                            "text-red-500"
                                )} />
                                {connectionStatus === 'connected' ? "Connected" :
                                    connectionStatus === 'connecting' ? "Connecting..." :
                                        "Disconnected"} • ID: {scrollId.slice(0, 12)}...
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
                    {/* Collaboration Toggle */}
                    <button
                        onClick={() => setIsCollabSidebarOpen(!isCollabSidebarOpen)}
                        className={`p-2 rounded-full transition-colors ${isCollabSidebarOpen || comments.length > 0 ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500'}`}
                        title="Comments & Collaboration"
                    >
                        <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => setActivityPanelOpen(true)}
                        className="relative p-2 rounded-full transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500"
                        title="Notifications"
                    >
                        <Bell className="w-4 h-4" />
                        {(notifications.some(n => !n.viewed) || invitations.some(i => !i.viewed)) && (
                            <span className="absolute top-1 right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
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
                        className="bg-white dark:bg-[#0f172a] border-b border-gray-200 dark:border-indigo-900/30 overflow-hidden"
                    >
                        <div className="p-4 grid gap-4 grid-cols-2">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5">
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

                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5">
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


            {/* Toolbar - Glassmorphic, stays above scrolling content */}
            <div className="z-10 shrink-0 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-xl border-b border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                {editor && (
                    <EditorToolbar
                        editor={editor}
                        className="px-2 py-1"
                    />
                )}
            </div>

            {/* Editor Container - flex row for editor + optional collab panel */}
            <div className="flex-1 min-h-0 flex">
                {/* Main editor area - relative container for absolute scroll child */}
                <div className="flex-1 relative">
                    {/* Pattern overlay */}
                    <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-[0.03] pointer-events-none z-0" />
                    {/* Scroll container - absolute positioning guarantees it fills parent */}
                    <div className="absolute inset-0 overflow-y-auto z-10">
                        <TiptapEditor
                            {...editorProps}
                            showToolbar={false}
                            authReady={!!user} // Use Firebase User object for immediate auth check
                            onEditorReady={(e) => {
                                setEditor(e);
                                if (onEditorReady) onEditorReady(e);
                            }}
                            onAwarenessUpdate={setOnlineUsers}
                            debugLabel={debugLabel}
                            className="px-6 py-6 custom-scrollbar prose-indigo max-w-none"
                            // COLLABORATION PROPS
                            enableComments={true} // Always enable comments in Fellowship
                            onSelectionChange={selected => {
                                console.log('[FellowshipView] onSelectionChange:', selected);
                                setPendingSelection(selected);
                            }}
                            onYDocReady={handleYDocReady}
                            onAddComment={(snapshot) => {
                                console.log('[FellowshipView] onAddComment triggered. Snapshot:', snapshot, 'Current pendingSelection:', pendingSelection);

                                // 1. If we got a snapshot, use it PREFERENTIALLY (it's the most accurate)
                                if (snapshot && typeof snapshot === 'object' && 'from' in snapshot) {
                                    console.log('[FellowshipView] Using selection snapshot from editor');
                                    setPendingSelection(snapshot);
                                }
                                // 2. Recovery Logic: If snapshot failed but editor has a selection, recover it
                                else if (!pendingSelection && editor) {
                                    const { from, to } = editor.state.selection;
                                    if (from !== to) {
                                        const text = editor.state.doc.textBetween(from, to, ' ');
                                        console.log('[FellowshipView] Recovering selection manually from editor state:', { from, to, text });
                                        setPendingSelection({ from, to, text });
                                    }
                                }

                                setIsCollabSidebarOpen(true);
                            }}
                            onStatusChange={setConnectionStatus}
                        />
                    </div>
                </div>
                {/* Collaboration Panel */}
                {isCollabSidebarOpen && (
                    <CollaborationPanel
                        className="w-72 shadow-xl z-10"
                        onClose={() => setIsCollabSidebarOpen(false)}
                        comments={comments}
                        suggestions={suggestions}
                        onlineUsers={onlineUsers.map((u, i) => ({ ...u, clientId: i }))} // Map simple users to OnlineUser type
                        currentUserId={user?.uid || ''}
                        currentUserName={user?.displayName || 'Anonymous'}
                        currentUserColor={userColor}
                        onAddComment={(text) => pendingSelection && handleAddComment(text, pendingSelection.text, pendingSelection.from, pendingSelection.to)}
                        onAddReply={handleAddReply}
                        onResolveComment={handleResolveComment}
                        onDeleteComment={handleDeleteComment}
                        onReaction={handleReaction}
                        onScrollToComment={handleScrollToComment}
                        onAcceptSuggestion={handleAcceptSuggestion}
                        onRejectSuggestion={handleRejectSuggestion}
                        // Added missing props/handlers for selection state
                        selectedCommentId={selectedCommentId}
                        onSelectComment={setSelectedCommentId}
                        // Added missing props for comments functionality
                        pendingSelection={pendingSelection}
                        onClearPendingSelection={() => setPendingSelection(null)}
                    />
                )}
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

export interface ScrollItem {
    id: string;
    title: string;
    book: string;
    chapter: string;
    verse?: string; // Opt out if not specific
    author: string;
    participantCount: number;
    lastActive: number;
    type: 'public' | 'shared' | 'private';
    contentPreview?: string;
}
