"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    Search,
    ArrowLeft,
    ShieldCheck,
    MessageSquare,
    Heart,
    Users,
    AlertCircle,
    Clock,
    UserX,
    ChevronDown,
    Plus
} from "lucide-react";
import { MemberTable } from '@/components/Admin/PeopleHub/MemberTable';
import { FirestoreUser, District, LifeEvent } from '@/types';
import { QuickMessageModal } from '@/components/Admin/MinistryCRM/QuickMessageModal';
import { LifeEventModal } from '@/components/Admin/PeopleHub/LifeEventModal';
import { MemberProfileModal } from '@/components/Admin/PeopleHub/MemberProfileModal';
import { DistrictModal } from '@/components/Admin/PeopleHub/DistrictModal';
import { FamilyModal } from '@/components/Admin/PeopleHub/FamilyModal';
import { AssignDistrictModal } from '@/components/Admin/PeopleHub/AssignDistrictModal';
import { DistrictService } from '@/lib/services/DistrictService';
import { toast } from 'sonner';
import { MessageDistrictModal } from '@/components/Admin/PeopleHub/MessageDistrictModal';

// Stats card component
const StatCard = ({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) => (
    <div className={cn(
        "flex items-center gap-4 px-5 py-4 rounded-2xl",
        "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm",
        "border border-gray-200/50 dark:border-zinc-700/50",
        "shadow-[0_4px_20px_rgb(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)]",
        "hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]",
        "transition-all duration-300 hover:-translate-y-0.5"
    )}>
        <div className={cn("p-3 rounded-xl", color)}>
            <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        </div>
    </div>
);

// Life Event Card
const LifeEventCard = ({ event, memberName, priority, onClick }: { event: any; memberName: string; priority: string; onClick?: () => void }) => {
    const priorityColors = {
        urgent: 'bg-red-500',
        high: 'bg-orange-500',
        normal: 'bg-blue-500',
        low: 'bg-gray-400'
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                onClick && "cursor-pointer"
            )}
        >
            <div className={cn("w-2 h-2 rounded-full mt-2", priorityColors[priority as keyof typeof priorityColors] || priorityColors.normal)} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{memberName}</span>
                    <Badge variant="outline" className="text-xs capitalize">{event.eventType?.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
            </div>
        </div>
    );
};

export default function DistrictCRMPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [district, setDistrict] = useState<District | null>(null);
    const [availableDistricts, setAvailableDistricts] = useState<District[]>([]);
    const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
    const [members, setMembers] = useState<FirestoreUser[]>([]);
    const [allMembers, setAllMembers] = useState<FirestoreUser[]>([]);
    const [allLifeEvents, setAllLifeEvents] = useState<LifeEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [selectedMemberForMessage, setSelectedMemberForMessage] = useState<FirestoreUser | null>(null);
    const [isLifeEventModalOpen, setIsLifeEventModalOpen] = useState(false);
    const [selectedMemberForLifeEvent, setSelectedMemberForLifeEvent] = useState<string | undefined>(undefined);

    // Profile Modal State
    const [isMemberProfileOpen, setIsMemberProfileOpen] = useState(false);
    const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<FirestoreUser | null>(null);

    // District Modal State (for creating new districts)
    const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);

    // Family Modal State
    const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
    const [selectedFamilyId, setSelectedFamilyId] = useState<string | undefined>(undefined);
    const [selectedMemberForFamily, setSelectedMemberForFamily] = useState<string | undefined>(undefined);

    // Assign District Modal State
    const [isAssignDistrictModalOpen, setIsAssignDistrictModalOpen] = useState(false);
    const [selectedMemberForAssignDistrict, setSelectedMemberForAssignDistrict] = useState<FirestoreUser | null>(null);

    const [showMessageAllModal, setShowMessageAllModal] = useState(false);

    // Check if user is admin (can see all districts) - case-insensitive check
    const userRole = userData?.role?.toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'pastor_admin';

    // Fetch all users once
    useEffect(() => {
        const fetchAllUsers = async () => {
            try {
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const users = usersSnapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                })) as FirestoreUser[];
                setAllMembers(users);
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };
        fetchAllUsers();
    }, []);

    // Fetch available districts and set initial selection
    useEffect(() => {
        const fetchAvailableDistricts = async () => {
            if (!user?.uid) return;

            try {
                const churchId = userData?.churchId || 'default';
                const allDistricts = await DistrictService.getDistricts(churchId);

                // Filter districts based on user role
                let accessibleDistricts: District[];
                if (isAdmin) {
                    // Admins can see all districts
                    accessibleDistricts = allDistricts;
                } else {
                    // Regular users can only see districts they lead or co-lead
                    accessibleDistricts = allDistricts.filter(d =>
                        d.leaderId === user.uid ||
                        d.coLeaderIds?.includes(user.uid)
                    );
                }

                setAvailableDistricts(accessibleDistricts);

                // Set initial selection
                if (accessibleDistricts.length > 0) {
                    // Try to select user's primary district first
                    const myLedDistrict = accessibleDistricts.find(d => d.leaderId === user.uid);
                    const myCoLedDistrict = accessibleDistricts.find(d => d.coLeaderIds?.includes(user.uid));
                    const initialDistrict = myLedDistrict || myCoLedDistrict || accessibleDistricts[0];

                    setSelectedDistrictId(initialDistrict.id);
                    setDistrict(initialDistrict);
                } else {
                    setDistrict(null);
                }
            } catch (error) {
                console.error('Error fetching districts:', error);
                toast.error('Failed to load districts');
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading && user?.uid) {
            fetchAvailableDistricts();
        }
    }, [authLoading, user?.uid, userData?.churchId, isAdmin]);

    // Fetch district members and life events when selection changes
    useEffect(() => {
        const fetchDistrictData = async () => {
            if (!selectedDistrictId || allMembers.length === 0) return;

            try {
                const currentDistrict = availableDistricts.find(d => d.id === selectedDistrictId);
                if (!currentDistrict) return;

                setDistrict(currentDistrict);

                // Filter members for selected district
                const memberIds = currentDistrict.memberIds || [];
                const districtMembers = allMembers.filter(u => memberIds.includes(u.uid));
                setMembers(districtMembers);

                // Fetch life events for district members
                if (memberIds.length > 0) {
                    const lifeEventsQuery = query(
                        collection(db, 'lifeEvents'),
                        where('memberId', 'in', memberIds.slice(0, 10)) // Firestore limitation
                    );
                    const eventsSnapshot = await getDocs(lifeEventsQuery);
                    const events = eventsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })) as LifeEvent[];
                    setAllLifeEvents(events.filter(e => e.isActive));
                } else {
                    setAllLifeEvents([]);
                }
            } catch (error) {
                console.error('Error fetching district data:', error);
            }
        };

        fetchDistrictData();
    }, [selectedDistrictId, availableDistricts, allMembers]);

    // Handle district change from dropdown
    const handleDistrictChange = (districtId: string) => {
        setSelectedDistrictId(districtId);
    };

    const handleMessage = (memberId: string) => {
        const member = members.find(m => m.uid === memberId);
        if (member) {
            setSelectedMemberForMessage(member);
            setIsMessageModalOpen(true);
        }
    };

    const handleViewProfile = (memberId: string) => {
        const member = members.find(m => m.uid === memberId);
        if (member) {
            setSelectedMemberForProfile(member);
            setIsMemberProfileOpen(true);
        }
    };

    const handleAddLifeEvent = (memberId: string) => {
        setSelectedMemberForLifeEvent(memberId);
        setIsLifeEventModalOpen(true);
    };

    const handleOpenFamilyModal = (memberId: string, familyId?: string) => {
        setSelectedMemberForFamily(memberId);
        setSelectedFamilyId(familyId);
        setIsFamilyModalOpen(true);
    };

    const handleOpenAssignDistrictModal = (memberId: string) => {
        const member = members.find(m => m.uid === memberId);
        if (member) {
            setSelectedMemberForAssignDistrict(member);
            setIsAssignDistrictModalOpen(true);
        }
    };

    const refreshData = async () => {
        if (!district) return;
        // Re-fetch all users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        })) as FirestoreUser[];
        setAllMembers(users);

        // Filter for current district
        const memberIds = district.memberIds || [];
        const districtMembers = users.filter(u => memberIds.includes(u.uid));
        setMembers(districtMembers);
    };

    // Filter members
    const filteredMembers = members.filter(m => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        return (
            m.displayName?.toLowerCase().includes(searchLower) ||
            m.email?.toLowerCase().includes(searchLower)
        );
    });

    // Calculate stats
    const totalMembers = members.length;
    const activeEvents = allLifeEvents.filter(e => e.isActive).length;
    const urgentEvents = allLifeEvents.filter(e => e.priority === 'urgent' || e.priority === 'high').length;

    // Members inactive for 30+ days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inactiveMembers = members.filter(m => {
        if (!m.lastActive && !m.lastAttendance) return true;
        const lastDate = m.lastActive || m.lastAttendance;
        const date = lastDate?.seconds ? new Date(lastDate.seconds * 1000) : new Date(lastDate);
        return date < thirtyDaysAgo;
    }).length;

    // No district assigned view
    if (!loading && !district) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="inline-flex p-4 rounded-full bg-amber-50 dark:bg-amber-900/20 mb-4">
                        <ShieldCheck className="h-12 w-12 text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">No District Assigned</h2>
                    <p className="text-muted-foreground mb-6">
                        You are not currently assigned as a leader to any pastoral care district.
                        Please contact your church administrator to be assigned.
                    </p>
                    <Link href="/admin/people-hub">
                        <Button variant="outline" className="rounded-xl">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to People Hub
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin/people-hub"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                                        <ShieldCheck className="h-4 w-4 text-white" />
                                    </div>

                                    {/* District Selector Dropdown - always show if districts exist */}
                                    {availableDistricts.length > 0 ? (
                                        <Select value={selectedDistrictId} onValueChange={handleDistrictChange}>
                                            <SelectTrigger className="h-9 w-[220px] rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 font-bold text-lg">
                                                <SelectValue placeholder="Select district" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {availableDistricts.map(d => (
                                                    <SelectItem key={d.id} value={d.id}>
                                                        <div className="flex items-center gap-2">
                                                            <span>{d.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                ({d.memberIds?.length || 0})
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <h1 className="text-xl font-bold text-foreground">
                                            {loading ? 'Loading...' : district?.name || 'My District'}
                                        </h1>
                                    )}

                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                        {totalMembers} members
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {isAdmin ? 'Manage pastoral care districts' : 'Pastoral care dashboard for your assigned district'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                    onClick={() => setIsDistrictModalOpen(true)}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create District
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => {
                                    setSelectedMemberForLifeEvent(undefined);
                                    setIsLifeEventModalOpen(true);
                                }}
                            >
                                <Heart className="h-4 w-4 mr-2" />
                                Log Life Event
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setShowMessageAllModal(true)}
                                className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md active:scale-95 transition-all"
                            >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Message All
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {loading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <Skeleton key={i} className="h-24 rounded-2xl" />
                            ))}
                        </div>
                        <Skeleton className="h-64 rounded-2xl" />
                    </div>
                ) : (
                    <>
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="District Members" value={totalMembers} color="bg-amber-500" icon={Users} />
                            <StatCard label="Active Life Events" value={activeEvents} color="bg-rose-500" icon={Heart} />
                            <StatCard label="Urgent/High Priority" value={urgentEvents} color="bg-red-500" icon={AlertCircle} />
                            <StatCard label="Inactive (30+ days)" value={inactiveMembers} color="bg-gray-500" icon={UserX} />
                        </div>

                        {/* Active Life Events Panel */}
                        {allLifeEvents.length > 0 && (
                            <div className="rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 p-5">
                                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <Heart className="h-4 w-4 text-rose-500" />
                                    Active Life Events
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {allLifeEvents.slice(0, 6).map(event => {
                                        const member = members.find(m => m.uid === event.memberId);
                                        return (
                                            <LifeEventCard
                                                key={event.id}
                                                event={event}
                                                memberName={member?.displayName || event.memberName || 'Unknown'}
                                                priority={event.priority}
                                                onClick={() => handleViewProfile(event.memberId)}
                                            />
                                        );
                                    })}
                                </div>
                                {allLifeEvents.length > 6 && (
                                    <Button variant="ghost" size="sm" className="mt-3 w-full rounded-xl">
                                        View all {allLifeEvents.length} events
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search district members..."
                                className="pl-10 rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-gray-200/50 dark:border-zinc-700/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Members Table */}
                        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                            {filteredMembers.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="inline-flex p-4 rounded-full bg-amber-50 dark:bg-amber-900/20 mb-4">
                                        <Users className="h-8 w-8 text-amber-400" />
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-2">No members found</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        {searchQuery ? 'Try adjusting your search query' : 'Your district has no members assigned yet'}
                                    </p>
                                </div>
                            ) : (
                                <MemberTable
                                    members={filteredMembers}
                                    loading={false}
                                    onMessage={handleMessage}
                                    onViewProfile={handleViewProfile}
                                    onAddLifeEvent={handleAddLifeEvent}
                                    onRoleUpdate={refreshData}
                                    onOpenFamilyModal={handleOpenFamilyModal}
                                    onOpenDistrictModal={handleOpenAssignDistrictModal}
                                    districts={availableDistricts}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Modals */}
            {selectedMemberForMessage && (
                <QuickMessageModal
                    isOpen={isMessageModalOpen}
                    onClose={() => setIsMessageModalOpen(false)}
                    recipient={selectedMemberForMessage}
                />
            )}

            <LifeEventModal
                isOpen={isLifeEventModalOpen}
                onClose={() => {
                    setIsLifeEventModalOpen(false);
                    setSelectedMemberForLifeEvent(undefined);
                }}
                memberId={selectedMemberForLifeEvent}
                members={members}
                onSuccess={refreshData}
            />

            {/* Member Profile Modal */}
            <MemberProfileModal
                open={isMemberProfileOpen}
                onOpenChange={(open) => {
                    setIsMemberProfileOpen(open);
                    if (!open) {
                        setSelectedMemberForProfile(null);
                    }
                }}
                member={selectedMemberForProfile}
                districts={availableDistricts}
                onSuccess={refreshData}
                onMessage={(member) => {
                    setSelectedMemberForMessage(member);
                    setIsMessageModalOpen(true);
                }}
                onAddLifeEvent={(memberId) => {
                    setSelectedMemberForLifeEvent(memberId);
                    setIsLifeEventModalOpen(true);
                }}
                onAssignDistrict={(memberId) => {
                    handleOpenAssignDistrictModal(memberId);
                }}
                onAssignFamily={(memberId, familyId) => {
                    setSelectedMemberForFamily(memberId);
                    setSelectedFamilyId(familyId);
                    setIsFamilyModalOpen(true);
                }}
            />

            {/* District Modal (for creating new districts) */}
            {isAdmin && (
                <DistrictModal
                    open={isDistrictModalOpen}
                    onOpenChange={setIsDistrictModalOpen}
                    members={allMembers}
                    onSuccess={async () => {
                        // Refresh districts after creating
                        const churchId = userData?.churchId || 'default';
                        const allDistricts = await DistrictService.getDistricts(churchId);
                        setAvailableDistricts(allDistricts);
                    }}
                />
            )}

            {/* Family Modal */}
            <FamilyModal
                open={isFamilyModalOpen}
                onOpenChange={(open) => {
                    setIsFamilyModalOpen(open);
                    if (!open) {
                        setSelectedMemberForFamily(undefined);
                        setSelectedFamilyId(undefined);
                    }
                }}
                familyId={selectedFamilyId}
                preSelectedMemberId={selectedMemberForFamily}
                members={allMembers}
                onSuccess={refreshData}
            />

            {/* Assign District Modal */}
            <AssignDistrictModal
                open={isAssignDistrictModalOpen}
                onOpenChange={(open) => {
                    setIsAssignDistrictModalOpen(open);
                    if (!open) {
                        setSelectedMemberForAssignDistrict(null);
                    }
                }}
                member={selectedMemberForAssignDistrict}
                districts={availableDistricts}
                onSuccess={refreshData}
            />
            {/* Message District Modal */}
            <MessageDistrictModal
                open={showMessageAllModal}
                onOpenChange={setShowMessageAllModal}
                recipients={members}
                districtName={district?.name || 'District'}
                onSuccess={() => setShowMessageAllModal(false)}
            />
        </div>
    );
}
