"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
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
import { Loader2, ShieldCheck, User, AlertCircle } from "lucide-react";
import { District, FirestoreUser } from '@/types';
import { DistrictService } from '@/lib/services/DistrictService';
import { toast } from 'sonner';

interface AssignDistrictModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: FirestoreUser | null;
    districts: District[];
    onSuccess?: () => void;
}

export function AssignDistrictModal({
    open,
    onOpenChange,
    member,
    districts,
    onSuccess
}: AssignDistrictModalProps) {
    const [loading, setLoading] = useState(false);
    const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
    const [currentDistrict, setCurrentDistrict] = useState<District | null>(null);

    // Reset and load current district when modal opens
    useEffect(() => {
        if (open && member) {
            // Find current district if member is assigned
            if (member.districtId) {
                const district = districts.find(d => d.id === member.districtId);
                setCurrentDistrict(district || null);
                setSelectedDistrictId(member.districtId);
            } else {
                setCurrentDistrict(null);
                setSelectedDistrictId('');
            }
        }
    }, [open, member, districts]);

    // Reset when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedDistrictId('');
            setCurrentDistrict(null);
        }
    }, [open]);

    const handleAssign = async () => {
        if (!member || !selectedDistrictId) {
            toast.error("Please select a district");
            return;
        }

        // Skip if assigning to same district
        if (selectedDistrictId === member.districtId) {
            onOpenChange(false);
            return;
        }

        setLoading(true);
        try {
            // Remove from old district if exists
            if (member.districtId && member.districtId !== selectedDistrictId) {
                await DistrictService.removeMemberFromDistrict(member.districtId, member.uid);
            }

            // Add to new district
            await DistrictService.addMemberToDistrict(selectedDistrictId, member.uid, 'member');

            const newDistrict = districts.find(d => d.id === selectedDistrictId);
            toast.success(`${member.displayName || member.email} assigned to ${newDistrict?.name || 'district'}`);
            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to assign district:', error);
            toast.error("Failed to assign district");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFromDistrict = async () => {
        if (!member || !member.districtId) return;

        setLoading(true);
        try {
            await DistrictService.removeMemberFromDistrict(member.districtId, member.uid);
            toast.success(`${member.displayName || member.email} removed from district`);
            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to remove from district:', error);
            toast.error(error.message || "Failed to remove from district");
        } finally {
            setLoading(false);
        }
    };

    const selectedDistrict = districts.find(d => d.id === selectedDistrictId);
    const activeDistricts = districts.filter(d => d.isActive);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px] rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        Assign to District
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Assign this member to a pastoral care district
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Member Info */}
                    {member && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium">
                                {member.photoURL ? (
                                    <img src={member.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    (member.displayName || member.email || 'U').slice(0, 2).toUpperCase()
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{member.displayName || 'No Name'}</div>
                                <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                            </div>
                        </div>
                    )}

                    {/* Current District Info */}
                    {currentDistrict && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                            <User className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div className="flex-1 text-sm">
                                <p className="text-amber-900 dark:text-amber-100">
                                    Currently in <span className="font-semibold">{currentDistrict.name}</span>
                                </p>
                                {currentDistrict.leaderName && (
                                    <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                                        Led by {currentDistrict.leaderName}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* District Selection */}
                    <div className="space-y-2">
                        <Label className="font-medium text-muted-foreground">
                            Select District
                        </Label>
                        {activeDistricts.length > 0 ? (
                            <Select
                                value={selectedDistrictId}
                                onValueChange={setSelectedDistrictId}
                            >
                                <SelectTrigger className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50">
                                    <SelectValue placeholder="Choose a district..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {activeDistricts.map(district => (
                                        <SelectItem key={district.id} value={district.id}>
                                            <div className="flex items-center gap-2">
                                                <span>{district.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    ({district.memberIds?.length || 0} members)
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-zinc-800 rounded-xl text-sm text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                <span>No districts available. Create districts in Admin Settings.</span>
                            </div>
                        )}
                    </div>

                    {/* Selected District Info */}
                    {selectedDistrict && selectedDistrictId !== member?.districtId && (
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl text-sm">
                            <div className="font-medium">{selectedDistrict.name}</div>
                            {selectedDistrict.leaderName && (
                                <div className="text-muted-foreground text-xs mt-1">
                                    Led by {selectedDistrict.leaderName}
                                </div>
                            )}
                            <div className="text-muted-foreground text-xs">
                                {selectedDistrict.memberIds?.length || 0} current members
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800 gap-2">
                    {currentDistrict && member?.districtRole !== 'leader' && (
                        <Button
                            variant="ghost"
                            onClick={handleRemoveFromDistrict}
                            disabled={loading}
                            className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 mr-auto"
                        >
                            Remove from District
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={loading || !selectedDistrictId || activeDistricts.length === 0}
                        className="rounded-xl bg-amber-600 hover:bg-amber-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {selectedDistrictId === member?.districtId ? 'Done' : 'Assign'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
