
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canAccessPeopleHub } from '@/lib/permissions';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    Search,
    Filter,
    UserPlus,
    ArrowLeft,
    Users,
    Download,
    MoreHorizontal,
    ChevronDown,
    Mail,
    Phone,
    Heart
} from "lucide-react";
import { MemberTable } from '@/components/Admin/PeopleHub/MemberTable';
import { FirestoreUser } from '@/types';
import { QuickMessageModal } from '@/components/Admin/MinistryCRM/QuickMessageModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AddMemberModal } from '@/components/Admin/PeopleHub/AddMemberModal';
import { FamilyModal } from '@/components/Admin/PeopleHub/FamilyModal';
import { LifeEventModal } from '@/components/Admin/PeopleHub/LifeEventModal';
import { BulkMessageModal } from '@/components/Admin/PeopleHub/BulkMessageModal';
import { toast } from 'sonner';

// Stats card component
const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border",
        "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800"
    )}>
        <div className={cn("w-2 h-8 rounded-full", color)} />
        <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    </div>
);

export default function MembersDirectoryPage() {
    const { userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<FirestoreUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'staff' | 'leader' | 'member' | 'visitor'>('all');

    // Modal States
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [selectedMemberForMessage, setSelectedMemberForMessage] = useState<FirestoreUser | null>(null);

    // Family Modal State
    const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
    const [selectedFamilyId, setSelectedFamilyId] = useState<string | undefined>(undefined);
    const [selectedMemberForFamily, setSelectedMemberForFamily] = useState<string | undefined>(undefined);

    // Life Event Modal State
    const [isLifeEventModalOpen, setIsLifeEventModalOpen] = useState(false);
    const [selectedMemberForLifeEvent, setSelectedMemberForLifeEvent] = useState<string | undefined>(undefined);

    // Bulk Message Modal State
    const [isBulkMessageOpen, setIsBulkMessageOpen] = useState(false);


    // Fetch real members from Firestore
    const fetchMembers = async () => {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersData = usersSnapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            })) as FirestoreUser[];
            setMembers(usersData);
        } catch (error) {
            console.error('Error fetching members:', error);
            // In dev mode with simulated user, provide mock data if Firestore fails
            if (process.env.NODE_ENV === 'development') {
                console.log('DEV: Using mock member data due to Firestore error');
                setMembers([
                    {
                        uid: 'mock-1',
                        email: 'john.smith@example.com',
                        displayName: 'John Smith',
                        role: 'member',
                        membershipStage: 'active',
                        phoneNumber: '555-0101'
                    },
                    {
                        uid: 'mock-2',
                        email: 'jane.doe@example.com',
                        displayName: 'Jane Doe',
                        role: 'admin',
                        membershipStage: 'active',
                        phoneNumber: '555-0102'
                    },
                    {
                        uid: 'mock-3',
                        email: 'bob.wilson@example.com',
                        displayName: 'Bob Wilson',
                        role: 'visitor',
                        membershipStage: 'visitor',
                        phoneNumber: '555-0103'
                    }
                ] as FirestoreUser[]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;

        if (!userData || !canAccessPeopleHub(userData.role)) {
            // Access check - for now allow through for dev
        }
        fetchMembers();
    }, [authLoading, userData]);

    const handleExportCSV = () => {
        const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Status', 'Last Attendance'];
        const csvContent = [
            headers.join(','),
            ...filteredMembers.map(m => {
                const nameParts = (m.displayName || '').split(' ');
                const fName = nameParts[0] || '';
                const lName = nameParts.slice(1).join(' ') || '';
                const lastAttended = m.lastAttendance
                    ? (m.lastAttendance.toDate ? m.lastAttendance.toDate().toLocaleDateString() : new Date(m.lastAttendance as any).toLocaleDateString())
                    : 'Never';

                return [
                    `"${fName}"`,
                    `"${lName}"`,
                    `"${m.email || ''}"`,
                    `"${m.phoneNumber || ''}"`,
                    `"${m.role || 'member'}"`,
                    `"${m.membershipStage || 'active'}"`,
                    `"${lastAttended}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `members_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Export complete');
    };

    const handleExportPhoneList = () => {
        const membersWithPhones = filteredMembers.filter(m => m.phoneNumber);
        if (membersWithPhones.length === 0) {
            toast.error('No phone numbers to export');
            return;
        }

        const headers = ['Name', 'Phone'];
        const csvContent = [
            headers.join(','),
            ...membersWithPhones.map(m => [
                `"${m.displayName || m.email || 'Unknown'}"`,
                `"${m.phoneNumber}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `phone_list_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${membersWithPhones.length} phone numbers`);
    };

    const handleOpenBulkMessage = () => {
        if (filteredMembers.length === 0) {
            toast.error('No members to message');
            return;
        }
        setIsBulkMessageOpen(true);
    };

    const handleOpenLifeEventFromMenu = () => {
        setSelectedMemberForLifeEvent(undefined); // Open without pre-selected member
        setIsLifeEventModalOpen(true);
    };

    const handleMessage = (memberId: string) => {
        const member = members.find(m => m.uid === memberId);
        if (member) {
            setSelectedMemberForMessage(member);
            setIsMessageModalOpen(true);
        }
    };

    const handleViewProfile = (memberId: string) => {
        // Open message modal to send a direct message to this member
        const member = members.find(m => m.uid === memberId);
        if (member) {
            setSelectedMemberForMessage(member);
            setIsMessageModalOpen(true);
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

    // Filter members based on search query
    const filteredMembers = members.filter(m => {
        const searchLower = searchQuery.toLowerCase();
        const phoneDigits = searchQuery.replace(/[^0-9]/g, '');
        const matchesSearch = !searchQuery ||
            m.displayName?.toLowerCase().includes(searchLower) ||
            m.email?.toLowerCase().includes(searchLower) ||
            (phoneDigits && m.phoneNumber?.replace(/[^0-9]/g, '').includes(phoneDigits));

        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && m.membershipStage === 'active') || // Adjust logic if 'status' field differs
            (filterStatus === 'inactive' && m.membershipStage !== 'active');

        const matchesRole = filterRole === 'all' || m.role === filterRole;

        return matchesSearch && matchesStatus && matchesRole;
    });

    // Stats calculation
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalMembers = members.length;
    const activeMembers = members.filter(m => {
        if (m.lastAttendance) {
            const last = m.lastAttendance.toDate ? m.lastAttendance.toDate() : new Date(m.lastAttendance);
            return last > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Active if attended in last 30 days
        }
        return m.createdAt; // Fallback to anyone with a createdAt
    }).length;

    const newThisMonth = members.filter(m => {
        if (!m.createdAt) return false;
        const created = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
        return created >= startOfMonth;
    }).length;
    const familyCount = Math.max(1, Math.floor(totalMembers / 2.5));

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header - Copper Style */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Left: Back + Title */}
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin/people-hub"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                                        <Users className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">Members Directory</h1>
                                    <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                        {totalMembers} members
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Browse, search, and manage congregation members
                                </p>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="hidden sm:flex" onClick={handleExportCSV}>
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>
                            <Button
                                size="sm"
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm"
                                onClick={() => setIsAddMemberOpen(true)}
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Person
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Members" value={totalMembers} color="bg-purple-500" />
                    <StatCard label="Active This Month" value={activeMembers} color="bg-emerald-500" />
                    <StatCard label="New This Month" value={newThisMonth} color="bg-blue-500" />
                    <StatCard label="Families" value={familyCount} color="bg-amber-500" />
                </div>

                {/* Search + Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, or phone..."
                            className="pl-10 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="h-4 w-4 mr-2" />
                                    Status
                                    <ChevronDown className="h-4 w-4 ml-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => setFilterStatus('all')}>
                                    All Members
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStatus('active')}>
                                    Active
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStatus('inactive')}>
                                    Inactive
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Role Filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="h-4 w-4 mr-2" />
                                    {filterRole === 'all' ? 'Role' : filterRole.charAt(0).toUpperCase() + filterRole.slice(1)}
                                    <ChevronDown className="h-4 w-4 ml-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => setFilterRole('all')}>All Roles</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setFilterRole('admin')}>Admin</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterRole('staff')}>Staff</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterRole('leader')}>Leader</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterRole('member')}>Member</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterRole('visitor')}>Visitor</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleOpenBulkMessage}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send Bulk Message
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportPhoneList}>
                                    <Phone className="h-4 w-4 mr-2" />
                                    Export Phone List
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleOpenLifeEventFromMenu}>
                                    <Heart className="h-4 w-4 mr-2" />
                                    Log Life Event
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Table Card */}
                <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : filteredMembers.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-purple-50 dark:bg-purple-900/20 mb-4">
                                <Users className="h-8 w-8 text-purple-400" />
                            </div>
                            <h3 className="font-semibold text-foreground mb-2">No members found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                {searchQuery ? 'Try adjusting your search query' : 'Add your first church member to get started'}
                            </p>
                            {!searchQuery && (
                                <Button className="mt-4 bg-gradient-to-r from-purple-600 to-indigo-600">
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add First Member
                                </Button>
                            )}
                        </div>
                    ) : (
                        <MemberTable
                            members={filteredMembers}
                            loading={loading}
                            onMessage={handleMessage}
                            onViewProfile={handleViewProfile}
                            onAddLifeEvent={handleAddLifeEvent}
                            onRoleUpdate={fetchMembers}
                            onOpenFamilyModal={handleOpenFamilyModal}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            {
                selectedMemberForMessage && (
                    <QuickMessageModal
                        isOpen={isMessageModalOpen}
                        onClose={() => setIsMessageModalOpen(false)}
                        recipient={selectedMemberForMessage}
                    />
                )
            }

            {/* Add Member Modal */}
            <AddMemberModal
                open={isAddMemberOpen}
                onOpenChange={(open) => {
                    setIsAddMemberOpen(open);
                    if (!open) fetchMembers();
                }}
            />

            {/* Family Modal */}
            <FamilyModal
                open={isFamilyModalOpen}
                onOpenChange={(open) => {
                    setIsFamilyModalOpen(open);
                    if (!open) {
                        setSelectedFamilyId(undefined);
                        setSelectedMemberForFamily(undefined);
                        fetchMembers();
                    }
                }}
                familyId={selectedFamilyId}
                preSelectedMemberId={selectedMemberForFamily}
                members={members}
                onSuccess={fetchMembers}
            />

            {/* Life Event Modal */}
            <LifeEventModal
                isOpen={isLifeEventModalOpen}
                onClose={() => {
                    setIsLifeEventModalOpen(false);
                    setSelectedMemberForLifeEvent(undefined);
                }}
                memberId={selectedMemberForLifeEvent}
                members={members}
                onSuccess={fetchMembers}
            />

            {/* Bulk Message Modal */}
            <BulkMessageModal
                open={isBulkMessageOpen}
                onOpenChange={setIsBulkMessageOpen}
                recipients={filteredMembers}
                onSuccess={fetchMembers}
            />
        </div >
    );
}
