export type PostType = 'manual' | 'facebook' | 'youtube';

export interface Post {
    id: string;
    type: PostType;
    content: string;
    mediaUrl?: string;
    sourceId?: string;
    timestamp: number; // Unix timestamp
    pinned?: boolean;
    author?: {
        name: string;
        avatarUrl?: string;
    };
    likes?: number;
    comments?: number;
}
