"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, X, Home, Hash } from "lucide-react";
import { FirestoreUser } from '@/types';
import { FamilyService } from '@/lib/services/FamilyService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface FamilyModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    familyId?: string; // Edit mode if provided
    preSelectedMemberId?: string; // Pre-fill when creating from member row
    members: FirestoreUser[]; // All members for selection
    onSuccess?: () => void;
}

interface FormData {
    familyName: string;
    headOfHouseholdId: string;
    spouseId: string;
    childrenIds: string[];
    address: {
        street1: string;
        street2: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
    homePhone: string;
    envelopeNumber: string;
}

const initialFormData: FormData = {
    familyName: '',
    headOfHouseholdId: '',
    spouseId: '',
    childrenIds: [],
    address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'USA'
    },
    homePhone: '',
    envelopeNumber: ''
};

export const FamilyModal: React.FC<FamilyModalProps> = ({
    open,
    onOpenChange,
    familyId,
    preSelectedMemberId,
    members,
    onSuccess
}) => {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingFamily, setLoadingFamily] = useState(false);
    const [formData, setFormData] = useState<FormData>(initialFormData);

    const isEditMode = !!familyId;

    const loadFamily = useCallback(async () => {
        if (!familyId) return;

        setLoadingFamily(true);
        try {
            const family = await FamilyService.getFamily(familyId);
            if (family) {
                setFormData({
                    familyName: family.familyName || '',
                    headOfHouseholdId: family.headOfHouseholdId || '',
                    spouseId: family.spouseId || '',
                    childrenIds: family.childrenIds || [],
                    address: {
                        street1: family.address?.street1 || '',
                        street2: family.address?.street2 || '',
                        city: family.address?.city || '',
                        state: family.address?.state || '',
                        postalCode: family.address?.postalCode || '',
                        country: family.address?.country || 'USA'
                    },
                    homePhone: family.homePhone || '',
                    envelopeNumber: family.envelopeNumber || ''
                });
            }
        } catch (error) {
            console.error('Failed to load family:', error);
            toast.error('Failed to load family data');
        } finally {
            setLoadingFamily(false);
        }
    }, [familyId]);

    // Load family data if editing
    useEffect(() => {
        if (familyId && open) {
            loadFamily();
        } else if (preSelectedMemberId && !familyId && open) {
            // Pre-select the member as head of household for new families
            const member = members.find(m => m.uid === preSelectedMemberId);
            if (member) {
                setFormData({
                    ...initialFormData,
                    headOfHouseholdId: preSelectedMemberId,
                    familyName: `The ${member.displayName?.split(' ').pop() || ''} Family`
                });
            }
        } else if (!open) {
            setFormData(initialFormData);
        }
    }, [familyId, preSelectedMemberId, open, members, loadFamily]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.familyName.trim()) {
            toast.error('Family name is required');
            return;
        }

        if (!formData.headOfHouseholdId) {
            toast.error('Head of household is required');
            return;
        }

        setLoading(true);
        try {
            const familyData = {
                familyName: formData.familyName,
                churchId: userData?.churchId || 'default',
                headOfHouseholdId: formData.headOfHouseholdId,
                spouseId: formData.spouseId || undefined,
                childrenIds: formData.childrenIds.length > 0 ? formData.childrenIds : undefined,
                address: formData.address.street1 ? {
                    street1: formData.address.street1,
                    street2: formData.address.street2 || undefined,
                    city: formData.address.city,
                    state: formData.address.state,
                    postalCode: formData.address.postalCode,
                    country: formData.address.country
                } : undefined,
                homePhone: formData.homePhone || undefined,
                envelopeNumber: formData.envelopeNumber || undefined
            };

            if (isEditMode && familyId) {
                // Update existing family
                await FamilyService.updateFamily(familyId, familyData);

                // Update member links
                const allMemberIds = [
                    formData.headOfHouseholdId,
                    formData.spouseId,
                    ...formData.childrenIds
                ].filter(Boolean);

                for (const memberId of allMemberIds) {
                    const role = memberId === formData.headOfHouseholdId ? 'head'
                        : memberId === formData.spouseId ? 'spouse'
                            : 'child';
                    await FamilyService.linkMemberToFamily(memberId, familyId, role);
                }

                toast.success('Family updated successfully');
            } else {
                // Create new family
                const newFamilyId = await FamilyService.createFamily(
                    familyData,
                    userData?.uid || 'system'
                );

                // Link all members to the new family
                if (formData.headOfHouseholdId) {
                    await FamilyService.linkMemberToFamily(formData.headOfHouseholdId, newFamilyId, 'head');
                }
                if (formData.spouseId) {
                    await FamilyService.linkMemberToFamily(formData.spouseId, newFamilyId, 'spouse');
                }
                for (const childId of formData.childrenIds) {
                    await FamilyService.linkMemberToFamily(childId, newFamilyId, 'child');
                }

                toast.success('Family created successfully');
            }

            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save family:', error);
            toast.error('Failed to save family');
        } finally {
            setLoading(false);
        }
    };

    const handleAddChild = (childId: string) => {
        if (!formData.childrenIds.includes(childId)) {
            setFormData({
                ...formData,
                childrenIds: [...formData.childrenIds, childId]
            });
        }
    };

    const handleRemoveChild = (childId: string) => {
        setFormData({
            ...formData,
            childrenIds: formData.childrenIds.filter(id => id !== childId)
        });
    };

    const getMemberName = (memberId: string) => {
        const member = members.find(m => m.uid === memberId);
        return member?.displayName || member?.email || 'Unknown';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {isEditMode ? 'Edit Family' : 'Create Family'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? 'Update family information and members'
                            : 'Create a new family unit and assign members'}
                    </DialogDescription>
                </DialogHeader>

                {loadingFamily ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6 py-4">
                        {/* Family Name */}
                        <div className="space-y-2">
                            <Label htmlFor="familyName">Family Name</Label>
                            <Input
                                id="familyName"
                                placeholder="The Johnson Family"
                                value={formData.familyName}
                                onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                            />
                        </div>

                        {/* Address Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Home className="h-4 w-4" />
                                Address
                            </div>
                            <div className="space-y-3 pl-6">
                                <Input
                                    placeholder="Street Address"
                                    value={formData.address.street1}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        address: { ...formData.address, street1: e.target.value }
                                    })}
                                />
                                <Input
                                    placeholder="Apt, Suite, Unit (optional)"
                                    value={formData.address.street2}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        address: { ...formData.address, street2: e.target.value }
                                    })}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <Input
                                        placeholder="City"
                                        value={formData.address.city}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            address: { ...formData.address, city: e.target.value }
                                        })}
                                    />
                                    <Input
                                        placeholder="State"
                                        value={formData.address.state}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            address: { ...formData.address, state: e.target.value }
                                        })}
                                    />
                                    <Input
                                        placeholder="ZIP"
                                        value={formData.address.postalCode}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            address: { ...formData.address, postalCode: e.target.value }
                                        })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Envelope Number */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="envelopeNumber">Envelope Number</Label>
                            </div>
                            <Input
                                id="envelopeNumber"
                                placeholder="For giving records (e.g., 1234)"
                                className="w-40"
                                value={formData.envelopeNumber}
                                onChange={(e) => setFormData({ ...formData, envelopeNumber: e.target.value })}
                            />
                        </div>

                        {/* Family Members Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Users className="h-4 w-4" />
                                Family Members
                            </div>

                            {/* Head of Household */}
                            <div className="space-y-2 pl-6">
                                <Label>Head of Household *</Label>
                                <Select
                                    value={formData.headOfHouseholdId}
                                    onValueChange={(val) => setFormData({ ...formData, headOfHouseholdId: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select head of household" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {members.map(member => (
                                            <SelectItem
                                                key={member.uid}
                                                value={member.uid}
                                                disabled={member.uid === formData.spouseId || formData.childrenIds.includes(member.uid)}
                                            >
                                                {member.displayName || member.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Spouse */}
                            <div className="space-y-2 pl-6">
                                <Label>Spouse (optional)</Label>
                                <Select
                                    value={formData.spouseId || 'none'}
                                    onValueChange={(val) => setFormData({ ...formData, spouseId: val === 'none' ? '' : val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select spouse" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No spouse</SelectItem>
                                        {members
                                            .filter(m => m.uid !== formData.headOfHouseholdId && !formData.childrenIds.includes(m.uid))
                                            .map(member => (
                                                <SelectItem key={member.uid} value={member.uid}>
                                                    {member.displayName || member.email}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Children */}
                            <div className="space-y-2 pl-6">
                                <Label>Children</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formData.childrenIds.map(childId => (
                                        <Badge key={childId} variant="secondary" className="flex items-center gap-1">
                                            {getMemberName(childId)}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveChild(childId)}
                                                className="hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                                <Select
                                    value=""
                                    onValueChange={(val) => {
                                        if (val) handleAddChild(val);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="+ Add child" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {members
                                            .filter(m =>
                                                m.uid !== formData.headOfHouseholdId &&
                                                m.uid !== formData.spouseId &&
                                                !formData.childrenIds.includes(m.uid)
                                            )
                                            .map(member => (
                                                <SelectItem key={member.uid} value={member.uid}>
                                                    {member.displayName || member.email}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    isEditMode ? 'Update Family' : 'Create Family'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};
