'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Comment, CommentReply, Suggestion, OnlineUser } from '@/types/collaboration';
import { MessageSquare, X, Check, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollaborationPanelProps {
    // Data
    comments: Comment[];
    suggestions: Suggestion[];
    onlineUsers: OnlineUser[];

    // User info
    currentUserId: string;
    currentUserName: string;
    currentUserColor: string;

    // Callbacks
    onAddComment: (text: string, quotedText: string, from: number, to: number) => void;
    onAddReply: (commentId: string, text: string) => void;
    onResolveComment: (commentId: string) => void;
    onDeleteComment: (commentId: string) => void;
    onReaction: (commentId: string, emoji: string) => void;
    onAcceptSuggestion: (suggestionId: string) => void;
    onRejectSuggestion: (suggestionId: string) => void;
    onScrollToComment?: (from: number, to: number) => void;

    // State
    selectedCommentId?: string | null;
    onSelectComment?: (id: string | null) => void;
    pendingSelection?: { from: number; to: number; text: string } | null;
    onClearPendingSelection?: () => void;

    // Optional features
    suggestingMode?: boolean;
    onToggleSuggestingMode?: () => void;

    onClose?: () => void;

    className?: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '🙏', '🎉', '🤔'];

export default function CollaborationPanel({
    comments,
    suggestions,
    onlineUsers,
    currentUserId,
    currentUserName,
    currentUserColor,
    onAddComment,
    onAddReply,
    onResolveComment,
    onDeleteComment,
    onReaction,
    onAcceptSuggestion,
    onRejectSuggestion,
    onScrollToComment,
    selectedCommentId,
    onSelectComment,
    pendingSelection,
    onClearPendingSelection,
    suggestingMode,
    onToggleSuggestingMode,
    onClose,
    className,
}: CollaborationPanelProps) {
    const [newCommentText, setNewCommentText] = useState('');
    const [replyText, setReplyText] = useState('');
    const [showResolved, setShowResolved] = useState(false);

    // @Mention state
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionCursorPos, setMentionCursorPos] = useState(0);

    const activeComments = comments.filter(c => !c.resolved);
    const resolvedComments = comments.filter(c => c.resolved);

    // Handle @mention detection
    const handleCommentTextChange = (text: string, cursorPosition: number) => {
        setNewCommentText(text);

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

    const handleInsertMention = (userName: string) => {
        const textBeforeMention = newCommentText.slice(0, mentionCursorPos).replace(/@\w*$/, '');
        const textAfterMention = newCommentText.slice(mentionCursorPos);
        setNewCommentText(`${textBeforeMention}@${userName} ${textAfterMention}`);
        setShowMentionDropdown(false);
    };

    const filteredMentionUsers = onlineUsers.filter(u =>
        (u.name?.toLowerCase() || '').includes(mentionFilter) && u.name !== currentUserName
    );

    const handleSubmitComment = () => {
        console.log('[CollaborationPanel] handleSubmitComment clicked.', { newCommentText, pendingSelection });
        if (!newCommentText.trim() || !pendingSelection) {
            console.warn('[CollaborationPanel] Submission blocked: empty text or no selection.');
            return;
        }

        onAddComment(
            newCommentText.trim(),
            pendingSelection.text.substring(0, 200),
            pendingSelection.from,
            pendingSelection.to
        );

        setNewCommentText('');
        setShowMentionDropdown(false);
        onClearPendingSelection?.();
    };

    const handleSubmitReply = (commentId: string) => {
        if (!replyText.trim()) return;
        onAddReply(commentId, replyText.trim());
        setReplyText('');
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && pendingSelection) {
                e.preventDefault();
                onClearPendingSelection?.();
                setNewCommentText('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pendingSelection, onClearPendingSelection]);

    return (
        <div className={cn(
            "flex flex-col bg-gray-50 dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 h-full overflow-hidden",
            className
        )}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Comments
                        </h3>
                    </div>

                    {/* Online Users */}
                    {onlineUsers.length > 0 && (
                        <div className="flex items-center gap-1">
                            <div className="flex -space-x-2">
                                {onlineUsers.slice(0, 5).map(user => (
                                    <div key={user.clientId}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white dark:border-zinc-950"
                                        style={{ backgroundColor: user.color }}
                                        title={user.name}
                                    >
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                            <span className="text-xs text-gray-500 ml-1">
                                {onlineUsers.length}
                            </span>
                        </div>
                    )}
                </div>

                {/* Suggesting Mode Toggle */}
                {onToggleSuggestingMode && (
                    <button
                        onClick={onToggleSuggestingMode}
                        className={cn(
                            "w-full px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2",
                            suggestingMode
                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-700"
                                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                        )}
                    >
                        ✏️ {suggestingMode ? 'Suggesting Mode' : 'Editing Mode'}
                    </button>
                )}
            </div>

            {/* Suggestions Panel */}
            {suggestions.length > 0 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                    <div className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">
                        📝 {suggestions.length} Pending Suggestion{suggestions.length > 1 ? 's' : ''}
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {suggestions.slice(0, 3).map(suggestion => (
                            <div key={suggestion.id}
                                className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-800 rounded text-xs">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                    style={{ backgroundColor: suggestion.authorColor }}>
                                    {suggestion.authorName.charAt(0).toUpperCase()}
                                </span>
                                <span className={cn("flex-1 truncate", suggestion.type === 'insertion' ? 'text-green-600' : 'text-red-600')}>
                                    {suggestion.type === 'insertion' ? '+' : '-'} "{suggestion.content.substring(0, 25)}..."
                                </span>
                                <button onClick={() => onAcceptSuggestion(suggestion.id)}
                                    className="p-1 bg-green-100 hover:bg-green-200 dark:bg-green-900/50 rounded text-green-600">
                                    <Check className="w-3 h-3" />
                                </button>
                                <button onClick={() => onRejectSuggestion(suggestion.id)}
                                    className="p-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 rounded text-red-600">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* New Comment Input */}
            {pendingSelection && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                        Commenting on: "{pendingSelection.text.substring(0, 50)}..."
                    </div>
                    <div className="relative">
                        <textarea
                            value={newCommentText}
                            onChange={e => handleCommentTextChange(e.target.value, e.target.selectionStart)}
                            placeholder="Type @ to mention someone..."
                            autoFocus
                            className="w-full p-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                        />

                        {/* @Mention Dropdown */}
                        {showMentionDropdown && filteredMentionUsers.length > 0 && (
                            <div className="absolute left-0 right-0 bottom-full mb-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto">
                                {filteredMentionUsers.map(u => (
                                    <button key={u.clientId}
                                        onClick={() => handleInsertMention(u.name)}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 text-left text-sm">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                            style={{ backgroundColor: u.color }}>
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span>{u.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 mt-2">
                        <button onClick={handleSubmitComment}
                            disabled={!newCommentText.trim()}
                            className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium">
                            Comment
                        </button>
                        <button onClick={() => { onClearPendingSelection?.(); setNewCommentText(''); }}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 rounded text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activeComments.length === 0 && !pendingSelection ? (
                    <div className="text-center py-8 text-gray-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No comments yet</p>
                        <p className="text-xs mt-1">Select text and press ⌘⇧M</p>
                    </div>
                ) : (
                    activeComments.map(comment => (
                        <CommentCard
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUserId}
                            isSelected={selectedCommentId === comment.id}
                            onSelect={() => onSelectComment?.(comment.id)}
                            onResolve={() => onResolveComment(comment.id)}
                            onDelete={() => onDeleteComment(comment.id)}
                            onReaction={(emoji) => onReaction(comment.id, emoji)}
                            onScrollTo={() => onScrollToComment?.(comment.anchorFrom, comment.anchorTo)}
                            replyText={selectedCommentId === comment.id ? replyText : ''}
                            onReplyChange={(text) => { onSelectComment?.(comment.id); setReplyText(text); }}
                            onSubmitReply={() => handleSubmitReply(comment.id)}
                        />
                    ))
                )}

                {/* Resolved Comments */}
                {resolvedComments.length > 0 && (
                    <div className="pt-3 border-t border-gray-200 dark:border-zinc-800">
                        <button
                            onClick={() => setShowResolved(!showResolved)}
                            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 w-full"
                        >
                            {showResolved ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {resolvedComments.length} resolved
                        </button>

                        {showResolved && (
                            <div className="mt-2 space-y-2 opacity-60">
                                {resolvedComments.map(comment => (
                                    <CommentCard
                                        key={comment.id}
                                        comment={comment}
                                        currentUserId={currentUserId}
                                        isSelected={false}
                                        onSelect={() => { }}
                                        onResolve={() => onResolveComment(comment.id)}
                                        onDelete={() => onDeleteComment(comment.id)}
                                        onReaction={() => { }}
                                        onScrollTo={() => onScrollToComment?.(comment.anchorFrom, comment.anchorTo)}
                                        replyText=""
                                        onReplyChange={() => { }}
                                        onSubmitReply={() => { }}
                                        isResolved
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============== COMMENT CARD COMPONENT ==============

interface CommentCardProps {
    comment: Comment;
    currentUserId: string;
    isSelected: boolean;
    onSelect: () => void;
    onResolve: () => void;
    onDelete: () => void;
    onReaction: (emoji: string) => void;
    onScrollTo: () => void;
    replyText: string;
    onReplyChange: (text: string) => void;
    onSubmitReply: () => void;
    isResolved?: boolean;
}

function CommentCard({
    comment,
    currentUserId,
    isSelected,
    onSelect,
    onResolve,
    onDelete,
    onReaction,
    onScrollTo,
    replyText,
    onReplyChange,
    onSubmitReply,
    isResolved,
}: CommentCardProps) {
    const isOwner = comment.authorUid === currentUserId;

    return (
        <div
            onClick={onSelect}
            className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer relative",
                isSelected
                    ? "bg-white dark:bg-zinc-800 border-blue-300 dark:border-blue-700 ring-1 ring-blue-500/20"
                    : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600",
                // Neon glow effect based on resolved status
                isResolved
                    ? "shadow-[0_0_15px_rgba(34,197,94,0.4)] dark:shadow-[0_0_20px_rgba(34,197,94,0.5)]" // Green glow for resolved
                    : "shadow-[0_0_15px_rgba(239,68,68,0.3)] dark:shadow-[0_0_20px_rgba(239,68,68,0.4)]" // Red glow for unresolved
            )}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: comment.authorColor }}>
                    {comment.authorName.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-sm text-gray-900 dark:text-white flex-1">
                    {comment.authorName}
                </span>
                <span className="text-xs text-gray-400">
                    {new Date(comment.createdAt).toLocaleDateString()}
                </span>
            </div>

            {/* Quoted Text */}
            {comment.quotedText && (
                <div
                    onClick={(e) => { e.stopPropagation(); onScrollTo(); }}
                    className="mb-2 p-2 bg-gray-50 dark:bg-zinc-900/50 border-l-2 rounded text-xs text-gray-500 dark:text-gray-400 italic cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-900"
                    style={{ borderLeftColor: comment.authorColor }}
                    title="Click to scroll to this text"
                >
                    "{comment.quotedText}"
                </div>
            )}

            {/* Comment Text */}
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {comment.text}
            </p>

            {/* Reactions */}
            <div className="flex items-center gap-1 mb-2 flex-wrap">
                {REACTION_EMOJIS.map(emoji => {
                    const users = comment.reactions[emoji] || [];
                    const hasReacted = users.includes(currentUserId);
                    return (
                        <button key={emoji}
                            onClick={(e) => { e.stopPropagation(); onReaction(emoji); }}
                            className={cn(
                                "px-1.5 py-0.5 rounded text-xs transition",
                                hasReacted
                                    ? "bg-blue-100 dark:bg-blue-900/50"
                                    : "hover:bg-gray-100 dark:hover:bg-zinc-700"
                            )}
                        >
                            {emoji}{users.length > 0 && <span className="ml-0.5">{users.length}</span>}
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 text-xs">
                <button onClick={(e) => { e.stopPropagation(); onResolve(); }}
                    className="text-green-600 hover:text-green-700 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {isResolved ? 'Reopen' : 'Resolve'}
                </button>
                {isOwner && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="text-red-600 hover:text-red-700">
                        Delete
                    </button>
                )}
            </div>

            {/* Replies */}
            {comment.replies.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-zinc-700 space-y-2">
                    {comment.replies.map(reply => (
                        <div key={reply.id} className="flex gap-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ backgroundColor: reply.authorColor }}>
                                {reply.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="font-medium text-xs text-gray-700 dark:text-gray-300">{reply.authorName}</span>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{reply.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reply Input */}
            {!isResolved && (
                <div className="mt-2 flex gap-2">
                    <input
                        type="text"
                        value={replyText}
                        onChange={(e) => onReplyChange(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 p-1.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.key === 'Enter' && onSubmitReply()}
                    />
                    <button onClick={(e) => { e.stopPropagation(); onSubmitReply(); }}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                        Reply
                    </button>
                </div>
            )}
        </div>
    );
}
