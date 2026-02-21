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
    address?: {
        street1: string;
        street2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
    notificationSettings?: {
        posts?: boolean;
        messages?: boolean;
        sermons?: boolean;
    };
    churchId?: string; // Mandatory eventually
    role?: 'super_admin' | 'admin' | 'pastor_admin' | 'media_admin' | 'staff' | 'member' | 'ministry_leader';
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

    // Phase 2: Volunteer Management Extensions
    volunteerProfile?: VolunteerProfile;

    // Phase 3: Advanced CRM Extensions

    servingIn?: {
        ministryId: string;
        ministryName: string;
        role: "member" | "leader" | "coordinator";
        startDate: any; // Timestamp
        status: "active" | "on_break" | "inactive";
    }[];
    skills?: string[];
    // availability is already in VolunteerProfile, might be redundant or we sync them
    membershipStage?: 'active' | 'inactive' | 'visitor' | 'non-member';
    spiritualGifts?: string[];
    lastAttendance?: any; // Timestamp
    lastActive?: any; // Timestamp - last app activity
    attendanceHistory?: any[]; // Timestamp[]
    lifeEvents?: {
        eventId: string;
        eventType: string;
        isActive: boolean;
        priority: string;
    }[];
    pastoralNotes?: string; // Restricted access
    prayerRequestsList?: string[];

    // District/Shepherding Assignment
    districtId?: string;
    districtRole?: 'leader' | 'co_leader' | 'member';
}

// Family/Household Management for ChMS
export interface Family {
    id: string;
    churchId: string;
    familyName: string;

    // Structure
    headOfHouseholdId: string;
    spouseId?: string;
    childrenIds?: string[];
    otherMemberIds?: string[];

    // Shared Contact
    address?: {
        street1: string;
        street2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
    homePhone?: string;

    // Giving/Tax (IRS Compliance)
    envelopeNumber?: string;
    givingStatementAddress?: {
        street1: string;
        street2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };

    createdAt: any;
    updatedAt: any;
    createdBy: string;
}

export interface LifeEvent {
    id: string;
    memberId: string;
    memberName: string;
    familyId?: string;
    eventType:
    | "hospitalized" | "surgery" | "serious_illness"
    | "pregnancy_announced" | "baby_born"
    | "engagement" | "marriage" | "divorce"
    | "job_loss" | "new_job" | "retirement"
    | "graduation" | "college_acceptance"
    | "moved" | "death_in_family"
    | "milestone_birthday" | "anniversary"
    | "salvation" | "baptism_scheduled"
    | "other";
    eventDate: any; // Timestamp
    description: string;
    priority: "urgent" | "high" | "normal" | "low";
    requiresFollowUp: boolean;
    assignedTo?: string;
    followUpDate?: any; // Timestamp
    status: "new" | "contacted" | "visiting" | "ongoing_care" | "resolved";
    actions?: {
        date: any; // Timestamp
        actionType: "phone_call" | "visit" | "card_sent" | "meal_delivered" | "prayer";
        performedBy: string;
        notes: string;
    }[];
    // Care Tracking
    prayerRequestAdded?: boolean;
    cardSent?: boolean;
    mealTrainOrganized?: boolean;

    createdBy: string;
    createdAt: any; // Timestamp
    updatedAt: any; // Timestamp
    isActive: boolean;
}

// District/Shepherding System - For pastoral care organization
export interface District {
    id: string;
    churchId: string;

    // Naming
    name: string; // e.g., "District A" or "North Zone"

    // Leadership
    leaderId: string; // Primary leader (deacon/elder)
    leaderName?: string; // Cached for display
    coLeaderIds?: string[];

    // Members
    memberIds: string[];

    // Connected Group (for communication)
    connectedGroupId?: string; // Auto-created group for messaging

    // Assignment Method
    assignmentMethod: 'geographic' | 'alphabetic' | 'manual' | 'affinity';
    geographicBounds?: {
        zipCodes?: string[];
        neighborhoods?: string[];
    };
    alphabeticRange?: {
        startLetter: string;
        endLetter: string;
    };

    // Pipeline (optional)
    pipelineId?: string;

    // Metadata
    createdAt: any;
    updatedAt: any;
    createdBy: string;
    isActive: boolean;
}

// Church-level settings for district terminology
export interface ChurchDistrictSettings {
    enabled: boolean;
    terminology: {
        leaderSingular: string;  // "Deacon", "Elder", "Shepherd"
        leaderPlural: string;    // "Deacons", "Elders", "Shepherds"
        groupSingular: string;   // "District", "Flock", "Zone"
        groupPlural: string;     // "Districts", "Flocks", "Zones"
    };
    allowMultipleLeaders: boolean;
    autoCreateGroup: boolean;
    defaultPipelineId?: string;
}

// Terminology preset options for onboarding
export const DISTRICT_TERMINOLOGY_OPTIONS = [
    { id: 'deacon', leaderLabel: 'Deacon', groupLabel: 'District', description: 'Baptist/Traditional' },
    { id: 'elder', leaderLabel: 'Elder', groupLabel: 'Shepherding Group', description: 'Presbyterian/Reformed' },
    { id: 'shepherd', leaderLabel: 'Shepherd', groupLabel: 'Flock', description: 'Church of Christ/Non-denom' },
    { id: 'class_leader', leaderLabel: 'Class Leader', groupLabel: 'Class', description: 'Methodist' },
    { id: 'cell_leader', leaderLabel: 'Cell Leader', groupLabel: 'Cell', description: 'Cell Church/Pentecostal' },
    { id: 'care_leader', leaderLabel: 'Care Group Leader', groupLabel: 'Care Group', description: 'Non-denominational' },
    { id: 'zone_leader', leaderLabel: 'Zone Leader', groupLabel: 'Zone', description: 'Large Churches' },
    { id: 'custom', leaderLabel: '', groupLabel: '', description: 'Custom terminology' }
] as const;

// Phase 2: Volunteer Profile
export interface VolunteerProfile {
    isVolunteer: boolean;
    ministries: string[]; // e.g., ['worship', 'children', 'parking', 'hospitality']
    skills: string[]; // e.g., ['audio', 'video', 'cooking', 'teaching']
    availability: {
        sunday: boolean;
        wednesday: boolean;
        saturday: boolean;
        custom?: string[]; // e.g., ['First Sunday', 'Youth Events']
    };
    backgroundCheckStatus?: 'not_started' | 'pending' | 'approved' | 'expired';
    backgroundCheckDate?: any; // Firestore Timestamp
    trainingCompleted?: string[]; // e.g., ['child_safety', 'first_aid']
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    };
    notes?: string;
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

// =========================================
// Phase 9: Ministry Scheduling Types
// =========================================

export interface MinistryService {
    id: string;
    ministryId: string;
    name: string; // e.g. "Sunday Morning Service Feb 25"
    date: any; // Firestore Timestamp
    startTime: string; // e.g. "09:00 AM" (or we can just use the date timestamp if it includes time)
    endTime: string; // e.g. "11:00 AM"
    description?: string;
    createdBy: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export interface VolunteerSchedule {
    id: string;
    serviceId: string;
    ministryId: string; // denormalized for easier querying
    userId: string;
    role: string; // e.g. "Usher", "Greeter", "Sound Tech"
    status: 'pending' | 'accepted' | 'declined';
    statusUpdatedAt?: any; // null until they accept/decline
    notes?: string;
    createdBy: string;
    createdAt: any; // Firestore Timestamp
}

// =========================================
// Task Attachment Types (for Ministry Tasks & Personal Tasks)
// =========================================

export type TaskAttachmentSource = 'firebase' | 'google_drive_link' | 'google_drive_upload';

export interface TaskAttachment extends Attachment {
    // Storage source tracking
    source: TaskAttachmentSource;
    uploadedBy: string;
    uploadedAt: any; // Firestore Timestamp

    // Google Drive specific (optional)
    driveFileId?: string;
    driveOwnerEmail?: string;
    isPublicLink?: boolean;
    thumbnailUrl?: string;
}

// For member completion files on ministry assignments
export interface CompletionAttachment extends TaskAttachment {
    attachmentContext: 'assignment' | 'completion';
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

    // CRM Extensions (reusable for congregation management)
    pipelineStage?: 'new_guest' | 'contacted' | 'second_visit' | 'ready_for_membership' | 'converted' | string;
    boardId?: string; // Links visitor to a specific pipeline board
    tags?: string[]; // Tag IDs or names
    customFields?: Record<string, any>; // Flexible data storage
    lastActivityAt?: any; // Firestore Timestamp
    assignedTo?: string; // Admin/pastor user ID
}

// CRM System Types (reusable across visitors and members)
export interface PersonTag {
    id: string;
    name: string;
    color: string; // Hex color for visual grouping
    category?: 'visitor' | 'member' | 'volunteer' | 'custom';
    createdAt: any;
    createdBy: string;
}

export interface PersonActivity {
    id: string;
    personId: string; // Can be visitor ID or user ID
    personType: 'visitor' | 'member'; // Determines which collection
    activityType: 'status_change' | 'tag_added' | 'tag_removed' | 'note_added' | 'contacted' | 'form_submitted' | 'workflow_enrolled' | 'custom';
    description: string; // Human-readable description
    metadata?: Record<string, any>; // Extra data (e.g., old/new status, tag name, etc.)
    createdAt: any; // Firestore Timestamp
    createdBy?: string; // User ID who performed the action (null for automated)
    automated?: boolean; // True if triggered by workflow
}

export interface WorkflowTrigger {
    type: 'form_submitted' | 'tag_applied' | 'status_changed' | 'time_based' | 'custom_event';
    config: Record<string, any>; // Flexible config based on trigger type
}

export interface WorkflowAction {
    type: 'send_email' | 'send_message' | 'apply_tag' | 'change_status' | 'create_task' | 'wait';
    config: Record<string, any>; // Flexible config based on action type
    delayMinutes?: number; // Optional delay before executing
}

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    status: 'draft' | 'active' | 'paused';
    trigger: WorkflowTrigger;
    actions: WorkflowAction[];
    targetType: 'visitor' | 'member' | 'both'; // Who this workflow applies to
    createdAt: any;
    createdBy: string;
    updatedAt: any;
}

export interface WorkflowEnrollment {
    id: string;
    workflowId: string;
    personId: string;
    personType: 'visitor' | 'member';
    status: 'active' | 'completed' | 'failed';
    currentActionIndex: number;
    enrolledAt: any;
    completedAt?: any;
    nextActionAt?: any; // When the next action should run
}

// Multi-Board Pipeline System
export interface PipelineBoard {
    id: string;
    name: string;
    type: 'sunday_service' | 'event' | 'custom';
    linkedEventId?: string; // If type === 'event'
    stages: PipelineStage[];
    createdBy: string;
    createdAt: any;
    updatedAt: any;
    archived: boolean;
}

export interface PipelineStage {
    id: string;
    name: string; // Editable by admin
    order: number;
    color: string; // Hex color for visual distinction
    icon?: string; // Lucide icon name
}

export interface StageAutomation {
    id: string;
    stageId: string; // Which stage triggers this
    boardId: string; // Which board this belongs to
    type: 'send_email' | 'send_dm' | 'apply_tag' | 'create_task' | 'wait';
    config: EmailAutomationConfig | DMAutomationConfig | TagAutomationConfig;
    enabled: boolean;
    createdBy: string;
    createdAt: any;
}

export interface EmailAutomationConfig {
    templateId?: string; // References email template
    sendDelay: number; // Minutes to wait before sending (0 = immediate)
    subject: string;
    fromName: string;
    fromEmail: string;
    body: string; // HTML content
}

export interface DMAutomationConfig {
    messageTemplate: string;
    sendDelay: number; // Minutes to wait
}

export interface TagAutomationConfig {
    tagName: string;
    action: 'add' | 'remove';
}

export interface AutomationExecution {
    id: string;
    automationId: string;
    boardId: string;
    stageId: string;
    personId: string;
    personType: 'visitor' | 'member';
    executionType: 'email' | 'dm' | 'tag' | 'task';
    status: 'scheduled' | 'sending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
    scheduledFor?: any; // Firestore Timestamp
    sentAt?: any;
    deliveredAt?: any;
    openedAt?: any;
    clickedAt?: any;
    failedAt?: any;
    failureReason?: string;
    metadata: {
        emailId?: string;
        subject?: string;
        clicks?: { url: string; clickedAt: any }[];
        dmId?: string;
        tagName?: string;
    };
    createdAt: any;
}

// Connect Form Configuration
// Field types similar to Google Forms
export type ConnectFormFieldType =
    | 'short_answer'  // Single line text
    | 'paragraph'     // Multi-line text
    | 'name'          // Name field (formatted)
    | 'email'         // Email validation
    | 'phone'         // Phone number
    | 'number'        // Numeric input
    | 'date'          // Date picker
    | 'checkbox'      // Yes/No toggle
    | 'select'        // Dropdown
    | 'url'           // URL input
    // Legacy types (for backwards compatibility)
    | 'text'          // Maps to short_answer
    | 'textarea';     // Maps to paragraph

export interface ConnectFormField {
    id: string;
    type: ConnectFormFieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    enabled: boolean;
    options?: string[]; // For select type
    order: number;
}

export interface ConnectFormConfig {
    id: string;
    churchId: string;

    // Branding
    branding: {
        churchName: string;
        tagline: string;
        logoUrl?: string;
        primaryColor: string;
        backgroundColor: string;
    };

    // Form Configuration
    fields: ConnectFormField[];

    // Success State
    successMessage: {
        title: string;
        subtitle: string;
    };

    // Settings
    settings: {
        enabled: boolean;
        notifyAdmins: boolean;
        autoAssignBoard?: string; // Pipeline board ID to auto-assign
    };

    updatedAt: any;
    updatedBy: string;
}

// =========================================
// Phase 2: Pulpit Dashboard Types
// =========================================

// Pulpit Session - A service/event with teleprompter and live feed
export interface PulpitSession {
    id: string;
    churchId: string;
    date: any; // Firestore Timestamp - service date
    status: 'scheduled' | 'live' | 'completed';
    startedAt?: any; // Firestore Timestamp - when "Start Timer" was pressed

    // Sermon content for teleprompter
    sermonTitle: string;
    sermonNotes: string; // Markdown content for teleprompter display
    bibleReferences: string[]; // e.g., ["John 3:16", "Romans 8:28"]
    outline?: string[]; // Bullet points for quick reference

    // Settings
    teleprompterSettings?: {
        fontSize: number; // px
        scrollSpeed: number; // 1-10 scale
        backgroundColor: string; // hex
        textColor: string; // hex
        mirrorMode: boolean; // For physical teleprompters
    };

    // Real-time data (subcollections or embedded)
    visitorFeedEnabled: boolean;
    alertsEnabled: boolean;

    // Stats
    attendance?: number;
    visitorCount?: number;
    firstTimeVisitorCount?: number;

    createdBy: string;
    createdAt: any;
    updatedAt: any;
}

// Real-time visitor check-in for Pulpit Dashboard
export interface PulpitCheckIn {
    id: string;
    sessionId: string; // Links to PulpitSession
    churchId: string;

    // Visitor info
    visitorId?: string; // Links to /visitors collection if exists
    userId?: string; // Links to /users if registered member
    name: string;
    isFirstTime: boolean;
    photoUrl?: string;

    // Check-in details
    checkInTime: any; // Firestore Timestamp
    source: 'qr-code' | 'manual' | 'kiosk' | 'app';
    notes?: string; // e.g., "Has kids in children's ministry"
    prayerRequest?: string;

    // Status
    acknowledged: boolean; // Pastor has seen this
    acknowledgedBy?: string;
    acknowledgedAt?: any;
}

// Real-time alerts for pastor/media team
export interface PulpitAlert {
    id: string;
    sessionId: string;
    churchId: string;

    type: 'security' | 'media' | 'children' | 'parking' | 'general' | 'urgent';
    priority: 'low' | 'medium' | 'high' | 'critical';
    message: string;

    // Sender
    fromUserId: string;
    fromName: string;
    fromRole?: string; // e.g., "Security Team"

    // Status
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: any;
    resolved: boolean;
    resolvedAt?: any;

    createdAt: any;
}

// Volunteer scheduling for services
export interface ServiceVolunteerSlot {
    id: string;
    sessionId: string; // Links to PulpitSession
    churchId: string;

    ministry: string; // e.g., 'worship', 'children', 'parking'
    role: string; // e.g., 'Lead Usher', 'Sound Tech', 'Greeter'
    assignedUserId?: string;
    assignedUserName?: string;
    status: 'open' | 'filled' | 'confirmed' | 'no_show';

    notes?: string;
    createdAt: any;
    updatedAt: any;
}

// Ministry definition for volunteer management
export interface Ministry {
    id: string;
    churchId: string;
    name: string; // e.g., "Worship Team", "Children's Ministry"
    description?: string;
    icon?: string; // Lucide icon name
    color: string; // Hex color
    leaderId?: string; // User ID of ministry leader
    leaderName?: string;
    linkedGroupId?: string; // Linked Community Group for messaging
    roles: MinistryRole[];
    active: boolean;
    createdAt: any;
    updatedAt: any;
}

export interface MinistryRole {
    id: string;
    name: string; // e.g., "Vocalist", "Sound Tech", "Teacher"
    description?: string;
    requiresBackgroundCheck: boolean;
    requiredTraining?: string[]; // Training IDs
}

export interface MinistryMember {
    id: string;
    ministryId: string;
    userId: string;
    name: string;
    email?: string;
    photoURL?: string;
    role: 'Leader' | 'Member' | 'Coordinator';
    status: 'active' | 'inactive' | 'removed';

    // Audit fields
    joinedAt: any; // Timestamp
    addedBy: string;
    addedByName?: string;

    // Removal audit (populated when status = 'removed')
    removedAt?: any; // Timestamp
    removedBy?: string;
    removedByName?: string;
}

// =========================================
// Ministry Assignment System (Asana-style)
// =========================================

export type MinistryAssignmentStatus =
    | 'backlog'
    | 'assigned'
    | 'in_progress'
    | 'review'
    | 'completed'
    | 'blocked';

export interface MinistryAssignment {
    id: string;
    churchId: string;
    ministryId: string;

    // Task Details
    title: string;
    description?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';

    // People
    assignedToId?: string;
    assignedToName?: string;
    assignedById: string;
    assignedByName: string;

    // Pipeline
    status: MinistryAssignmentStatus;
    stageId: string;

    // Dates
    dueDate?: any; // Firestore Timestamp
    serviceSessionId?: string; // For service-specific tasks

    // Integration
    linkedScrollId?: string; // Fellowship collaboration
    linkedGroupPostId?: string; // Posted to ministry group
    dmConversationId?: string; // DM thread for updates
    milestoneId?: string; // Optional link to roadmap milestone

    // File Attachments
    attachments?: TaskAttachment[]; // Leader's attached files
    completionAttachments?: CompletionAttachment[]; // Member's completion files
    completionNotes?: string; // Member's notes when completing

    // Tracking
    completedAt?: any;
    completedBy?: string;
    createdAt: any;
    updatedAt: any;
    isArchived: boolean;
}

export interface MinistryPipelineBoard {
    id: string;
    ministryId: string;
    churchId: string;
    name: string;
    stages: MinistryPipelineStage[];
    isDefault: boolean;
    createdAt: any;
    updatedAt: any;
}

export interface MinistryPipelineStage {
    id: string;
    name: string;
    color: string;
    order: number;
    icon?: string;
    autoNotify?: boolean; // Notify assignee when task enters this stage
}

export const DEFAULT_MINISTRY_STAGES: Omit<MinistryPipelineStage, 'id'>[] = [
    { name: 'Backlog', order: 0, color: '#6B7280', icon: 'Inbox' },
    { name: 'Assigned', order: 1, color: '#3B82F6', icon: 'UserPlus', autoNotify: true },
    { name: 'In Progress', order: 2, color: '#F59E0B', icon: 'PlayCircle' },
    { name: 'Review', order: 3, color: '#8B5CF6', icon: 'Eye' },
    { name: 'Completed', order: 4, color: '#10B981', icon: 'CheckCircle' }
];

// =========================================
// Ministry Roadmap (Strategic Planning)
// =========================================

export type RoadmapStatus = 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed';

// Ministry Roadmap - high-level strategic plan for a ministry
export interface MinistryRoadmap {
    id: string;
    ministryId: string;
    churchId: string;
    title: string; // "2026 Worship Ministry Vision"
    description?: string;
    startDate?: any; // Firestore Timestamp
    targetEndDate?: any;
    status: RoadmapStatus;
    createdBy: string;
    createdByName: string;
    createdAt: any;
    updatedAt: any;
}

// Milestone within a roadmap
export interface RoadmapMilestone {
    id: string;
    roadmapId: string;
    ministryId: string; // Denormalized for easier queries
    title: string; // "Launch new choir"
    description?: string;
    targetDate?: any; // Firestore Timestamp
    status: MilestoneStatus;
    order: number; // For sorting milestones
    createdAt: any;
    updatedAt: any;
}

// Progress info for a milestone (computed, not stored)
export interface MilestoneProgress {
    milestoneId: string;
    totalTasks: number;
    completedTasks: number;
    percent: number; // 0-100
}

// =========================================
// Personal Tasks (for Fellowship My Tasks)
// =========================================

export interface PersonalTask {
    id: string;
    userId: string;
    churchId?: string;

    // Task Details
    title: string;
    description?: string;
    priority: 'low' | 'normal' | 'high';
    status: 'todo' | 'in_progress' | 'done';

    // Dates
    dueDate?: any; // Firestore Timestamp

    // File Attachments
    attachments?: TaskAttachment[];

    // Metadata
    createdAt: any;
    updatedAt: any;
    completedAt?: any;
    isArchived: boolean;
}

// =========================================
// Member Registration Form Types
// =========================================

// Reuse ConnectFormFieldType for consistency
export type MemberRegistrationFieldType = ConnectFormFieldType;

export interface MemberRegistrationField {
    id: string;
    type: MemberRegistrationFieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    enabled: boolean;
    options?: string[]; // For select type
    order: number;
    // Special field markers for auto-mapping
    mapsTo?: 'firstName' | 'lastName' | 'email' | 'phone' | 'address' | 'dateOfBirth' | 'custom';
}

// Family member entry for family intake section
export interface FamilyMemberEntry {
    id: string; // Temp ID for form tracking
    existingMemberId?: string; // If linking to existing member
    isExisting: boolean;
    // New member fields
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    relationship: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
    // Ministry interests for this family member
    ministryInterests?: string[]; // Ministry IDs
}

export interface MemberRegistrationFormConfig {
    id: string;
    churchId: string;

    // Branding (same as Connect Form for consistency)
    branding: {
        formTitle: string;
        tagline: string;
        logoUrl?: string;
        primaryColor: string;
        backgroundColor: string;
    };

    // Form Configuration
    fields: MemberRegistrationField[];

    // Family Intake Settings
    familyIntake: {
        enabled: boolean;
        askAboutSpouse: boolean;
        askAboutChildren: boolean;
        askAboutOtherFamily: boolean;
        maxFamilyMembers: number;
    };

    // Ministry Interest Settings
    ministrySettings: {
        enabled: boolean;
        allowMultiple: boolean;
        ministryOptions: string[]; // Ministry IDs to show
    };

    // Success State
    successMessage: {
        title: string;
        subtitle: string;
        showNextSteps?: boolean;
        nextStepsContent?: string;
    };

    // Settings
    settings: {
        enabled: boolean;
        notifyAdmins: boolean;
        autoAssignToDistrict?: boolean;
        defaultDistrictId?: string;
        defaultMembershipStage: 'visitor' | 'active' | 'inactive' | 'non-member';
        requireEmailVerification?: boolean;
        createUserAccount?: boolean; // Whether to create a user account for login
    };

    updatedAt: any;
    updatedBy: string;
}

// Submission data structure for processing
export interface MemberRegistrationSubmission {
    // Primary registrant data
    primaryMember: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        address?: {
            street1: string;
            street2?: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
        };
        dateOfBirth?: string;
        ministryInterests?: string[];
        customFields?: Record<string, any>;
    };

    // Family members to be added
    familyMembers?: FamilyMemberEntry[];

    // Metadata
    submittedAt: any;
    source: 'qr-code' | 'web' | 'kiosk' | 'manual';
    churchId: string;
}
