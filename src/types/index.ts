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

export interface Sermon {
    id: string;
    title: string;
    date: { seconds: number; nanoseconds: number } | string; // Firestore Timestamp or ISO string
    videoUrl: string;
    thumbnailUrl?: string;
    summary?: string;
    outline?: string[];
    transcript?: string;
    createdAt?: any;
}

export interface Meeting {
    id: string;
    hostId: string;
    hostName: string;
    topic: string;
    description?: string;
    type: 'bible-study' | 'fellowship' | 'prayer' | 'general';
    startTime: number; // Unix timestamp
    durationMinutes: number;
    meetLink?: string; // Google Meet URL
    meetCode?: string; // For joining
    participants: string[]; // User IDs (rsvps)
    files: string[]; // URLs of shared files in "Lobby"
    bibleReference?: {
        book: string;
        chapter: number;
        verse?: number;
    };
    createdAt: number;
}
