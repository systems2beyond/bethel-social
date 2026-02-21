"use client";

import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    MoreHorizontal,
    Mail,
    CalendarPlus,
    Edit,
    Eye,
    AlertCircle,
    Plus,
    X,
    Users,
    Trash2,
    ShieldCheck,
    Crown,
    UserPlus
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { FirestoreUser, Ministry, District } from "@/types";
import { formatDistanceToNow } from "date-fns";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { UsersService } from '@/lib/services/UsersService';
import { FamilyService } from '@/lib/services/FamilyService';
import { DistrictService } from '@/lib/services/DistrictService';
import { useMinistry } from '@/context/MinistryContext';
import { toast } from "sonner";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VolunteerService } from '@/lib/volunteer-service';
import { GroupsService } from '@/lib/groups';

interface MemberTableProps {
    members: FirestoreUser[];
    loading?: boolean;
    onMessage: (memberId: string) => void;
    onViewProfile: (memberId: string) => void;
    onAddLifeEvent: (memberId: string) => void;
    onRoleUpdate?: () => void;
    onOpenFamilyModal?: (memberId: string, familyId?: string) => void;
    onRemoveMember?: (memberId: string, memberName: string) => void;
    onOpenDistrictModal?: (memberId: string, districtId?: string) => void;
    districts?: District[];
}

export const MemberTable: React.FC<MemberTableProps> = ({
    members,
    loading,
    onMessage,
    onViewProfile,
    onAddLifeEvent,
    onRoleUpdate,
    onOpenFamilyModal,
    onRemoveMember,
    onOpenDistrictModal,
    districts = []
}) => {
    const { ministries } = useMinistry();
    const [familyNames, setFamilyNames] = useState<Record<string, string>>({});

    // Fetch family names for members with familyId
    useEffect(() => {
        const fetchFamilyNames = async () => {
            const familyIds = [...new Set(members.filter(m => m.familyId).map(m => m.familyId!))];
            const names: Record<string, string> = {};

            for (const familyId of familyIds) {
                try {
                    const family = await FamilyService.getFamily(familyId);
                    if (family) {
                        names[familyId] = family.familyName;
                    }
                } catch {
                    console.error('Failed to fetch family:', familyId);
                }
            }

            setFamilyNames(names);
        };

        if (members.some(m => m.familyId)) {
            fetchFamilyNames();
        }
    }, [members]);

    const handleRoleChange = async (memberId: string, newRole: string) => {
        try {
            await UsersService.updateUserRole(memberId, newRole);
            toast.success("Role updated successfully");
            if (onRoleUpdate) onRoleUpdate();
        } catch {
            toast.error("Failed to update role");
        }
    };

    const handleStatusChange = async (memberId: string, newStatus: string) => {
        try {
            const userRef = doc(db, 'users', memberId);
            await updateDoc(userRef, {
                membershipStage: newStatus
            });
            toast.success("Status updated successfully");
            if (onRoleUpdate) onRoleUpdate();
        } catch {
            toast.error("Failed to update status");
        }
    };

    const handleAddMinistry = async (memberId: string, ministry: Ministry, asLeader: boolean = false) => {
        try {
            const member = members.find(m => m.uid === memberId);
            if (!member) return;

            const userRef = doc(db, 'users', memberId);
            const role = asLeader ? 'leader' : 'member';

            // Use new Date() instead of serverTimestamp() for arrayUnion
            const newServingIn = {
                ministryId: ministry.id,
                ministryName: ministry.name,
                role: role as 'member' | 'leader' | 'coordinator',
                startDate: new Date(),
                status: 'active' as const
            };

            await updateDoc(userRef, {
                servingIn: arrayUnion(newServingIn)
            });

            // Also add to ministryMembers collection for consistency
            await addDoc(collection(db, 'ministryMembers'), {
                ministryId: ministry.id,
                userId: memberId,
                name: member.displayName,
                email: member.email,
                photoURL: member.photoURL || null,
                role: asLeader ? 'Leader' : 'Member',
                status: 'active',
                joinedAt: serverTimestamp(),
                addedBy: null,
                addedByName: 'Admin (Directory)'
            });

            // Also add to the ministry's linked group (for Team Chat access)
            if (ministry.linkedGroupId) {
                try {
                    await GroupsService.addMemberDirectly(
                        ministry.linkedGroupId,
                        memberId,
                        asLeader ? 'admin' : 'member'
                    );
                } catch (groupError) {
                    // Don't fail the whole operation if group add fails
                    console.error('Failed to add to linked group:', groupError);
                }
            }

            // If assigning as leader, also update the ministry document
            if (asLeader) {
                await VolunteerService.updateMinistry(ministry.id, {
                    leaderId: memberId,
                    leaderName: member.displayName
                });
                toast.success(`${member.displayName} is now the leader of ${ministry.name}`);
            } else {
                toast.success(`Added to ${ministry.name}`);
            }

            if (onRoleUpdate) onRoleUpdate();
        } catch (error) {
            console.error('Failed to add ministry:', error);
            toast.error("Failed to add ministry");
        }
    };

    const handleRemoveMinistry = async (memberId: string, ministryId: string, ministryName: string) => {
        try {
            const member = members.find(m => m.uid === memberId);
            if (!member?.servingIn) return;

            const servingEntry = member.servingIn.find(s => s.ministryId === ministryId);
            if (!servingEntry) return;

            const userRef = doc(db, 'users', memberId);
            await updateDoc(userRef, {
                servingIn: arrayRemove(servingEntry)
            });

            toast.success(`Removed from ${ministryName}`);
            if (onRoleUpdate) onRoleUpdate();
        } catch (error) {
            console.error('Failed to remove ministry:', error);
            toast.error("Failed to remove ministry");
        }
    };

    // Get district name from districts array
    const getDistrictName = (districtId: string): string => {
        const district = districts.find(d => d.id === districtId);
        return district?.name || 'View District';
    };

    const getStatusBadgeVariant = (stage?: string) => {
        switch (stage) {
            case 'active': return 'default';
            case 'inactive': return 'secondary';
            case 'visitor': return 'outline';
            case 'non-member': return 'outline';
            default: return 'outline';
        }
    };

    const formatLastSeen = (member: FirestoreUser) => {
        const timestamp = member.lastActive || member.lastAttendance;
        if (!timestamp) return null;

        try {
            const date = timestamp.seconds
                ? new Date(timestamp.seconds * 1000)
                : new Date(timestamp);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch {
            return null;
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 shadow-lg p-8">
                <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Loading members...
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50/80 to-gray-100/50 dark:from-zinc-800/80 dark:to-zinc-800/50 border-b border-gray-200/50 dark:border-zinc-700/50 hover:bg-gray-50/80 dark:hover:bg-zinc-800/80">
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">Member</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">Family</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">District</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">Serving In</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">Status</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">Role</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">Last Seen</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-200">Life Events</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-200">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map((member) => (
                        <TableRow key={member.uid} className="group transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-zinc-800/50 border-b border-gray-100/50 dark:border-zinc-800/50">
                            {/* Member Name & Avatar */}
                            <TableCell className="font-medium py-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-zinc-800 shadow-md transition-transform duration-200 group-hover:scale-105">
                                        <AvatarImage src={member.photoURL} alt={member.displayName} />
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">{(member.displayName || member.email || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => onViewProfile(member.uid)}
                                            className="text-left font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                                        >
                                            {member.displayName || member.email}
                                        </button>
                                        <span className="text-xs text-muted-foreground">{member.email}</span>
                                    </div>
                                </div>
                            </TableCell>

                            {/* Family */}
                            <TableCell className="py-4">
                                {member.familyId ? (
                                    <button
                                        onClick={() => onOpenFamilyModal?.(member.uid, member.familyId)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors duration-200"
                                    >
                                        <Users className="h-3.5 w-3.5" />
                                        {familyNames[member.familyId] || 'View Family'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onOpenFamilyModal?.(member.uid)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-muted-foreground text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Link Family
                                    </button>
                                )}
                            </TableCell>

                            {/* District */}
                            <TableCell className="py-4">
                                {member.districtId ? (
                                    <button
                                        onClick={() => onOpenDistrictModal?.(member.uid, member.districtId)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors duration-200"
                                    >
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {getDistrictName(member.districtId)}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onOpenDistrictModal?.(member.uid)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-muted-foreground text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Assign
                                    </button>
                                )}
                            </TableCell>

                            {/* Serving In with Add Dropdown */}
                            <TableCell className="py-4">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {member.servingIn && member.servingIn.length > 0 ? (
                                        member.servingIn.map((s, idx) => (
                                            <Badge
                                                key={idx}
                                                variant="secondary"
                                                className="text-xs flex items-center gap-1 pr-1 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors duration-200"
                                            >
                                                {s.ministryName}
                                                <button
                                                    onClick={() => handleRemoveMinistry(member.uid, s.ministryId, s.ministryName)}
                                                    className="hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full p-0.5 transition-colors duration-150"
                                                >
                                                    <X className="h-2.5 w-2.5" />
                                                </button>
                                            </Badge>
                                        ))
                                    ) : null}

                                    {/* Add Ministry Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200">
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50 min-w-[200px]">
                                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Add to Ministry</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {ministries && ministries.length > 0 ? (
                                                ministries
                                                    .filter(m => !member.servingIn?.some(s => s.ministryId === m.id))
                                                    .map(ministry => (
                                                        <DropdownMenuSub key={ministry.id}>
                                                            <DropdownMenuSubTrigger className="cursor-pointer">
                                                                {ministry.name}
                                                            </DropdownMenuSubTrigger>
                                                            <DropdownMenuSubContent className="rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 min-w-[160px]">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAddMinistry(member.uid, ministry, false)}
                                                                    className="cursor-pointer"
                                                                >
                                                                    <UserPlus className="w-4 h-4 mr-2" />
                                                                    Add as Member
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAddMinistry(member.uid, ministry, true)}
                                                                    className="cursor-pointer text-amber-600 dark:text-amber-400"
                                                                >
                                                                    <Crown className="w-4 h-4 mr-2" />
                                                                    Assign as Leader
                                                                </DropdownMenuItem>
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuSub>
                                                    ))
                                            ) : (
                                                <DropdownMenuItem disabled>
                                                    No ministries available
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell className="py-4">
                                <Select
                                    defaultValue={member.membershipStage || 'active'}
                                    onValueChange={(val) => handleStatusChange(member.uid, val)}
                                >
                                    <SelectTrigger className="h-8 w-[110px] rounded-lg border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50">
                                        <SelectItem value="active">
                                            <span className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                                Active
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="inactive">
                                            <span className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-gray-400" />
                                                Inactive
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="visitor">
                                            <span className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                                Visitor
                                            </span>
                                        </SelectItem>
                                        <SelectItem value="non-member">
                                            <span className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-orange-500" />
                                                Non-Member
                                            </span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>

                            {/* Role */}
                            <TableCell className="py-4">
                                <Select
                                    defaultValue={member.role || 'member'}
                                    onValueChange={(val) => handleRoleChange(member.uid, val)}
                                >
                                    <SelectTrigger className="h-8 w-[120px] rounded-lg border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                        <SelectValue placeholder="Role" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50">
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="staff">Staff</SelectItem>
                                        <SelectItem value="ministry_leader">Leader</SelectItem>
                                        <SelectItem value="member">Member</SelectItem>
                                        <SelectItem value="visitor">Visitor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>

                            {/* Last Seen */}
                            <TableCell className="py-4">
                                {formatLastSeen(member) ? (
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {formatLastSeen(member)}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground text-sm">—</span>
                                )}
                            </TableCell>

                            {/* Life Events Indicator */}
                            <TableCell className="py-4">
                                {member.lifeEvents && member.lifeEvents.some(e => e.isActive) ? (
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="destructive" className="h-5 px-2 text-[10px] rounded-full font-semibold shadow-sm">
                                            {member.lifeEvents.filter(e => e.isActive).length} Active
                                        </Badge>
                                        {member.lifeEvents.some(e => e.priority === 'urgent') && (
                                            <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-sm">—</span>
                                )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right py-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-200">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50 min-w-[160px]">
                                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onViewProfile(member.uid)} className="cursor-pointer">
                                            <Eye className="mr-2 h-4 w-4" /> View Profile
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onMessage(member.uid)} className="cursor-pointer">
                                            <Mail className="mr-2 h-4 w-4" /> Send Message
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onAddLifeEvent(member.uid)} className="cursor-pointer">
                                            <CalendarPlus className="mr-2 h-4 w-4" /> Log Life Event
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="cursor-pointer">
                                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => onRemoveMember?.(member.uid, member.displayName || member.email || 'this member')}
                                            className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Remove Member
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
