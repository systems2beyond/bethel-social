import { Timestamp } from 'firebase/firestore';

export type PostType = 'manual' | 'facebook' | 'youtube' | 'video';

// [MULTI-CHURCH] Core Church Definition
export interface Church {
    id: string; // e.g. "bethel-metro"
    name: string;
    subdomain: string; // e.g. "bethel"
    theme: {
        primaryColor: string; // Hex code
        logoUrl: string;
    };
    config: {
        googleMapsApiKey?: string;
        facebookAppId?: string;
        stripeAccountId?: string;
    };
    connectedChurchIds: string[]; // Federation
    createdAt: any;
}

// [MULTI-CHURCH] User Schema
export interface FirestoreUser {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
    notificationSettings?: {
        posts?: boolean;
        messages?: boolean;
        sermons?: boolean;
    };
    churchId?: string; // Mandatory eventually
    role?: 'super_admin' | 'admin' | 'staff' | 'member';
    connectedChurchIds?: string[];
    customBibleSources?: any[]; // For custom bible versions
    theme?: string;
    createdAt?: any;

    // Phase 1: Member Lifecycle Extensions
    lifecycleStage?: 'visitor' | 'regular' | 'member' | 'leader';
    familyId?: string;
    customFields?: Record<string, any>; // e.g. { allergies: "peanuts" }
    sacraments?: {
        baptism?: { date: any; officiant: string; location: string };
        confirmation?: { date: any };
    };
}

export interface Post {
    id: string;
    churchId?: string; // [MULTI-CHURCH] Optional during migration
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
    churchId?: string; // [MULTI-CHURCH]
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
    linkedEventId?: string; // LINKED EVENT
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
    mediaType?: 'image' | 'video'; // Normalize naming
}

export interface Event {
    id: string;
    churchId?: string; // [MULTI-CHURCH]
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
    linkedGroupId?: string; // LINKED GROUP
    linkedCampaignId?: string; // LINKED CAMPAIGN (For donations)
    registrationConfig?: RegistrationConfig;
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

export interface SuggestedEvent {
    id: string; // usually postId
    title: string;
    description: string;
    date: Timestamp;
    location: string;
    imageUrl?: string;
    sourcePostId: string;
    createdAt: Timestamp;
    status: 'pending' | 'approved' | 'rejected';
    extractedData: any;
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
    type?: string;
    metadata?: any;
}

export interface Sermon {
    id: string;
    churchId?: string; // [MULTI-CHURCH]
    title: string;
    date: { seconds: number; nanoseconds: number } | string; // Firestore Timestamp or ISO string
    videoUrl: string;
    thumbnailUrl?: string;
    summary?: string;
    outline?: string[];
    transcript?: string;
    createdAt?: any;
    source?: 'youtube' | 'upload';
    driveFileId?: string;
}

export interface Meeting {
    id: string;
    churchId?: string; // [MULTI-CHURCH]
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
    status: 'scheduled' | 'active' | 'completed';
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

export type RegistrationFieldType = 'text' | 'email' | 'phone' | 'number' | 'select' | 'checkbox';

export interface RegistrationField {
    id: string;
    label: string;
    type: RegistrationFieldType;
    required: boolean;
    options?: string[]; // For 'select' type
    placeholder?: string;
}

export interface RegistrationConfig {
    enabled: boolean;
    capacity?: number;
    closeDate?: Timestamp;
    fields: RegistrationField[];
    ticketPrice?: number; // Simple flat price for now
    currency?: string; // e.g., 'USD'
}

export interface EventRegistration {
    id: string;
    eventId: string;
    userId?: string; // Optional (guest checkout)
    userEmail: string;
    userName: string;
    responses: Record<string, any>; // Keyed by field ID
    status: 'confirmed' | 'cancelled' | 'waitlist' | 'paid';
    ticketCount?: number;
    totalAmount?: number;
    tipAmount?: number;
    paymentStatus?: 'paid' | 'pending' | 'failed';
    paymentIntentId?: string;
    createdAt: Timestamp;
}

export interface Campaign {
    id: string;
    churchId?: string; // [MULTI-CHURCH]
    name: string;
    description?: string;
    createdAt?: any;
}

// Phase 1: Visitor Pipeline
export interface Visitor {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    status: 'new' | 'contacted' | 'merged' | 'archived';
    createdAt: any; // Firestore Timestamp
    notes?: string;
    prayerRequests?: string;
    isFirstTime?: boolean;
    source?: 'qr-code' | 'manual' | 'website';
    auditLog?: { timestamp: any; action: string; note?: string }[];
}
