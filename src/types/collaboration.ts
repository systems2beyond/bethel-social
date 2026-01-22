/**
 * Shared types for collaboration features
 * Used by TiptapEditor, CollaborationPanel, and Notes page
 */

export interface CommentReply {
    id: string;
    authorName: string;
    authorColor: string;
    authorUid: string;
    text: string;
    createdAt: number;
}

export interface Comment {
    id: string;
    authorName: string;
    authorColor: string;
    authorUid: string;
    text: string;
    quotedText: string;
    anchorFrom: number;
    anchorTo: number;
    createdAt: number;
    resolved: boolean;
    replies: CommentReply[];
    reactions: { [emoji: string]: string[] };
}

export interface Suggestion {
    id: string;
    type: 'insertion' | 'deletion';
    authorName: string;
    authorColor: string;
    authorUid: string;
    content: string;
    position: number;
    createdAt: number;
}

export interface OnlineUser {
    clientId: number;
    name: string;
    color: string;
}
