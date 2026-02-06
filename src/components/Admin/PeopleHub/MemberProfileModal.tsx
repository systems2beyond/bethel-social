"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Loader2,
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    ShieldCheck,
    Users,
    Heart,
    MessageSquare,
    Edit2,
    Save,
    X,
    Plus,
    Tag
} from "lucide-react";
import { FirestoreUser, District, Family, LifeEvent } from '@/types';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface MemberProfileModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: FirestoreUser | null;
    districts?: District[];
    onSuccess?: () => void;
    onMessage?: (member: FirestoreUser) => void;
    onAddLifeEvent?: (memberId: string) => void;
    onAssignDistrict?: (memberId: string) => void;
    onAssignFamily?: (memberId: string, familyId?: string) => void;
}

export function MemberProfileModal({
    open,
    onOpenChange,
    member,
    districts = [],
    onSuccess,
    onMessage,
    onAddLifeEvent,
    onAssignDistrict,
    onAssignFamily
}: MemberProfileModalProps) {
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [family, setFamily] = useState<Family | null>(null);
    const [editData, setEditData] = useState({
        displayName: '',
        email: '',
        phoneNumber: '',
        dateOfBirth: '',
        role: '',
        membershipStage: '',
        address: {
            street1: '',
            street2: '',
            city: '',
            state: '',
            postalCode: ''
        },
        pastoralNotes: ''
    });

    // Load member data when modal opens
    useEffect(() => {
        if (member && open) {
            setEditData({
                displayName: member.displayName || '',
                email: member.email || '',
                phoneNumber: member.phoneNumber || '',
                dateOfBirth: member.sacraments?.baptism?.date ? '' : '', // TODO: format properly
                role: member.role || 'member',
                membershipStage: member.membershipStage || 'active',
                address: {
                    street1: member.address?.street1 || '',
                    street2: member.address?.street2 || '',
                    city: member.address?.city || '',
                    state: member.address?.state || '',
                    postalCode: member.address?.postalCode || ''
                },
                pastoralNotes: member.pastoralNotes || ''
            });

            // Fetch family if member has one
            if (member.familyId) {
                const fetchFamily = async () => {
                    try {
                        const familyDoc = await getDoc(doc(db, 'families', member.familyId!));
                        if (familyDoc.exists()) {
                            setFamily({ id: familyDoc.id, ...familyDoc.data() } as Family);
                        }
                    } catch (err) {
                        console.error('Failed to fetch family:', err);
                    }
                };
                fetchFamily();
            } else {
                setFamily(null);
            }
        }
    }, [member, open]);

    // Reset editing state when modal closes
    useEffect(() => {
        if (!open) {
            setIsEditing(false);
        }
    }, [open]);

    const handleSave = async () => {
        if (!member) return;

        setLoading(true);
        try {
            const userRef = doc(db, 'users', member.uid);
            await updateDoc(userRef, {
                displayName: editData.displayName.trim(),
                email: editData.email.trim(),
                phoneNumber: editData.phoneNumber.trim(),
                role: editData.role,
                membershipStage: editData.membershipStage,
                address: editData.address.street1 ? {
                    street1: editData.address.street1,
                    street2: editData.address.street2 || null,
                    city: editData.address.city,
                    state: editData.address.state,
                    postalCode: editData.address.postalCode,
                    country: 'USA'
                } : null,
                pastoralNotes: editData.pastoralNotes || null,
                updatedAt: serverTimestamp()
            });

            toast.success('Profile updated successfully');
            setIsEditing(false);
            onSuccess?.();
        } catch (error) {
            console.error('Failed to update profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    // Get district name
    const getDistrictInfo = () => {
        if (!member?.districtId) return null;
        const district = districts.find(d => d.id === member.districtId);
        return district;
    };

    const districtInfo = getDistrictInfo();

    // Format dates
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Never';
        try {
            const date = timestamp.seconds
                ? new Date(timestamp.seconds * 1000)
                : new Date(timestamp);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch {
            return 'Unknown';
        }
    };

    if (!member) return null;

    const initials = (member.displayName || member.email || 'U').slice(0, 2).toUpperCase();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-hidden p-0 rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white dark:bg-zinc-900">
                {/* Header - Copper/Amber Treatment */}
                <div className="relative bg-gradient-to-r from-amber-500 to-orange-600 px-6 pt-6 pb-16">
                    <DialogTitle className="text-white text-xl font-semibold">
                        Member Profile
                    </DialogTitle>
                </div>

                {/* Avatar and Name section below header */}
                <div className="px-6 -mt-10">
                    <div className="flex items-start gap-4">
                        <Avatar className="h-20 w-20 ring-4 ring-white dark:ring-zinc-900 shadow-lg shrink-0">
                            <AvatarImage src={member.photoURL} />
                            <AvatarFallback className="text-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="pt-6 flex-1">
                            <div className="flex items-start justify-between">
                                <div>
                                    {isEditing ? (
                                        <Input
                                            value={editData.displayName}
                                            onChange={(e) => setEditData(prev => ({ ...prev, displayName: e.target.value }))}
                                            className="text-xl font-bold border-gray-200 dark:border-zinc-700 max-w-[280px]"
                                            placeholder="Full Name"
                                        />
                                    ) : (
                                        <h2 className="text-xl font-bold text-foreground">
                                            {member.displayName || 'No Name'}
                                        </h2>
                                    )}
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <Badge
                                            variant={member.membershipStage === 'active' ? 'default' : 'secondary'}
                                            className={cn(
                                                "capitalize",
                                                member.membershipStage === 'active' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            )}
                                        >
                                            {member.membershipStage || 'active'}
                                        </Badge>
                                        <Badge variant="outline" className="capitalize">
                                            {member.role || 'member'}
                                        </Badge>
                                    </div>
                                </div>
                                {/* Edit/Save Actions */}
                                <div className="flex items-center gap-2 pt-1">
                                    {!isEditing ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsEditing(true)}
                                            className="rounded-lg text-muted-foreground hover:text-foreground"
                                        >
                                            <Edit2 className="h-4 w-4 mr-1" />
                                            Edit
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsEditing(false)}
                                                disabled={loading}
                                                className="rounded-lg"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleSave}
                                                disabled={loading}
                                                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                                            >
                                                {loading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-1" />
                                                )}
                                                Save
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Tabs */}
                <div className="px-6 pb-6 pt-4 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-gray-100 dark:bg-zinc-800 p-1">
                            <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
                                Details
                            </TabsTrigger>
                            <TabsTrigger value="connections" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
                                Connections
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700">
                                Notes
                            </TabsTrigger>
                        </TabsList>

                        {/* Details Tab */}
                        <TabsContent value="details" className="mt-4 space-y-4">
                            {/* Contact Info */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</h3>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> Email
                                        </Label>
                                        {isEditing ? (
                                            <Input
                                                type="email"
                                                value={editData.email}
                                                onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                                                className="h-9"
                                            />
                                        ) : (
                                            <p className="text-sm">{member.email || '—'}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> Phone
                                        </Label>
                                        {isEditing ? (
                                            <Input
                                                type="tel"
                                                value={editData.phoneNumber}
                                                onChange={(e) => setEditData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                                className="h-9"
                                            />
                                        ) : (
                                            <p className="text-sm">{member.phoneNumber || '—'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> Address
                                </h3>

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Street Address"
                                            value={editData.address.street1}
                                            onChange={(e) => setEditData(prev => ({
                                                ...prev,
                                                address: { ...prev.address, street1: e.target.value }
                                            }))}
                                            className="h-9"
                                        />
                                        <Input
                                            placeholder="Apt, Suite, Unit (Optional)"
                                            value={editData.address.street2}
                                            onChange={(e) => setEditData(prev => ({
                                                ...prev,
                                                address: { ...prev.address, street2: e.target.value }
                                            }))}
                                            className="h-9"
                                        />
                                        <div className="grid grid-cols-6 gap-2">
                                            <Input
                                                placeholder="City"
                                                value={editData.address.city}
                                                onChange={(e) => setEditData(prev => ({
                                                    ...prev,
                                                    address: { ...prev.address, city: e.target.value }
                                                }))}
                                                className="col-span-3 h-9"
                                            />
                                            <Input
                                                placeholder="State"
                                                value={editData.address.state}
                                                onChange={(e) => setEditData(prev => ({
                                                    ...prev,
                                                    address: { ...prev.address, state: e.target.value }
                                                }))}
                                                className="col-span-1 h-9"
                                            />
                                            <Input
                                                placeholder="ZIP"
                                                value={editData.address.postalCode}
                                                onChange={(e) => setEditData(prev => ({
                                                    ...prev,
                                                    address: { ...prev.address, postalCode: e.target.value }
                                                }))}
                                                className="col-span-2 h-9"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm">
                                        {member.address ? (
                                            <>
                                                {member.address.street1}
                                                {member.address.street2 && <>, {member.address.street2}</>}
                                                <br />
                                                {member.address.city}, {member.address.state} {member.address.postalCode}
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground">No address on file</span>
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* Role & Status */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Church Role</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Role</Label>
                                        {isEditing ? (
                                            <Select
                                                value={editData.role}
                                                onValueChange={(val) => setEditData(prev => ({ ...prev, role: val }))}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                    <SelectItem value="staff">Staff</SelectItem>
                                                    <SelectItem value="ministry_leader">Ministry Leader</SelectItem>
                                                    <SelectItem value="member">Member</SelectItem>
                                                    <SelectItem value="visitor">Visitor</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <p className="text-sm capitalize">{member.role || 'member'}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Status</Label>
                                        {isEditing ? (
                                            <Select
                                                value={editData.membershipStage}
                                                onValueChange={(val) => setEditData(prev => ({ ...prev, membershipStage: val }))}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                    <SelectItem value="visitor">Visitor</SelectItem>
                                                    <SelectItem value="non-member">Non-Member</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <p className="text-sm capitalize">{member.membershipStage || 'active'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Activity */}
                            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activity</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Last Active</p>
                                        <p>{formatDate(member.lastActive)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Last Attendance</p>
                                        <p>{formatDate(member.lastAttendance)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Member Since</p>
                                        <p>{formatDate(member.createdAt)}</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Connections Tab */}
                        <TabsContent value="connections" className="mt-4 space-y-4">
                            {/* District */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" /> District
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onAssignDistrict?.(member.uid)}
                                        className="h-7 text-xs"
                                    >
                                        {districtInfo ? 'Change' : 'Assign'}
                                    </Button>
                                </div>
                                {districtInfo ? (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                                        <p className="font-medium text-amber-900 dark:text-amber-100">{districtInfo.name}</p>
                                        {districtInfo.leaderName && (
                                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                                Led by {districtInfo.leaderName}
                                            </p>
                                        )}
                                        {member.districtRole && (
                                            <Badge variant="outline" className="mt-2 text-xs capitalize border-amber-300 text-amber-700">
                                                {member.districtRole.replace('_', ' ')}
                                            </Badge>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                                        Not assigned to any district
                                    </p>
                                )}
                            </div>

                            {/* Family */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <Users className="h-3 w-3" /> Family
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onAssignFamily?.(member.uid, member.familyId)}
                                        className="h-7 text-xs"
                                    >
                                        {family ? 'Edit' : 'Link'}
                                    </Button>
                                </div>
                                {family ? (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50">
                                        <p className="font-medium text-blue-900 dark:text-blue-100">{family.familyName}</p>
                                        {family.address && (
                                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                                                {family.address.city}, {family.address.state}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                                        Not linked to any family
                                    </p>
                                )}
                            </div>

                            {/* Ministries */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Serving In</h3>
                                {member.servingIn && member.servingIn.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {member.servingIn.map((s, idx) => (
                                            <Badge key={idx} variant="secondary" className="rounded-full">
                                                {s.ministryName}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Not serving in any ministries</p>
                                )}
                            </div>

                            {/* Life Events */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <Heart className="h-3 w-3" /> Life Events
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onAddLifeEvent?.(member.uid)}
                                        className="h-7 text-xs"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add
                                    </Button>
                                </div>
                                {member.lifeEvents && member.lifeEvents.some(e => e.isActive) ? (
                                    <div className="space-y-2">
                                        {member.lifeEvents.filter(e => e.isActive).map((event, idx) => (
                                            <div key={idx} className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800/50">
                                                <p className="text-sm font-medium text-rose-900 dark:text-rose-100 capitalize">
                                                    {event.eventType.replace(/_/g, ' ')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No active life events</p>
                                )}
                            </div>
                        </TabsContent>

                        {/* Notes Tab */}
                        <TabsContent value="notes" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                    Pastoral Notes
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Private notes visible only to pastoral staff
                                </p>
                                {isEditing ? (
                                    <Textarea
                                        value={editData.pastoralNotes}
                                        onChange={(e) => setEditData(prev => ({ ...prev, pastoralNotes: e.target.value }))}
                                        placeholder="Add notes about pastoral care, prayer requests, follow-ups..."
                                        className="min-h-[150px]"
                                    />
                                ) : (
                                    <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl min-h-[100px]">
                                        {member.pastoralNotes ? (
                                            <p className="text-sm whitespace-pre-wrap">{member.pastoralNotes}</p>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">No pastoral notes</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Prayer Requests */}
                            {member.prayerRequestsList && member.prayerRequestsList.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                        Prayer Requests
                                    </Label>
                                    <div className="space-y-2">
                                        {member.prayerRequestsList.map((request, idx) => (
                                            <div key={idx} className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                                                <p className="text-sm">{request}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* Quick Actions */}
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800 flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-xl border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            onClick={() => {
                                onMessage?.(member);
                                onOpenChange(false);
                            }}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Send Message
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md"
                            onClick={() => {
                                onAddLifeEvent?.(member.uid);
                                onOpenChange(false);
                            }}
                        >
                            <Heart className="h-4 w-4 mr-2" />
                            Log Life Event
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
