"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Loader2, ShieldCheck, Search, X, User, Plus, MapPin, AlertCircle, Map } from "lucide-react";
import { District, FirestoreUser } from '@/types';
import { DistrictService } from '@/lib/services/DistrictService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues with Google Maps
const ZipCodeMapSelector = dynamic(
    () => import('./ZipCodeMapSelector'),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                <span className="text-sm text-muted-foreground">Loading map...</span>
            </div>
        )
    }
);

interface DistrictModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    districtId?: string;
    preSelectedMemberId?: string;
    members: FirestoreUser[];
    onSuccess?: () => void;
}

export function DistrictModal({
    open,
    onOpenChange,
    districtId,
    preSelectedMemberId,
    members,
    onSuccess
}: DistrictModalProps) {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(false);
    const [fetchingDistrict, setFetchingDistrict] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        leaderId: '',
        coLeaderIds: [] as string[],
        memberIds: [] as string[],
        assignmentMethod: 'manual' as 'geographic' | 'alphabetic' | 'manual' | 'affinity',
        zipCodes: [] as string[]
    });

    // ZIP code input
    const [zipCodeInput, setZipCodeInput] = useState('');
    const [showMapView, setShowMapView] = useState(false);

    // Member search states
    const [leaderSearch, setLeaderSearch] = useState('');
    const [showLeaderDropdown, setShowLeaderDropdown] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const leaderSearchRef = useRef<HTMLDivElement>(null);
    const memberSearchRef = useRef<HTMLDivElement>(null);

    // Load existing district if editing
    useEffect(() => {
        if (districtId && open) {
            setFetchingDistrict(true);
            DistrictService.getDistrict(districtId)
                .then(district => {
                    if (district) {
                        setFormData({
                            name: district.name,
                            leaderId: district.leaderId,
                            coLeaderIds: district.coLeaderIds || [],
                            memberIds: district.memberIds || [],
                            assignmentMethod: district.assignmentMethod || 'manual',
                            zipCodes: district.geographicBounds?.zipCodes || []
                        });
                        // Set leader search to show name
                        const leader = members.find(m => m.uid === district.leaderId);
                        if (leader) {
                            setLeaderSearch(leader.displayName || leader.email || '');
                        }
                    }
                })
                .catch(err => {
                    console.error('Failed to load district:', err);
                    toast.error('Failed to load district');
                })
                .finally(() => setFetchingDistrict(false));
        } else if (open && preSelectedMemberId) {
            // Pre-select member when creating from member row
            setFormData(prev => ({
                ...prev,
                memberIds: [preSelectedMemberId]
            }));
        }
    }, [districtId, open, preSelectedMemberId, members]);

    // Click outside handlers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (leaderSearchRef.current && !leaderSearchRef.current.contains(event.target as Node)) {
                setShowLeaderDropdown(false);
            }
            if (memberSearchRef.current && !memberSearchRef.current.contains(event.target as Node)) {
                setShowMemberDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            setFormData({
                name: '',
                leaderId: '',
                coLeaderIds: [],
                memberIds: [],
                assignmentMethod: 'manual',
                zipCodes: []
            });
            setLeaderSearch('');
            setMemberSearch('');
            setZipCodeInput('');
            setShowMapView(false);
            setErrors({});
        }
    }, [open]);

    // Filter members for search
    const filteredLeaders = members.filter(m => {
        if (!leaderSearch.trim()) return true;
        const searchLower = leaderSearch.toLowerCase();
        return (m.displayName?.toLowerCase().includes(searchLower) ||
            m.email?.toLowerCase().includes(searchLower));
    }).slice(0, 10);

    const filteredMembersForAdd = members.filter(m => {
        // Exclude already added members
        if (formData.memberIds.includes(m.uid)) return false;
        if (!memberSearch.trim()) return true;
        const searchLower = memberSearch.toLowerCase();
        return (m.displayName?.toLowerCase().includes(searchLower) ||
            m.email?.toLowerCase().includes(searchLower));
    }).slice(0, 10);

    // Get selected members details
    const selectedMembers = formData.memberIds
        .map(id => members.find(m => m.uid === id))
        .filter(Boolean) as FirestoreUser[];

    const selectedLeader = members.find(m => m.uid === formData.leaderId);

    // Members matching the entered ZIP codes (for geographic assignment)
    const membersInZipCodes = useMemo(() => {
        if (formData.assignmentMethod !== 'geographic' || formData.zipCodes.length === 0) {
            return [];
        }
        return members.filter(m => {
            const memberZip = m.address?.postalCode?.trim();
            if (!memberZip) return false;
            return formData.zipCodes.some(zip => memberZip.startsWith(zip.trim()));
        });
    }, [members, formData.zipCodes, formData.assignmentMethod]);

    // Handle adding a ZIP code
    const handleAddZipCode = useCallback(() => {
        const zip = zipCodeInput.trim();
        if (!zip) return;

        // Validate ZIP code format (US 5-digit or 5+4)
        const zipPattern = /^\d{5}(-\d{4})?$/;
        if (!zipPattern.test(zip)) {
            toast.error('Please enter a valid 5-digit ZIP code');
            return;
        }

        if (formData.zipCodes.includes(zip)) {
            toast.error('This ZIP code is already added');
            return;
        }

        setFormData(prev => ({
            ...prev,
            zipCodes: [...prev.zipCodes, zip]
        }));
        setZipCodeInput('');
    }, [zipCodeInput, formData.zipCodes]);

    // Handle removing a ZIP code
    const handleRemoveZipCode = useCallback((zip: string) => {
        setFormData(prev => ({
            ...prev,
            zipCodes: prev.zipCodes.filter(z => z !== zip)
        }));
    }, []);

    // Auto-add members from ZIP codes to the member list
    const handleAutoAddZipMembers = useCallback(() => {
        const newMemberIds = membersInZipCodes
            .map(m => m.uid)
            .filter(id => !formData.memberIds.includes(id));

        if (newMemberIds.length === 0) {
            toast.info('All matching members are already added');
            return;
        }

        setFormData(prev => ({
            ...prev,
            memberIds: [...prev.memberIds, ...newMemberIds]
        }));
        toast.success(`Added ${newMemberIds.length} member${newMemberIds.length > 1 ? 's' : ''} from ZIP codes`);
    }, [membersInZipCodes, formData.memberIds]);

    const clearError = (field: string) => {
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSelectLeader = (member: FirestoreUser) => {
        setFormData(prev => ({
            ...prev,
            leaderId: member.uid,
            // Automatically add leader to members if not already
            memberIds: prev.memberIds.includes(member.uid)
                ? prev.memberIds
                : [...prev.memberIds, member.uid]
        }));
        setLeaderSearch(member.displayName || member.email || '');
        setShowLeaderDropdown(false);
        clearError('leaderId');
    };

    const handleClearLeader = () => {
        setFormData(prev => ({ ...prev, leaderId: '' }));
        setLeaderSearch('');
    };

    const handleAddMember = (member: FirestoreUser) => {
        setFormData(prev => ({
            ...prev,
            memberIds: [...prev.memberIds, member.uid]
        }));
        setMemberSearch('');
        setShowMemberDropdown(false);
    };

    const handleRemoveMember = (memberId: string) => {
        // Don't allow removing the leader
        if (memberId === formData.leaderId) {
            toast.error("Cannot remove the district leader from members");
            return;
        }
        setFormData(prev => ({
            ...prev,
            memberIds: prev.memberIds.filter(id => id !== memberId),
            coLeaderIds: prev.coLeaderIds.filter(id => id !== memberId)
        }));
    };

    const handleSubmit = async () => {
        // Validation
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'District name is required';
        }
        if (!formData.leaderId) {
            newErrors.leaderId = 'A leader must be assigned';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        try {
            // Build geographicBounds if using geographic assignment
            const geographicBounds = formData.assignmentMethod === 'geographic' && formData.zipCodes.length > 0
                ? { zipCodes: formData.zipCodes }
                : undefined;

            if (districtId) {
                // Update existing
                await DistrictService.updateDistrict(districtId, {
                    name: formData.name.trim(),
                    leaderId: formData.leaderId,
                    coLeaderIds: formData.coLeaderIds,
                    memberIds: formData.memberIds,
                    assignmentMethod: formData.assignmentMethod,
                    geographicBounds
                });
                toast.success('District updated successfully');
            } else {
                // Create new
                await DistrictService.createDistrict(
                    {
                        name: formData.name.trim(),
                        churchId: userData?.churchId || 'default',
                        leaderId: formData.leaderId,
                        leaderName: selectedLeader?.displayName || selectedLeader?.email,
                        coLeaderIds: formData.coLeaderIds,
                        memberIds: formData.memberIds,
                        assignmentMethod: formData.assignmentMethod,
                        geographicBounds,
                        isActive: true
                    },
                    userData?.uid || 'system'
                );
                toast.success('District created successfully');
            }

            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save district:', error);
            toast.error(districtId ? 'Failed to update district' : 'Failed to create district');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        {districtId ? 'Edit District' : 'Create District'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {districtId
                            ? 'Update district details and member assignments'
                            : 'Create a new pastoral care district and assign members'
                        }
                    </DialogDescription>
                </DialogHeader>

                {fetchingDistrict ? (
                    <div className="py-12 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    </div>
                ) : (
                    <div className="space-y-5 py-4">
                        {/* District Name */}
                        <div className="space-y-2">
                            <Label className={cn(
                                "font-medium",
                                errors.name ? "text-red-500" : "text-muted-foreground"
                            )}>
                                District Name
                            </Label>
                            <Input
                                placeholder="e.g., North District, Zone A, Flock 1"
                                value={formData.name}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, name: e.target.value }));
                                    clearError('name');
                                }}
                                className={cn(
                                    "rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50",
                                    errors.name && "border-red-500 focus:ring-red-500"
                                )}
                            />
                            {errors.name && (
                                <p className="text-xs text-red-500">{errors.name}</p>
                            )}
                        </div>

                        {/* Leader Selection */}
                        <div className="space-y-2">
                            <Label className={cn(
                                "font-medium",
                                errors.leaderId ? "text-red-500" : "text-muted-foreground"
                            )}>
                                District Leader
                            </Label>
                            <div className="relative" ref={leaderSearchRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        type="text"
                                        placeholder="Search for leader..."
                                        value={leaderSearch}
                                        onChange={(e) => {
                                            setLeaderSearch(e.target.value);
                                            setShowLeaderDropdown(true);
                                            if (!e.target.value.trim()) {
                                                setFormData(prev => ({ ...prev, leaderId: '' }));
                                            }
                                        }}
                                        onFocus={() => setShowLeaderDropdown(true)}
                                        className={cn(
                                            "pl-9 pr-8 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50",
                                            errors.leaderId && "border-red-500"
                                        )}
                                    />
                                    {formData.leaderId && (
                                        <button
                                            type="button"
                                            onClick={handleClearLeader}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {showLeaderDropdown && leaderSearch.trim() && filteredLeaders.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-[200px] overflow-y-auto">
                                        {filteredLeaders.map(member => (
                                            <button
                                                key={member.uid}
                                                type="button"
                                                onClick={() => handleSelectLeader(member)}
                                                className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${formData.leaderId === member.uid ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium">
                                                    {(member.displayName || member.email || 'U').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{member.displayName || 'No Name'}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {formData.leaderId && selectedLeader && !showLeaderDropdown && (
                                    <div className="mt-1.5 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        <span>Leader: {selectedLeader.displayName || selectedLeader.email}</span>
                                    </div>
                                )}
                            </div>
                            {errors.leaderId && (
                                <p className="text-xs text-red-500">{errors.leaderId}</p>
                            )}
                        </div>

                        {/* Assignment Method */}
                        <div className="space-y-2">
                            <Label className="font-medium text-muted-foreground">
                                Assignment Method
                            </Label>
                            <Select
                                value={formData.assignmentMethod}
                                onValueChange={(val: any) => setFormData(prev => ({ ...prev, assignmentMethod: val }))}
                            >
                                <SelectTrigger className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="manual">Manual Assignment</SelectItem>
                                    <SelectItem value="geographic">Geographic (by ZIP code)</SelectItem>
                                    <SelectItem value="alphabetic">Alphabetic (by last name)</SelectItem>
                                    <SelectItem value="affinity">Affinity-Based</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* ZIP Code Section - Only visible when geographic is selected */}
                        {formData.assignmentMethod === 'geographic' && (
                            <div className="space-y-3 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                        <MapPin className="h-4 w-4" />
                                        <Label className="font-medium">
                                            ZIP Code Coverage
                                        </Label>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            type="button"
                                            variant={!showMapView ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setShowMapView(false)}
                                            className="h-7 text-xs rounded-lg"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Manual
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={showMapView ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setShowMapView(true)}
                                            className="h-7 text-xs rounded-lg"
                                        >
                                            <Map className="h-3 w-3 mr-1" />
                                            Map
                                        </Button>
                                    </div>
                                </div>

                                {showMapView ? (
                                    /* Map View */
                                    <ZipCodeMapSelector
                                        zipCodes={formData.zipCodes}
                                        onZipCodesChange={(newZips) => setFormData(prev => ({ ...prev, zipCodes: newZips }))}
                                        churchLocation={undefined} // TODO: Pass church location if available
                                    />
                                ) : (
                                    /* Manual Entry View */
                                    <>
                                        <p className="text-xs text-muted-foreground">
                                            Enter ZIP codes for this district. Members with matching addresses will be shown below.
                                        </p>

                                        {/* ZIP Code Input */}
                                        <div className="flex gap-2">
                                            <Input
                                                type="text"
                                                placeholder="Enter ZIP code (e.g., 30301)"
                                                value={zipCodeInput}
                                                onChange={(e) => setZipCodeInput(e.target.value.replace(/[^0-9-]/g, '').slice(0, 10))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddZipCode();
                                                    }
                                                }}
                                                className="flex-1 rounded-xl border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                            />
                                            <Button
                                                type="button"
                                                onClick={handleAddZipCode}
                                                disabled={!zipCodeInput.trim()}
                                                variant="outline"
                                                className="rounded-xl"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* ZIP Code Tags */}
                                        {formData.zipCodes.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {formData.zipCodes.map(zip => (
                                                    <span
                                                        key={zip}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium"
                                                    >
                                                        <MapPin className="h-3 w-3" />
                                                        {zip}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveZipCode(zip)}
                                                            className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Members in ZIP Codes */}
                                {formData.zipCodes.length > 0 && (
                                    <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/30">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                                Members in these ZIP codes: {membersInZipCodes.length}
                                            </span>
                                            {membersInZipCodes.length > 0 && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleAutoAddZipMembers}
                                                    className="h-7 text-xs rounded-lg border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Add All to District
                                                </Button>
                                            )}
                                        </div>

                                        {membersInZipCodes.length === 0 ? (
                                            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
                                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span>No members found with addresses in these ZIP codes</span>
                                            </div>
                                        ) : (
                                            <div className="max-h-[120px] overflow-y-auto space-y-1">
                                                {membersInZipCodes.map(member => {
                                                    const isAlreadyAdded = formData.memberIds.includes(member.uid);
                                                    return (
                                                        <div
                                                            key={member.uid}
                                                            className={cn(
                                                                "flex items-center gap-2 p-1.5 rounded-lg text-xs",
                                                                isAlreadyAdded
                                                                    ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                                                    : "bg-white dark:bg-zinc-800/50"
                                                            )}
                                                        >
                                                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium">
                                                                {(member.displayName || member.email || 'U').slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="font-medium truncate flex-1">
                                                                {member.displayName || 'No Name'}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {member.address?.postalCode}
                                                            </span>
                                                            {isAlreadyAdded && (
                                                                <span className="text-green-600 dark:text-green-400 text-[10px] font-semibold">
                                                                    Added
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Members */}
                        <div className="space-y-2">
                            <Label className="font-medium text-muted-foreground">
                                District Members ({selectedMembers.length})
                            </Label>

                            {/* Add member search */}
                            <div className="relative" ref={memberSearchRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        type="text"
                                        placeholder="Search to add members..."
                                        value={memberSearch}
                                        onChange={(e) => {
                                            setMemberSearch(e.target.value);
                                            setShowMemberDropdown(true);
                                        }}
                                        onFocus={() => setShowMemberDropdown(true)}
                                        className="pl-9 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50"
                                    />
                                </div>

                                {showMemberDropdown && memberSearch.trim() && filteredMembersForAdd.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-[200px] overflow-y-auto">
                                        {filteredMembersForAdd.map(member => (
                                            <button
                                                key={member.uid}
                                                type="button"
                                                onClick={() => handleAddMember(member)}
                                                className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium">
                                                    {(member.displayName || member.email || 'U').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{member.displayName || 'No Name'}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                                                </div>
                                                <Plus className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected members list */}
                            {selectedMembers.length > 0 && (
                                <div className="mt-3 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {selectedMembers.map(member => (
                                            <div
                                                key={member.uid}
                                                className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium">
                                                    {(member.displayName || member.email || 'U').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate text-sm">
                                                        {member.displayName || 'No Name'}
                                                        {member.uid === formData.leaderId && (
                                                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                                                                Leader
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMember(member.uid)}
                                                    className={cn(
                                                        "p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors",
                                                        member.uid === formData.leaderId && "opacity-30 cursor-not-allowed"
                                                    )}
                                                    disabled={member.uid === formData.leaderId}
                                                >
                                                    <X className="h-4 w-4 text-muted-foreground" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || fetchingDistrict}
                        className="rounded-xl bg-amber-600 hover:bg-amber-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {districtId ? 'Update District' : 'Create District'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
