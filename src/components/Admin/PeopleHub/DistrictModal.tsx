"use client";

import React, { useState, useEffect, useRef } from 'react';
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
import { Loader2, ShieldCheck, Search, X, User, Plus } from "lucide-react";
import { District, FirestoreUser } from '@/types';
import { DistrictService } from '@/lib/services/DistrictService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
        assignmentMethod: 'manual' as 'geographic' | 'alphabetic' | 'manual' | 'affinity'
    });

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
                            assignmentMethod: district.assignmentMethod || 'manual'
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
                assignmentMethod: 'manual'
            });
            setLeaderSearch('');
            setMemberSearch('');
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
            if (districtId) {
                // Update existing
                await DistrictService.updateDistrict(districtId, {
                    name: formData.name.trim(),
                    leaderId: formData.leaderId,
                    coLeaderIds: formData.coLeaderIds,
                    memberIds: formData.memberIds,
                    assignmentMethod: formData.assignmentMethod
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
