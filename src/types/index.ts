export type PostType = 'manual' | 'facebook' | 'youtube' | 'video';

export interface Post {
    id: string;
    type: PostType;
    content: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    sourceId?: string;
    timestamp: number; // Unix timestamp
    pinned?: boolean;
    author?: {
        name: string;
        avatarUrl?: string;
    };
    likes?: number;
    comments?: number;
    externalUrl?: string;
}

export interface Event {
    id: string;
    title: string;
    description: string;
    date: { seconds: number; nanoseconds: number };
    location: string;
    imageUrl?: string;
    sourcePostId: string;
    extractedData?: {
        isEvent: boolean;
        title?: string;
        date?: string;
        time?: string;
        location?: string;
        description?: string;
    };
}

export interface Comment {
    id: string;
    postId: string;
    author: {
        id: string;
        name: string;
        avatarUrl?: string;
    };
    content: string;
    timestamp: number;
    isAi?: boolean;
    parentId?: string; // For nested replies
    likes?: number;
}
