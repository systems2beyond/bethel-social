'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useAuth } from '@/context/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

/**
 * CURSOR TEST PAGE v3 - With Inline Comments
 * 
 * Features:
 * - Real-time cursor rendering (DOM-based)
 * - Google Docs-style inline comments
 * - Comment threading and replies
 * - Real-time sync via Y.Map
 */

// ============== TYPE DEFINITIONS ==============

interface RemoteCursor {
    clientId: number;
    user: { name: string; color: string };
    anchorPos?: number;
    headPos?: number;
}

interface CommentReply {
    id: string;
    authorName: string;
    authorColor: string;
    authorUid: string;
    text: string;
    createdAt: number;
}

interface Comment {
    id: string;
    authorName: string;
    authorColor: string;
    authorUid: string;
    text: string;
    quotedText: string; // The selected text that was commented on
    anchorFrom: number;
    anchorTo: number;
    createdAt: number;
    resolved: boolean;
    replies: CommentReply[];
    reactions: { [emoji: string]: string[] };
}

interface OnlineUser {
    clientId: number;
    name: string;
    color: string;
}

interface Suggestion {
    id: string;
    type: 'insertion' | 'deletion';
    authorName: string;
    authorColor: string;
    authorUid: string;
    content: string;
    position: number;
    createdAt: number;
}

// ============== MAIN COMPONENT ==============

export default function CursorTestPage() {
    const { user, userData, loading } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [showCommentInput, setShowCommentInput] = useState(false);
    const [pendingCommentRange, setPendingCommentRange] = useState<{ from: number; to: number } | null>(null);
    const [newCommentText, setNewCommentText] = useState('');
    const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    // @Mention state
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionCursorPos, setMentionCursorPos] = useState(0);

    // Suggesting Mode state
    const [suggestingMode, setSuggestingMode] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

    const editorContainerRef = useRef<HTMLDivElement>(null);
    const providerRef = useRef<HocuspocusProvider | null>(null);
    const commentsMapRef = useRef<Y.Map<Comment> | null>(null);
    const suggestionsMapRef = useRef<Y.Map<Suggestion> | null>(null);

    const collaborationId = 'cursor-test-room-v3';

    const log = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `[${timestamp}] ${msg}`;
        console.log(logMsg);
        setLogs(prev => [...prev.slice(-30), logMsg]);
    }, []);

    // Create Y.Doc once
    const yDoc = useMemo(() => new Y.Doc(), []);

    // User info
    const userName = userData?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Anonymous';
    const userColor = useMemo(() => {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#fd79a8', '#00b894', '#6c5ce7', '#e17055'];
        return colors[Math.floor(Math.random() * colors.length)];
    }, []);

    // ============== EDITOR SETUP ==============

    const editor = useEditor({
        extensions: [
            StarterKit.configure({}),
            Highlight.configure({ multicolor: true }),
            Collaboration.configure({ document: yDoc }),
        ],
        content: '<p>Select some text and click "Add Comment" to test the commenting feature!</p><p></p><p>This is a test paragraph for collaboration. Try selecting this sentence.</p>',
        onSelectionUpdate: ({ editor }) => {
            const awareness = providerRef.current?.awareness;
            if (awareness) {
                const { from, to } = editor.state.selection;
                awareness.setLocalStateField('cursor', { anchor: from, head: to });
            }
        },
    }, [yDoc]);

    // ============== SELECTION HANDLING ==============

    const hasSelection = editor && !editor.state.selection.empty;

    const handleAddCommentClick = () => {
        if (!editor || editor.state.selection.empty) return;

        const { from, to } = editor.state.selection;
        setPendingCommentRange({ from, to });
        setShowCommentInput(true);
        setNewCommentText('');
        log(`Opening comment input for range ${from}-${to}`);
    };

    const handleSubmitComment = () => {
        if (!pendingCommentRange || !newCommentText.trim() || !commentsMapRef.current) return;

        const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Get the selected/quoted text from the editor
        const quotedText = editor ? editor.state.doc.textBetween(pendingCommentRange.from, pendingCommentRange.to, ' ') : '';

        const newComment: Comment = {
            id: commentId,
            authorName: userName,
            authorColor: userColor,
            authorUid: user?.uid || '',
            text: newCommentText.trim(),
            quotedText: quotedText.substring(0, 200), // Limit to 200 chars
            anchorFrom: pendingCommentRange.from,
            anchorTo: pendingCommentRange.to,
            createdAt: Date.now(),
            resolved: false,
            replies: [],
            reactions: {},
        };

        commentsMapRef.current.set(commentId, newComment);
        log(`✅ Comment added: "${newCommentText.trim().substring(0, 30)}..."`);

        setShowCommentInput(false);
        setPendingCommentRange(null);
        setNewCommentText('');
        setSelectedCommentId(commentId);
        setShowMentionDropdown(false);
    };

    // @Mention detection
    const handleCommentTextChange = (text: string, cursorPosition: number) => {
        setNewCommentText(text);

        // Check for @ mention trigger
        const textBeforeCursor = text.slice(0, cursorPosition);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);

        if (atMatch) {
            setMentionFilter(atMatch[1].toLowerCase());
            setMentionCursorPos(cursorPosition);
            setShowMentionDropdown(true);
        } else {
            setShowMentionDropdown(false);
        }
    };

    // Insert @mention
    const handleInsertMention = (userName: string) => {
        const textBeforeMention = newCommentText.slice(0, mentionCursorPos).replace(/@\w*$/, '');
        const textAfterMention = newCommentText.slice(mentionCursorPos);
        const newText = `${textBeforeMention}@${userName} ${textAfterMention}`;
        setNewCommentText(newText);
        setShowMentionDropdown(false);
        log(`📣 Mentioned @${userName}`);
    };

    // Filter online users for mention dropdown
    const filteredMentionUsers = onlineUsers.filter(u =>
        u.name.toLowerCase().includes(mentionFilter) && u.name !== userName
    );

    const handleAddReply = (commentId: string) => {
        if (!replyText.trim() || !commentsMapRef.current) return;

        const comment = commentsMapRef.current.get(commentId);
        if (!comment) return;

        const reply: CommentReply = {
            id: `reply-${Date.now()}`,
            authorName: userName,
            authorColor: userColor,
            authorUid: user?.uid || '',
            text: replyText.trim(),
            createdAt: Date.now(),
        };

        const updatedComment = { ...comment, replies: [...comment.replies, reply] };
        commentsMapRef.current.set(commentId, updatedComment);
        log(`✅ Reply added to comment`);
        setReplyText('');
    };

    const handleResolveComment = (commentId: string) => {
        if (!commentsMapRef.current) return;
        const comment = commentsMapRef.current.get(commentId);
        if (!comment) return;

        commentsMapRef.current.set(commentId, { ...comment, resolved: !comment.resolved });
        log(`Comment ${comment.resolved ? 'reopened' : 'resolved'}`);
    };

    const handleDeleteComment = (commentId: string) => {
        if (!commentsMapRef.current) return;
        commentsMapRef.current.delete(commentId);
        log(`Comment deleted`);
        if (selectedCommentId === commentId) setSelectedCommentId(null);
    };

    const handleReaction = (commentId: string, emoji: string) => {
        if (!commentsMapRef.current || !user?.uid) return;
        const comment = commentsMapRef.current.get(commentId);
        if (!comment) return;

        const reactions = { ...comment.reactions };
        const userIds = reactions[emoji] || [];

        if (userIds.includes(user.uid)) {
            // Remove reaction
            reactions[emoji] = userIds.filter(id => id !== user.uid);
            if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
            // Add reaction
            reactions[emoji] = [...userIds, user.uid];
        }

        commentsMapRef.current.set(commentId, { ...comment, reactions });
        log(`Reaction ${emoji} toggled`);
    };

    // ============== SUGGESTION HANDLERS ==============

    const handleAcceptSuggestion = (suggestionId: string) => {
        if (!suggestionsMapRef.current || !editor) return;
        const suggestion = suggestionsMapRef.current.get(suggestionId);
        if (!suggestion) return;

        // Apply the suggestion to the document
        if (suggestion.type === 'insertion') {
            // For insertions, the content is already visible - just remove the suggestion tracking
            log(`✅ Accepted insertion: "${suggestion.content.substring(0, 20)}..."`);
        } else {
            // For deletions, actually delete the content
            editor.chain().focus()
                .setTextSelection({ from: suggestion.position, to: suggestion.position + suggestion.content.length })
                .deleteSelection()
                .run();
            log(`✅ Accepted deletion`);
        }

        suggestionsMapRef.current.delete(suggestionId);
    };

    const handleRejectSuggestion = (suggestionId: string) => {
        if (!suggestionsMapRef.current || !editor) return;
        const suggestion = suggestionsMapRef.current.get(suggestionId);
        if (!suggestion) return;

        // Reverse the suggestion
        if (suggestion.type === 'insertion') {
            // For insertions, delete the inserted content
            editor.chain().focus()
                .setTextSelection({ from: suggestion.position, to: suggestion.position + suggestion.content.length })
                .deleteSelection()
                .run();
            log(`❌ Rejected insertion`);
        } else {
            // For deletions, the content is still there - just remove the suggestion tracking
            log(`❌ Rejected deletion`);
        }

        suggestionsMapRef.current.delete(suggestionId);
    };

    // ============== KEYBOARD SHORTCUTS ==============

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+Shift+M or Ctrl+Shift+M - Add comment on selection
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
                e.preventDefault();
                if (editor && !editor.state.selection.empty) {
                    handleAddCommentClick();
                    log('⌨️ Keyboard shortcut: Add comment');
                }
            }

            // Escape - Cancel comment input
            if (e.key === 'Escape' && showCommentInput) {
                e.preventDefault();
                setShowCommentInput(false);
                setPendingCommentRange(null);
                setNewCommentText('');
                log('⌨️ Keyboard shortcut: Cancel comment');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editor, showCommentInput, log]);

    // ============== PROVIDER INITIALIZATION ==============

    useEffect(() => {
        if (loading || !user?.uid || !editor) return;

        const initProvider = async () => {
            setStatus('connecting');
            log('Starting provider initialization...');

            try {
                const generateToken = httpsCallable(functions, 'generateTiptapToken');
                const result = await generateToken({ documentId: collaborationId });
                const token = (result.data as { token: string }).token;
                log('Token received');

                const provider = new HocuspocusProvider({
                    url: 'wss://bethel-collab-503876827928.us-central1.run.app',
                    name: collaborationId,
                    document: yDoc,
                    token,
                    onConnect: () => {
                        log('Provider CONNECTED!');
                        setStatus('connected');
                        setupAwarenessListeners(provider);
                        setupCommentsSync();
                        setupSuggestionsSync();
                    },
                    onDisconnect: () => {
                        log('Provider disconnected');
                        setStatus('idle');
                    },
                    onAuthenticationFailed: ({ reason }) => {
                        log(`Auth failed: ${reason}`);
                        setStatus('error');
                        setErrorMessage(`Authentication failed: ${reason}`);
                    },
                });

                providerRef.current = provider;
                provider.awareness?.setLocalStateField('user', { name: userName, color: userColor });

            } catch (err) {
                log(`Error: ${err}`);
                setStatus('error');
                setErrorMessage(String(err));
            }
        };

        const setupAwarenessListeners = (provider: HocuspocusProvider) => {
            const awareness = provider.awareness;
            if (!awareness) return;

            const handleChange = () => {
                const states = awareness.getStates();
                const localClientId = awareness.clientID;
                const cursors: RemoteCursor[] = [];
                const users: OnlineUser[] = [];

                states.forEach((state, clientId) => {
                    // Track all online users (including self)
                    if (state.user) {
                        users.push({
                            clientId,
                            name: state.user.name,
                            color: state.user.color,
                        });
                    }
                    // Track remote cursors
                    if (clientId !== localClientId && state.user && state.cursor) {
                        cursors.push({
                            clientId,
                            user: state.user,
                            anchorPos: state.cursor.anchor,
                            headPos: state.cursor.head,
                        });
                    }
                });
                setRemoteCursors(cursors);
                setOnlineUsers(users);
            };

            awareness.on('change', handleChange);
            handleChange(); // Initial call
            log('✅ Awareness listeners set up!');
        };

        const setupCommentsSync = () => {
            const commentsMap = yDoc.getMap<Comment>('comments');
            commentsMapRef.current = commentsMap;

            const updateComments = () => {
                const allComments: Comment[] = [];
                commentsMap.forEach((comment) => allComments.push(comment));
                allComments.sort((a, b) => a.createdAt - b.createdAt);
                setComments(allComments);
            };

            commentsMap.observe(updateComments);
            updateComments();
            log('✅ Comments sync set up!');
        };

        const setupSuggestionsSync = () => {
            const suggestionsMap = yDoc.getMap<Suggestion>('suggestions');
            suggestionsMapRef.current = suggestionsMap;

            const updateSuggestions = () => {
                const allSuggestions: Suggestion[] = [];
                suggestionsMap.forEach((suggestion) => allSuggestions.push(suggestion));
                allSuggestions.sort((a, b) => a.createdAt - b.createdAt);
                setSuggestions(allSuggestions);
            };

            suggestionsMap.observe(updateSuggestions);
            updateSuggestions();
            log('✅ Suggestions sync set up!');
        };

        initProvider();

        return () => {
            if (providerRef.current) {
                providerRef.current.destroy();
                providerRef.current = null;
            }
        };
    }, [loading, user?.uid, editor, yDoc, userName, userColor, log]);

    // ============== CURSOR RENDERING ==============

    const renderCursorOverlays = () => {
        if (!editor || remoteCursors.length === 0) return null;

        return remoteCursors.map(cursor => {
            try {
                const pos = cursor.headPos ?? cursor.anchorPos;
                if (pos === undefined || pos < 0) return null;
                const clampedPos = Math.min(pos, editor.state.doc.content.size);
                const coords = editor.view.coordsAtPos(clampedPos);
                if (!coords) return null;
                const editorRect = editorContainerRef.current?.getBoundingClientRect();
                if (!editorRect) return null;

                return (
                    <div key={cursor.clientId} className="absolute pointer-events-none z-50"
                        style={{ top: coords.top - editorRect.top, left: coords.left - editorRect.left }}>
                        <div className="absolute w-0.5 h-5" style={{ backgroundColor: cursor.user.color }} />
                        <div className="absolute -top-5 left-0 px-1.5 py-0.5 text-xs font-medium text-white rounded whitespace-nowrap"
                            style={{ backgroundColor: cursor.user.color }}>
                            {cursor.user.name}
                        </div>
                    </div>
                );
            } catch { return null; }
        });
    };

    // ============== COMMENT HIGHLIGHTS ==============

    const renderCommentHighlights = () => {
        if (!editor || comments.length === 0) return null;

        // Show ALL comments (both resolved and active) with different styling
        return comments.map(comment => {
            try {
                const fromPos = Math.min(comment.anchorFrom, editor.state.doc.content.size);
                const toPos = Math.min(comment.anchorTo, editor.state.doc.content.size);
                const fromCoords = editor.view.coordsAtPos(fromPos);
                const toCoords = editor.view.coordsAtPos(toPos);
                if (!fromCoords || !toCoords) return null;
                const editorRect = editorContainerRef.current?.getBoundingClientRect();
                if (!editorRect) return null;

                const isSelected = selectedCommentId === comment.id;
                const isResolved = comment.resolved;

                return (
                    <div key={comment.id} className="absolute" style={{ zIndex: isSelected ? 50 : 40 }}>
                        {/* Highlight background */}
                        <div
                            className={`absolute cursor-pointer transition-all ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900' : ''}`}
                            style={{
                                top: fromCoords.top - editorRect.top,
                                left: fromCoords.left - editorRect.left,
                                width: Math.max(toCoords.left - fromCoords.left + 4, 20),
                                height: 22,
                                backgroundColor: isResolved
                                    ? 'rgba(100, 100, 100, 0.15)'
                                    : `${comment.authorColor}30`,
                                borderBottom: isResolved
                                    ? '2px dashed rgba(100, 100, 100, 0.4)'
                                    : `2px solid ${comment.authorColor}`,
                                borderRadius: '2px',
                            }}
                            onClick={() => setSelectedCommentId(comment.id)}
                            title={`${isResolved ? '[Resolved] ' : ''}Comment by ${comment.authorName}: "${comment.text.substring(0, 50)}..."`}
                        />

                        {/* Comment bubble icon at end of highlight */}
                        <div
                            className={`absolute cursor-pointer flex items-center justify-center rounded-full text-white text-xs font-bold shadow-lg transition-transform hover:scale-110 ${isResolved ? 'opacity-50' : ''}`}
                            style={{
                                top: fromCoords.top - editorRect.top - 8,
                                left: toCoords.left - editorRect.left + 4,
                                width: 20,
                                height: 20,
                                backgroundColor: isResolved ? '#666' : comment.authorColor,
                            }}
                            onClick={() => setSelectedCommentId(comment.id)}
                            title={`Click to view comment`}
                        >
                            {isResolved ? '✓' : '💬'}
                        </div>
                    </div>
                );
            } catch { return null; }
        });
    };

    // ============== RENDER ==============

    const activeComments = comments.filter(c => !c.resolved);
    const resolvedComments = comments.filter(c => c.resolved);

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="flex">
                {/* Main Content */}
                <div className="flex-1 p-6 max-w-4xl">
                    <h1 className="text-2xl font-bold mb-4">Collaboration Test - Cursors & Comments</h1>

                    {/* Status */}
                    <div className="flex items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${status === 'connected' ? 'bg-green-500/20 text-green-400' :
                            status === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                                status === 'error' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                            }`}>
                            {status.toUpperCase()}
                        </span>

                        {/* Online Users Avatars */}
                        {onlineUsers.length > 0 && (
                            <div className="flex items-center -space-x-2">
                                {onlineUsers.slice(0, 8).map((user, idx) => (
                                    <div key={user.clientId}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-900 hover:scale-110 transition-transform cursor-default"
                                        style={{ backgroundColor: user.color, zIndex: 10 - idx }}
                                        title={user.name}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {onlineUsers.length > 8 && (
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gray-600 border-2 border-gray-900">
                                        +{onlineUsers.length - 8}
                                    </div>
                                )}
                            </div>
                        )}

                        <span className="text-xs text-gray-500">
                            {onlineUsers.length} online
                        </span>

                        {/* Suggesting Mode Toggle */}
                        <button
                            onClick={() => setSuggestingMode(!suggestingMode)}
                            className={`ml-auto px-3 py-1 rounded-lg text-sm font-medium transition flex items-center gap-2 ${suggestingMode
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                        >
                            ✏️ {suggestingMode ? 'Suggesting' : 'Editing'}
                        </button>
                    </div>

                    {/* Suggestions Panel */}
                    {suggestions.length > 0 && (
                        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-orange-400 font-medium text-sm">
                                    📝 {suggestions.length} Pending Suggestion{suggestions.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {suggestions.slice(0, 3).map(suggestion => (
                                    <div key={suggestion.id}
                                        className="flex items-center gap-2 p-2 bg-gray-800 rounded text-sm">
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                            style={{ backgroundColor: suggestion.authorColor }}>
                                            {suggestion.authorName.charAt(0).toUpperCase()}
                                        </span>
                                        <span className={`flex-1 ${suggestion.type === 'insertion' ? 'text-green-400' : 'text-red-400'}`}>
                                            {suggestion.type === 'insertion' ? '+' : '-'} &ldquo;{suggestion.content.substring(0, 30)}...&rdquo;
                                        </span>
                                        <button onClick={() => handleAcceptSuggestion(suggestion.id)}
                                            className="px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-xs">
                                            ✓
                                        </button>
                                        <button onClick={() => handleRejectSuggestion(suggestion.id)}
                                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 rounded text-xs">
                                            ✗
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4 text-red-400 text-sm">
                            {errorMessage}
                        </div>
                    )}

                    {/* Add Comment Button */}
                    {hasSelection && !showCommentInput && (
                        <button onClick={handleAddCommentClick}
                            className="mb-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition flex items-center gap-2">
                            💬 Add Comment
                            <span className="text-xs text-blue-300 opacity-70">⌘⇧M</span>
                        </button>
                    )}

                    {/* Comment Input */}
                    {showCommentInput && (
                        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700 relative">
                            <div className="relative">
                                <textarea
                                    value={newCommentText}
                                    onChange={e => handleCommentTextChange(e.target.value, e.target.selectionStart)}
                                    placeholder="Write your comment... (Type @ to mention someone)"
                                    autoFocus
                                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-sm resize-none"
                                    rows={2} />

                                {/* @Mention Dropdown */}
                                {showMentionDropdown && filteredMentionUsers.length > 0 && (
                                    <div className="absolute left-0 right-0 bottom-full mb-1 bg-gray-900 border border-gray-600 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                                        <div className="p-1 text-xs text-gray-500 border-b border-gray-700">
                                            Mention a collaborator
                                        </div>
                                        {filteredMentionUsers.map(u => (
                                            <button key={u.clientId}
                                                onClick={() => handleInsertMention(u.name)}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 transition text-left">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                    style={{ backgroundColor: u.color }}>
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm">{u.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 mt-2">
                                <button onClick={handleSubmitComment}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                                    Submit
                                </button>
                                <button onClick={() => { setShowCommentInput(false); setPendingCommentRange(null); setShowMentionDropdown(false); }}
                                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                                    Cancel
                                </button>
                                <span className="text-xs text-gray-500 ml-auto self-center">
                                    Press Esc to cancel
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Editor */}
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div ref={editorContainerRef}
                            className="relative prose prose-invert max-w-none min-h-[200px] bg-gray-900 p-4 rounded">
                            <EditorContent editor={editor} />
                            {renderCursorOverlays()}
                            {renderCommentHighlights()}
                        </div>
                    </div>

                    {/* Logs */}
                    <div className="mt-4 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                        <h3 className="text-sm font-semibold mb-2">Logs</h3>
                        <div className="font-mono text-xs space-y-0.5 max-h-32 overflow-y-auto">
                            {logs.map((l, i) => (
                                <div key={i} className={l.includes('✅') ? 'text-green-400' : l.includes('❌') ? 'text-red-400' : 'text-gray-400'}>
                                    {l}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Comments Sidebar */}
                <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 min-h-screen">
                    <h2 className="text-lg font-semibold mb-4">💬 Comments ({activeComments.length})</h2>

                    {activeComments.length === 0 ? (
                        <p className="text-gray-500 text-sm">No comments yet. Select text and click "Add Comment".</p>
                    ) : (
                        <div className="space-y-3">
                            {activeComments.map(comment => (
                                <div key={comment.id}
                                    className={`p-3 rounded-lg border transition cursor-pointer ${selectedCommentId === comment.id
                                        ? 'bg-gray-700 border-yellow-500'
                                        : 'bg-gray-750 border-gray-600 hover:border-gray-500'
                                        }`}
                                    onClick={() => setSelectedCommentId(comment.id)}>

                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                            style={{ backgroundColor: comment.authorColor }}>
                                            {comment.authorName.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-sm">{comment.authorName}</span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(comment.createdAt).toLocaleTimeString()}
                                        </span>
                                    </div>

                                    {/* Quoted Text - Click to scroll to location */}
                                    {comment.quotedText && (
                                        <div
                                            className="mb-2 p-2 bg-gray-900/50 border-l-2 rounded text-xs text-gray-400 italic cursor-pointer hover:bg-gray-900 transition-colors"
                                            style={{ borderLeftColor: comment.authorColor }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Scroll to and highlight the quoted text in editor
                                                if (editor) {
                                                    const pos = Math.min(comment.anchorFrom, editor.state.doc.content.size);
                                                    editor.chain().focus().setTextSelection({ from: comment.anchorFrom, to: comment.anchorTo }).run();
                                                    log(`Scrolled to comment location`);
                                                }
                                            }}
                                            title="Click to jump to this text in the document"
                                        >
                                            &ldquo;{comment.quotedText}&rdquo;
                                        </div>
                                    )}

                                    <p className="text-sm text-gray-300 mb-2">{comment.text}</p>

                                    {/* Emoji Reactions */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {['👍', '❤️', '🙏', '🎉', '🤔'].map(emoji => {
                                            const reactors = comment.reactions?.[emoji] || [];
                                            const hasReacted = user?.uid && reactors.includes(user.uid);
                                            return (
                                                <button key={emoji}
                                                    onClick={(e) => { e.stopPropagation(); handleReaction(comment.id, emoji); }}
                                                    className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all ${hasReacted
                                                        ? 'bg-blue-500/30 border border-blue-500'
                                                        : 'bg-gray-700 hover:bg-gray-600 border border-transparent'
                                                        }`}>
                                                    <span>{emoji}</span>
                                                    {reactors.length > 0 && <span className="text-gray-300">{reactors.length}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Replies */}
                                    {comment.replies.length > 0 && (
                                        <div className="ml-4 border-l-2 border-gray-600 pl-3 space-y-2 mb-2">
                                            {comment.replies.map(reply => (
                                                <div key={reply.id}>
                                                    <span className="font-medium text-xs" style={{ color: reply.authorColor }}>
                                                        {reply.authorName}:
                                                    </span>
                                                    <p className="text-xs text-gray-400">{reply.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Reply Input - Always visible for all users */}
                                    <div className="mt-2 flex gap-2">
                                        <input type="text"
                                            value={selectedCommentId === comment.id ? replyText : ''}
                                            onChange={e => {
                                                setSelectedCommentId(comment.id);
                                                setReplyText(e.target.value);
                                            }}
                                            placeholder="Write a reply..."
                                            className="flex-1 p-1.5 text-xs bg-gray-900 border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
                                            onKeyDown={e => e.key === 'Enter' && handleAddReply(comment.id)}
                                            onFocus={() => setSelectedCommentId(comment.id)} />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAddReply(comment.id); }}
                                            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white">
                                            Reply
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={(e) => { e.stopPropagation(); handleResolveComment(comment.id); }}
                                            className="text-xs text-green-400 hover:text-green-300">
                                            ✓ Resolve
                                        </button>
                                        {comment.authorUid === user?.uid && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                                                className="text-xs text-red-400 hover:text-red-300">
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Resolved */}
                    {resolvedComments.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-gray-500 mb-2">Resolved ({resolvedComments.length})</h3>
                            <div className="space-y-2">
                                {resolvedComments.map(comment => (
                                    <div key={comment.id} className="p-2 bg-gray-750 rounded border border-gray-700 opacity-60">
                                        <p className="text-xs text-gray-400 line-through">{comment.text}</p>
                                        <button onClick={() => handleResolveComment(comment.id)}
                                            className="text-xs text-blue-400 hover:text-blue-300 mt-1">
                                            Reopen
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
