import { Timestamp } from 'firebase/firestore';

export type PostType = 'manual' | 'facebook' | 'youtube' | 'video';

export interface Post {
    id: string;
    type: PostType;
    content: string;
    mediaUrl?: string;
    images?: string[];
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
    attachments?: Attachment[];
    groupId?: string; // Optional: if post belongs to a group
}

export interface Attachment {
    type: 'image' | 'video' | 'file';
    url: string;
    name: string;
    mimeType: string;
    size: number;
}

export type GroupPrivacy = 'public' | 'private';
export type GroupType = 'ministry' | 'community';
export type GroupRole = 'admin' | 'moderator' | 'member';

export interface Group {
    id: string;
    name: string;
    description: string;
    bannerImage?: string;
    icon?: string;
    type: GroupType;
    privacy: GroupPrivacy;
    status: 'pending' | 'active' | 'suspended';
    tags: string[];
    location?: string;
    memberCount: number;
    lastActivityAt: any; // Firestore Timestamp
    createdBy: string;
    createdAt: any; // Firestore Timestamp
    settings?: {
        postingPermission: 'everyone' | 'admins_only';
        invitePermission: 'everyone' | 'admins_only';
        joinPolicy: 'open' | 'request';
    };
}

export interface GroupMember {
    userId: string;
    groupId: string;
    role: GroupRole;
    status: 'active' | 'invited' | 'banned' | 'pending'; // 'pending' for private requests
    joinedAt: any; // Firestore Timestamp
    user?: { // Hydrated user data for UI
        displayName: string;
        photoURL?: string;
    };
}

export interface TicketTier {
    name: string;
    price: number;
    quantity: number;
    type: 'individual' | 'table';
    seatsPerTable?: number;
}

export interface FeaturedGuest {
    name: string;
    role: string;
    imageUrl?: string;
}

export interface EventMedia {
    url: string;
    type: 'image' | 'video';
}

export interface Event {
    id: string;
    title: string;
    description: string;
    startDate: Timestamp;
    endDate?: Timestamp;
    location: string;
    geo?: {
        lat: number;
        lng: number;
        placeId: string;
    };
    featuredGuests: FeaturedGuest[];
    media: EventMedia[];
    ticketConfig?: {
        tiers: TicketTier[];
        currency: 'USD';
    };
    extractedData?: any;
    status: 'draft' | 'published' | 'past';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    // Legacy fields validation
    imageUrl?: string;
    sourcePostId?: string;

    // New Fields
    category?: 'General' | 'Meeting' | 'Bible Study' | 'Sunday School';
    landingPage?: LandingPageConfig;
}

export interface LandingPageConfig {
    enabled: boolean;
    blocks: LandingPageBlock[];
}

export type LandingPageBlock =
    | { id: string; type: 'text'; content: string; title?: string }
    | { id: string; type: 'image'; url: string; caption?: string }
    | { id: string; type: 'video'; url: string; title?: string } // url can be youtube or direct
    | { id: string; type: 'file'; url: string; name: string; size?: number }
    | { id: string; type: 'button'; label: string; url: string; style: 'primary' | 'secondary' };


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

export interface GroupEvent {
    id: string;
    groupId: string;
    title: string;
    description: string;
    startDate: any; // Firestore Timestamp
    endDate?: any; // Firestore Timestamp
    location: string;
    imageUrl?: string;
    createdBy: string;
    createdAt: any; // Firestore Timestamp
}
