'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import * as Icons from 'lucide-react';
import { Search, Plus, Users, Settings, Heart, Church, Shield, Loader2, ArrowLeft, CalendarDays, ClipboardList, UserCircle, MessageSquare, ExternalLink, UserPlus, MoreHorizontal, UserMinus, Crown } from 'lucide-react';
import { VolunteerNav } from '@/components/Admin/VolunteerNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMinistry } from '@/context/MinistryContext';
import { MinistryModal } from '@/components/Admin/MinistryModal';
import { Ministry, MinistryAssignment, MinistryMember } from '@/types';
import { MetricCard } from '@/components/Admin/PeopleHub/MetricCard';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MinistrySelector, MinistryKanban, AssignmentModal, AddMinistryMembersModal } from '@/components/Admin/MinistryManagement';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isAdminOrPastoralStaff } from '@/lib/permissions';
import { VolunteerService } from '@/lib/volunteer-service';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// Helper to get dynamic icons
const getIcon = (iconName?: string): LucideIcon => {
    if (!iconName) return Users;
    const IconComponent = (Icons as unknown as Record<string, LucideIcon>)[iconName];
    return IconComponent || Users;
};

export default function MinistriesPage() {
    const { userData } = useAuth();
    const { ministries, loading, addMinistry, updateMinistry } = useMinistry();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMinistry, setSelectedMinistry] = useState<Ministry | null>(null);
    const [activeTab, setActiveTab] = useState('members');

    // Assignment modal state
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<MinistryAssignment | null>(null);

    // Add Members modal state
    const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);

    // Member counts for selector
    const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

    // Ministry members for the selected ministry
    const [ministryMembers, setMinistryMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Filter ministries based on user role - non-admins only see ministries they lead
    const accessibleMinistries = useMemo(() => {
        if (isAdminOrPastoralStaff(userData?.role)) {
            return ministries;
        }
        // Ministry leaders only see ministries where they are the leader
        return ministries.filter(m => m.leaderId === userData?.uid);
    }, [ministries, userData?.role, userData?.uid]);

    // Check if current user is admin
    const isAdmin = isAdminOrPastoralStaff(userData?.role);

    // Auto-select first accessible ministry
    useEffect(() => {
        if (!selectedMinistry && accessibleMinistries.length > 0) {
            setSelectedMinistry(accessibleMinistries[0]);
        }
    }, [accessibleMinistries, selectedMinistry]);

    // Fetch member counts for all ministries
    useEffect(() => {
        if (!userData?.churchId) return;

        const fetchMemberCounts = async () => {
            const counts: Record<string, number> = {};
            for (const ministry of ministries) {
                try {
                    const membersQuery = query(
                        collection(db, 'ministryMembers'),
                        where('ministryId', '==', ministry.id),
                        where('status', '==', 'active')
                    );
                    const snapshot = await getDocs(membersQuery);
                    counts[ministry.id] = snapshot.size;
                } catch (error) {
                    counts[ministry.id] = 0;
                }
            }
            setMemberCounts(counts);
        };

        if (ministries.length > 0) {
            fetchMemberCounts();
        }
    }, [ministries, userData?.churchId]);

    // Fetch members for selected ministry
    const fetchMembers = async (ministryId: string) => {
        setMembersLoading(true);
        try {
            const membersQuery = query(
                collection(db, 'ministryMembers'),
                where('ministryId', '==', ministryId),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(membersQuery);
            const members = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMinistryMembers(members);
        } catch (error) {
            console.error('Error fetching ministry members:', error);
            setMinistryMembers([]);
        } finally {
            setMembersLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedMinistry?.id) {
            setMinistryMembers([]);
            return;
        }
        fetchMembers(selectedMinistry.id);
    }, [selectedMinistry?.id]);

    // Handler to refresh members after adding
    const handleMemberAdded = () => {
        if (selectedMinistry?.id) {
            fetchMembers(selectedMinistry.id);
            // Also update the member count
            setMemberCounts(prev => ({
                ...prev,
                [selectedMinistry.id]: (prev[selectedMinistry.id] || 0) + 1
            }));
        }
    };

    const openCreateMinistry = () => {
        setSelectedMinistry(null);
        setIsModalOpen(true);
    };

    const openEditMinistry = () => {
        if (selectedMinistry) {
            setIsModalOpen(true);
        }
    };

    const handleCreateMinistry = async (data: Partial<Ministry>) => {
        await addMinistry(data as Omit<Ministry, 'id' | 'createdAt' | 'updatedAt'>);
        setIsModalOpen(false);
    };

    const handleUpdateMinistry = async (data: Partial<Ministry>) => {
        if (selectedMinistry) {
            await updateMinistry(selectedMinistry.id, data);
        }
        setIsModalOpen(false);
    };

    // Handler to remove a member from the ministry
    const handleRemoveMember = async (member: MinistryMember) => {
        // Prevent leaders from removing themselves
        if (member.userId === selectedMinistry?.leaderId) {
            toast.error('Ministry leaders cannot remove themselves. Transfer leadership first.');
            return;
        }

        if (!confirm(`Remove ${member.name} from ${selectedMinistry?.name}?`)) return;

        try {
            await VolunteerService.removeMember(
                member.id,
                userData!.uid,
                userData!.displayName || 'Unknown'
            );
            toast.success(`Removed ${member.name} from ministry`);
            // Refresh members list
            if (selectedMinistry?.id) {
                fetchMembers(selectedMinistry.id);
                // Update member count
                setMemberCounts(prev => ({
                    ...prev,
                    [selectedMinistry.id]: Math.max(0, (prev[selectedMinistry.id] || 1) - 1)
                }));
            }
        } catch (error) {
            console.error('Error removing member:', error);
            toast.error('Failed to remove member');
        }
    };

    // Assignment handlers
    const openCreateAssignment = () => {
        setSelectedAssignment(null);
        setIsAssignmentModalOpen(true);
    };

    const openEditAssignment = (assignment: MinistryAssignment) => {
        setSelectedAssignment(assignment);
        setIsAssignmentModalOpen(true);
    };

    // Metrics calculations
    const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0);
    const activeMinistries = ministries.filter(m => m.active).length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Left: Back + Title + Ministry Selector */}
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600">
                                        <Heart className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">Ministries</h1>
                                </div>

                                {/* Ministry Selector Dropdown */}
                                {!loading && accessibleMinistries.length > 0 && (
                                    <MinistrySelector
                                        ministries={accessibleMinistries}
                                        selectedMinistry={selectedMinistry}
                                        onSelectMinistry={setSelectedMinistry}
                                        memberCounts={memberCounts}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            {isAdmin && (
                                <Button variant="outline" size="sm" onClick={openCreateMinistry} className="h-8">
                                    <Plus className="w-3 h-3 mr-1" /> New Ministry
                                </Button>
                            )}
                            {selectedMinistry && isAdmin && (
                                <Button variant="ghost" size="sm" onClick={openEditMinistry}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                {/* Navigation Tabs */}
                <VolunteerNav />

                {/* Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        title="Total Ministries"
                        value={ministries.length.toString()}
                        icon={Church}
                        description="Active ministry teams"
                        change={`${activeMinistries} active`}
                        trend="neutral"
                    />
                    <MetricCard
                        title="Total Members"
                        value={totalMembers.toString()}
                        icon={Users}
                        description="Across all ministries"
                        change={selectedMinistry ? `${memberCounts[selectedMinistry.id] || 0} in ${selectedMinistry.name}` : ''}
                        trend="neutral"
                    />
                    <MetricCard
                        title="Active Roles"
                        value={ministries.reduce((acc, m) => acc + (m.roles?.length || 0), 0).toString()}
                        icon={Shield}
                        description="Volunteering positions"
                        change="+3"
                        trend="up"
                    />
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-4" />
                        <p className="text-muted-foreground">Loading ministries...</p>
                    </div>
                ) : ministries.length === 0 ? (
                    /* Empty State */
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-300 dark:border-zinc-800">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No ministries found</h3>
                        <p className="text-muted-foreground mb-6">Get started by creating your first ministry team.</p>
                        <Button onClick={openCreateMinistry} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Ministry
                        </Button>
                    </div>
                ) : selectedMinistry ? (
                    /* Tabbed Interface for Selected Ministry */
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                        {/* Ministry Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-4">
                            {(() => {
                                const MinistryIcon = getIcon(selectedMinistry.icon);
                                return (
                                    <div
                                        className="p-3 rounded-xl"
                                        style={{ backgroundColor: `${selectedMinistry.color}15` }}
                                    >
                                        <MinistryIcon
                                            className="w-6 h-6"
                                            style={{ color: selectedMinistry.color }}
                                        />
                                    </div>
                                );
                            })()}
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-foreground">{selectedMinistry.name}</h2>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                    {selectedMinistry.description || 'No description provided'}
                                </p>
                            </div>
                            <div className={cn(
                                "px-3 py-1 rounded-full text-xs font-semibold",
                                selectedMinistry.active
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                            )}>
                                {selectedMinistry.active ? 'Active' : 'Inactive'}
                            </div>
                            {/* Team Chat Button */}
                            {selectedMinistry.linkedGroupId && (
                                <Link href={`/groups/${selectedMinistry.linkedGroupId}`} target="_blank">
                                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:hover:bg-blue-900/20">
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        Team Chat
                                        <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <div className="px-6 border-b border-gray-100 dark:border-zinc-800">
                                <TabsList className="h-12 bg-transparent border-none p-0 gap-1">
                                    <TabsTrigger
                                        value="members"
                                        className={cn(
                                            "h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500",
                                            "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                                            "text-muted-foreground data-[state=active]:text-foreground font-semibold"
                                        )}
                                    >
                                        <UserCircle className="w-4 h-4 mr-2" />
                                        Members
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-zinc-800 rounded-full">
                                            {memberCounts[selectedMinistry.id] || 0}
                                        </span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="tasks"
                                        className={cn(
                                            "h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500",
                                            "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                                            "text-muted-foreground data-[state=active]:text-foreground font-semibold"
                                        )}
                                    >
                                        <ClipboardList className="w-4 h-4 mr-2" />
                                        Tasks
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="schedule"
                                        className={cn(
                                            "h-12 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500",
                                            "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                                            "text-muted-foreground data-[state=active]:text-foreground font-semibold"
                                        )}
                                    >
                                        <CalendarDays className="w-4 h-4 mr-2" />
                                        Schedule
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Members Tab */}
                            <TabsContent value="members" className="m-0">
                                <div className="p-6">
                                    {/* Search */}
                                    <div className="mb-6">
                                        <div className="relative w-full max-w-sm">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search members..."
                                                className="pl-10 h-10 bg-gray-50/50 dark:bg-zinc-950/50 border-gray-200 dark:border-zinc-700"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Members List */}
                                    {membersLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : ministryMembers.length === 0 ? (
                                        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">
                                            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                            <h3 className="font-semibold text-foreground mb-1">No members yet</h3>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Add members to this ministry to get started.
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsAddMembersModalOpen(true)}
                                            >
                                                <UserPlus className="w-4 h-4 mr-1" />
                                                Add Members
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {ministryMembers
                                                .filter(m =>
                                                    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    m.role?.toLowerCase().includes(searchTerm.toLowerCase())
                                                )
                                                .map((member) => (
                                                    <div
                                                        key={member.id}
                                                        className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-700/50 group"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white font-bold text-sm">
                                                            {member.name?.charAt(0) || '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-foreground truncate">
                                                                    {member.name || 'Unknown'}
                                                                </p>
                                                                {member.userId === selectedMinistry?.leaderId && (
                                                                    <span title="Ministry Leader">
                                                                        <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {member.role || 'Member'}
                                                            </p>
                                                        </div>
                                                        {/* Remove member dropdown - visible on hover or always on mobile */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity bg-gray-100 dark:bg-zinc-700"
                                                                >
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleRemoveMember(member as MinistryMember)}
                                                                    className="text-red-600 dark:text-red-400"
                                                                    disabled={member.userId === selectedMinistry?.leaderId}
                                                                >
                                                                    <UserMinus className="w-4 h-4 mr-2" />
                                                                    {member.userId === selectedMinistry?.leaderId
                                                                        ? 'Cannot remove leader'
                                                                        : 'Remove from Ministry'}
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                ))}
                                        </div>
                                    )}

                                </div>
                            </TabsContent>

                            {/* Tasks Tab - Kanban Board */}
                            <TabsContent value="tasks" className="m-0 h-[calc(100vh-400px)] min-h-[500px]">
                                <MinistryKanban
                                    ministry={selectedMinistry}
                                    onCreateAssignment={openCreateAssignment}
                                    onEditAssignment={openEditAssignment}
                                />
                            </TabsContent>

                            {/* Schedule Tab */}
                            <TabsContent value="schedule" className="m-0">
                                <div className="p-6">
                                    <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">
                                        <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <h3 className="font-semibold text-foreground mb-1">Schedule Coming Soon</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Service scheduling and rotation management will be available here.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                ) : (
                    /* No Ministry Selected */
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800">
                        <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">Select a Ministry</h3>
                        <p className="text-muted-foreground">Choose a ministry from the dropdown to view details.</p>
                    </div>
                )}
            </div>

            {/* Ministry Create/Edit Modal */}
            <MinistryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                ministry={selectedMinistry}
                onSave={selectedMinistry && !isModalOpen ? handleUpdateMinistry : handleCreateMinistry}
            />

            {/* Assignment Create/Edit Modal */}
            {selectedMinistry && (
                <AssignmentModal
                    isOpen={isAssignmentModalOpen}
                    onClose={() => {
                        setIsAssignmentModalOpen(false);
                        setSelectedAssignment(null);
                    }}
                    ministry={selectedMinistry}
                    assignment={selectedAssignment}
                />
            )}

            {/* Add Members Modal */}
            {selectedMinistry && (
                <AddMinistryMembersModal
                    isOpen={isAddMembersModalOpen}
                    onClose={() => setIsAddMembersModalOpen(false)}
                    ministry={selectedMinistry}
                    existingMemberIds={ministryMembers.map(m => m.userId)}
                    onMemberAdded={handleMemberAdded}
                />
            )}
        </div>
    );
}
