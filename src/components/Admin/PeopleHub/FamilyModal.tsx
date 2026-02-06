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
import { Loader2, Users, X, Home, Hash, AlertCircle } from "lucide-react";
import { FirestoreUser } from '@/types';
import { FamilyService } from '@/lib/services/FamilyService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isEditMode = !!familyId;

    // Clear error when field changes
    const clearError = (field: string) => {
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

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
            setErrors({});
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
            setErrors({});
        } else if (!open) {
            setFormData(initialFormData);
            setErrors({});
        }
    }, [familyId, preSelectedMemberId, open, members, loadFamily]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate fields
        const newErrors: Record<string, string> = {};

        if (!formData.familyName.trim()) {
            newErrors.familyName = 'Family name is required';
        }

        if (!formData.headOfHouseholdId) {
            newErrors.headOfHouseholdId = 'Head of household is required';
        }

        // If any address field is filled, validate required address fields
        const hasPartialAddress = formData.address.street1 || formData.address.city ||
            formData.address.state || formData.address.postalCode;

        if (hasPartialAddress) {
            if (!formData.address.street1.trim()) {
                newErrors['address.street1'] = 'Street address is required';
            }
            if (!formData.address.city.trim()) {
                newErrors['address.city'] = 'City is required';
            }
            if (!formData.address.state.trim()) {
                newErrors['address.state'] = 'State is required';
            }
            if (!formData.address.postalCode.trim()) {
                newErrors['address.postalCode'] = 'ZIP code is required';
            }
        }

        // If there are errors, show them and stop
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Show toast with first error
            const firstError = Object.values(newErrors)[0];
            toast.error(firstError);
            return;
        }

        setLoading(true);
        try {
            // Build address only if all required fields are filled
            const hasCompleteAddress = formData.address.street1.trim() && formData.address.city.trim() &&
                formData.address.state.trim() && formData.address.postalCode.trim();

            // Build family data with proper typing - use spread to conditionally add optional fields
            const familyData = {
                familyName: formData.familyName.trim(),
                churchId: userData?.churchId || 'default',
                headOfHouseholdId: formData.headOfHouseholdId,
                ...(formData.spouseId ? { spouseId: formData.spouseId } : {}),
                ...(formData.childrenIds.length > 0 ? { childrenIds: formData.childrenIds } : {}),
                ...(hasCompleteAddress ? {
                    address: {
                        street1: formData.address.street1.trim(),
                        street2: formData.address.street2.trim() || '',
                        city: formData.address.city.trim(),
                        state: formData.address.state.trim(),
                        postalCode: formData.address.postalCode.trim(),
                        country: formData.address.country || 'USA'
                    }
                } : {}),
                ...(formData.homePhone.trim() ? { homePhone: formData.homePhone.trim() } : {}),
                ...(formData.envelopeNumber.trim() ? { envelopeNumber: formData.envelopeNumber.trim() } : {})
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
            <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        {isEditMode ? 'Edit Family' : 'Create Family'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {isEditMode
                            ? 'Update family information and members'
                            : 'Create a new family unit and assign members'}
                    </DialogDescription>
                </DialogHeader>

                {loadingFamily ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6 py-4">
                        {/* Family Name */}
                        <div className="space-y-2">
                            <Label htmlFor="familyName" className={cn("font-medium", errors.familyName ? "text-red-500" : "text-muted-foreground")}>
                                Family Name *
                            </Label>
                            <Input
                                id="familyName"
                                placeholder="The Johnson Family"
                                className={cn(
                                    "rounded-xl bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200",
                                    errors.familyName
                                        ? "border-red-500 focus-visible:ring-red-500"
                                        : "border-gray-200 dark:border-zinc-700"
                                )}
                                value={formData.familyName}
                                onChange={(e) => {
                                    setFormData({ ...formData, familyName: e.target.value });
                                    clearError('familyName');
                                }}
                            />
                            {errors.familyName && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.familyName}
                                </p>
                            )}
                        </div>

                        {/* Address Section */}
                        <div className={cn(
                            "space-y-3 p-4 rounded-xl border",
                            (errors['address.street1'] || errors['address.city'] || errors['address.state'] || errors['address.postalCode'])
                                ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50"
                                : "bg-gray-50/50 dark:bg-zinc-800/30 border-gray-100 dark:border-zinc-800"
                        )}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    <Home className="h-4 w-4" />
                                    Address
                                </div>
                                <span className="text-xs text-muted-foreground">(fill all or leave empty)</span>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Input
                                        placeholder="Street Address"
                                        className={cn(
                                            "rounded-xl bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200",
                                            errors['address.street1']
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : "border-gray-200 dark:border-zinc-700"
                                        )}
                                        value={formData.address.street1}
                                        onChange={(e) => {
                                            setFormData({
                                                ...formData,
                                                address: { ...formData.address, street1: e.target.value }
                                            });
                                            clearError('address.street1');
                                        }}
                                    />
                                    {errors['address.street1'] && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {errors['address.street1']}
                                        </p>
                                    )}
                                </div>
                                <Input
                                    placeholder="Apt, Suite, Unit (optional)"
                                    className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                    value={formData.address.street2}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        address: { ...formData.address, street2: e.target.value }
                                    })}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="City"
                                            className={cn(
                                                "rounded-xl bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200",
                                                errors['address.city']
                                                    ? "border-red-500 focus-visible:ring-red-500"
                                                    : "border-gray-200 dark:border-zinc-700"
                                            )}
                                            value={formData.address.city}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    address: { ...formData.address, city: e.target.value }
                                                });
                                                clearError('address.city');
                                            }}
                                        />
                                        {errors['address.city'] && (
                                            <p className="text-xs text-red-500">{errors['address.city']}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="State"
                                            className={cn(
                                                "rounded-xl bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200",
                                                errors['address.state']
                                                    ? "border-red-500 focus-visible:ring-red-500"
                                                    : "border-gray-200 dark:border-zinc-700"
                                            )}
                                            value={formData.address.state}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    address: { ...formData.address, state: e.target.value }
                                                });
                                                clearError('address.state');
                                            }}
                                        />
                                        {errors['address.state'] && (
                                            <p className="text-xs text-red-500">{errors['address.state']}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="ZIP"
                                            className={cn(
                                                "rounded-xl bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200",
                                                errors['address.postalCode']
                                                    ? "border-red-500 focus-visible:ring-red-500"
                                                    : "border-gray-200 dark:border-zinc-700"
                                            )}
                                            value={formData.address.postalCode}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    address: { ...formData.address, postalCode: e.target.value }
                                                });
                                                clearError('address.postalCode');
                                            }}
                                        />
                                        {errors['address.postalCode'] && (
                                            <p className="text-xs text-red-500">{errors['address.postalCode']}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Envelope Number */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="envelopeNumber" className="font-medium text-muted-foreground">Envelope Number</Label>
                            </div>
                            <Input
                                id="envelopeNumber"
                                placeholder="For giving records (e.g., 1234)"
                                className="w-40 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                value={formData.envelopeNumber}
                                onChange={(e) => setFormData({ ...formData, envelopeNumber: e.target.value })}
                            />
                        </div>

                        {/* Family Members Section */}
                        <div className="space-y-4 p-4 rounded-xl bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <Users className="h-4 w-4" />
                                Family Members
                            </div>

                            {/* Head of Household */}
                            <div className="space-y-2">
                                <Label className={cn("font-medium", errors.headOfHouseholdId ? "text-red-500" : "text-muted-foreground")}>
                                    Head of Household *
                                </Label>
                                <Select
                                    value={formData.headOfHouseholdId}
                                    onValueChange={(val) => {
                                        setFormData({ ...formData, headOfHouseholdId: val });
                                        clearError('headOfHouseholdId');
                                    }}
                                >
                                    <SelectTrigger className={cn(
                                        "rounded-xl bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200",
                                        errors.headOfHouseholdId
                                            ? "border-red-500 focus:ring-red-500"
                                            : "border-gray-200 dark:border-zinc-700"
                                    )}>
                                        <SelectValue placeholder="Select head of household" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50 max-h-[250px]">
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
                                {errors.headOfHouseholdId && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.headOfHouseholdId}
                                    </p>
                                )}
                            </div>

                            {/* Spouse */}
                            <div className="space-y-2">
                                <Label className="font-medium text-muted-foreground">Spouse (optional)</Label>
                                <Select
                                    value={formData.spouseId || 'none'}
                                    onValueChange={(val) => setFormData({ ...formData, spouseId: val === 'none' ? '' : val })}
                                >
                                    <SelectTrigger className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                        <SelectValue placeholder="Select spouse" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50 max-h-[250px]">
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
                            <div className="space-y-2">
                                <Label className="font-medium text-muted-foreground">Children</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formData.childrenIds.map(childId => (
                                        <Badge key={childId} variant="secondary" className="flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-zinc-800">
                                            {getMemberName(childId)}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveChild(childId)}
                                                className="hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full p-0.5 transition-colors duration-150"
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
                                    <SelectTrigger className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                        <SelectValue placeholder="+ Add child" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50 max-h-[250px]">
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

                        <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800 gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-200">
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
