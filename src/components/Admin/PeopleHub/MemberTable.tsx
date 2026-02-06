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
    Users
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FirestoreUser, Ministry } from "@/types";
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
import { useMinistry } from '@/context/MinistryContext';
import { toast } from "sonner";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface MemberTableProps {
    members: FirestoreUser[];
    loading?: boolean;
    onMessage: (memberId: string) => void;
    onViewProfile: (memberId: string) => void;
    onAddLifeEvent: (memberId: string) => void;
    onRoleUpdate?: () => void;
    onOpenFamilyModal?: (memberId: string, familyId?: string) => void;
}

export const MemberTable: React.FC<MemberTableProps> = ({
    members,
    loading,
    onMessage,
    onViewProfile,
    onAddLifeEvent,
    onRoleUpdate,
    onOpenFamilyModal
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

    const handleAddMinistry = async (memberId: string, ministry: Ministry) => {
        try {
            const userRef = doc(db, 'users', memberId);
            const newServingIn = {
                ministryId: ministry.id,
                ministryName: ministry.name,
                role: 'member' as const,
                startDate: serverTimestamp(),
                status: 'active' as const
            };

            await updateDoc(userRef, {
                servingIn: arrayUnion(newServingIn)
            });

            toast.success(`Added to ${ministry.name}`);
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
        return <div>Loading members...</div>;
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Family</TableHead>
                        <TableHead>Serving In</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Life Events</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map((member) => (
                        <TableRow key={member.uid}>
                            {/* Member Name & Avatar */}
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={member.photoURL} alt={member.displayName} />
                                        <AvatarFallback>{(member.displayName || member.email || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => onViewProfile(member.uid)}
                                            className="text-left font-medium hover:underline"
                                        >
                                            {member.displayName || member.email}
                                        </button>
                                        <span className="text-xs text-muted-foreground">{member.email}</span>
                                    </div>
                                </div>
                            </TableCell>

                            {/* Family */}
                            <TableCell>
                                {member.familyId ? (
                                    <button
                                        onClick={() => onOpenFamilyModal?.(member.uid, member.familyId)}
                                        className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                                    >
                                        <Users className="h-3 w-3" />
                                        {familyNames[member.familyId] || 'View Family'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onOpenFamilyModal?.(member.uid)}
                                        className="text-muted-foreground text-xs hover:text-foreground flex items-center gap-1"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Link Family
                                    </button>
                                )}
                            </TableCell>

                            {/* Serving In with Add Dropdown */}
                            <TableCell>
                                <div className="flex flex-wrap gap-1 items-center">
                                    {member.servingIn && member.servingIn.length > 0 ? (
                                        member.servingIn.map((s, idx) => (
                                            <Badge
                                                key={idx}
                                                variant="secondary"
                                                className="text-xs flex items-center gap-1 pr-1"
                                            >
                                                {s.ministryName}
                                                <button
                                                    onClick={() => handleRemoveMinistry(member.uid, s.ministryId, s.ministryName)}
                                                    className="hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full p-0.5"
                                                >
                                                    <X className="h-2.5 w-2.5" />
                                                </button>
                                            </Badge>
                                        ))
                                    ) : null}

                                    {/* Add Ministry Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel className="text-xs">Add to Ministry</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {ministries && ministries.length > 0 ? (
                                                ministries
                                                    .filter(m => !member.servingIn?.some(s => s.ministryId === m.id))
                                                    .map(ministry => (
                                                        <DropdownMenuItem
                                                            key={ministry.id}
                                                            onClick={() => handleAddMinistry(member.uid, ministry)}
                                                        >
                                                            {ministry.name}
                                                        </DropdownMenuItem>
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
                            <TableCell>
                                <Badge variant={getStatusBadgeVariant(member.membershipStage)}>
                                    {member.membershipStage || 'Unknown'}
                                </Badge>
                            </TableCell>

                            {/* Role */}
                            <TableCell>
                                <Select
                                    defaultValue={member.role || 'member'}
                                    onValueChange={(val) => handleRoleChange(member.uid, val)}
                                >
                                    <SelectTrigger className="h-8 w-[120px]">
                                        <SelectValue placeholder="Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="staff">Staff</SelectItem>
                                        <SelectItem value="ministry_leader">Leader</SelectItem>
                                        <SelectItem value="member">Member</SelectItem>
                                        <SelectItem value="visitor">Visitor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>

                            {/* Last Seen */}
                            <TableCell>
                                {formatLastSeen(member) ? (
                                    <span className="text-sm">
                                        {formatLastSeen(member)}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                )}
                            </TableCell>

                            {/* Life Events Indicator */}
                            <TableCell>
                                {member.lifeEvents && member.lifeEvents.some(e => e.isActive) ? (
                                    <div className="flex items-center gap-1">
                                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                            {member.lifeEvents.filter(e => e.isActive).length} Active
                                        </Badge>
                                        {member.lifeEvents.some(e => e.priority === 'urgent') && (
                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onViewProfile(member.uid)}>
                                            <Eye className="mr-2 h-4 w-4" /> View Profile
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onMessage(member.uid)}>
                                            <Mail className="mr-2 h-4 w-4" /> Send Message
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onAddLifeEvent(member.uid)}>
                                            <CalendarPlus className="mr-2 h-4 w-4" /> Log Life Event
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem>
                                            <Edit className="mr-2 h-4 w-4" /> Edit Details
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
