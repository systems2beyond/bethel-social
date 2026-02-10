"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Mail, Phone, Calendar, ArrowRight, ArrowLeft, CheckCircle, MapPin, ShieldCheck, Plus } from "lucide-react";
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { District, FirestoreUser } from '@/types';
import { DistrictService } from '@/lib/services/DistrictService';
import { useAuth } from '@/context/AuthContext';

interface AddMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    districts?: District[];
    members?: FirestoreUser[];
    onDistrictCreated?: () => void;
}

const steps = [
    { title: "Personal Info", description: "Basic details about the member" },
    { title: "Contact Info", description: "How to reach them" },
    { title: "Church Role", description: "Membership & district assignment" }
];

export function AddMemberModal({ open, onOpenChange, districts = [], members = [], onDistrictCreated }: AddMemberModalProps) {
    const { userData } = useAuth();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showCreateDistrict, setShowCreateDistrict] = useState(false);
    const [newDistrictName, setNewDistrictName] = useState('');
    const [creatingDistrict, setCreatingDistrict] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',
        street1: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        role: 'member',
        membershipStage: 'active',
        districtId: ''
    });

    // Find matching district based on postal code
    const matchingDistrict = useMemo(() => {
        const postalCode = formData.postalCode?.trim();
        if (!postalCode || postalCode.length < 5) return null;

        // Find a district with geographic bounds that include this ZIP code
        return districts.find(district => {
            if (!district.isActive || !district.geographicBounds?.zipCodes) return false;
            return district.geographicBounds.zipCodes.some(zip =>
                postalCode.startsWith(zip.trim()) || zip.trim().startsWith(postalCode)
            );
        }) || null;
    }, [formData.postalCode, districts]);

    // Auto-select district when postal code matches a geographic district
    useEffect(() => {
        // Only auto-select if:
        // 1. There's a matching district
        // 2. No district is currently selected (don't override manual selection)
        // 3. The postal code is valid (5+ digits)
        if (matchingDistrict && !formData.districtId && formData.postalCode?.length >= 5) {
            setFormData(prev => ({ ...prev, districtId: matchingDistrict.id }));
        }
    }, [matchingDistrict, formData.districtId, formData.postalCode]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    const handleCreateDistrict = async () => {
        if (!newDistrictName.trim()) {
            toast.error("District name is required");
            return;
        }

        setCreatingDistrict(true);
        try {
            const newDistrict = await DistrictService.createDistrict(
                {
                    name: newDistrictName.trim(),
                    churchId: userData?.churchId || 'default',
                    leaderId: userData?.uid || '',
                    leaderName: userData?.displayName || '',
                    coLeaderIds: [],
                    memberIds: [],
                    assignmentMethod: 'manual',
                    isActive: true
                },
                userData?.uid || 'system'
            );

            // Update form with new district
            setFormData(prev => ({ ...prev, districtId: newDistrict.id }));
            setShowCreateDistrict(false);
            setNewDistrictName('');
            toast.success(`District "${newDistrictName}" created`);
            onDistrictCreated?.();
        } catch (error) {
            console.error('Failed to create district:', error);
            toast.error("Failed to create district");
        } finally {
            setCreatingDistrict(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.firstName || !formData.lastName) {
            toast.error("Name is required");
            return;
        }

        setLoading(true);
        try {
            // Create user document
            const docRef = await addDoc(collection(db, 'users'), {
                displayName: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                phoneNumber: formData.phone,
                role: formData.role,
                membershipStage: formData.membershipStage,
                dateOfBirth: formData.dob || null,
                address: formData.street1 ? {
                    street1: formData.street1,
                    street2: formData.street2 || null,
                    city: formData.city,
                    state: formData.state,
                    postalCode: formData.postalCode,
                    country: 'USA'
                } : null,
                districtId: formData.districtId || null,
                districtRole: formData.districtId ? 'member' : null,
                createdAt: serverTimestamp(),
                photoURL: null,
            });

            // If district selected, add member to district
            if (formData.districtId) {
                await DistrictService.addMemberToDistrict(formData.districtId, docRef.id, 'member');
            }

            toast.success("Member added successfully!");
            onOpenChange(false);
            setStep(0);
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                dob: '',
                street1: '',
                street2: '',
                city: '',
                state: '',
                postalCode: '',
                role: 'member',
                membershipStage: 'active',
                districtId: ''
            });
        } catch (error) {
            console.error(error);
            toast.error("Failed to add member");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                {/* Header with visual step indicator */}
                <div className="bg-gradient-to-r from-gray-50/80 to-gray-100/50 dark:from-zinc-800/80 dark:to-zinc-800/50 p-6 border-b border-gray-100 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            Add New Member
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {steps[step].description}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-3 mt-6">
                        {steps.map((s, i) => (
                            <div key={i} className="flex-1">
                                <div className={`h-2 rounded-full transition-all duration-300 ${i <= step ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-sm' : 'bg-gray-200 dark:bg-zinc-700'
                                    }`} />
                                <span className={`text-[10px] mt-2 block font-semibold uppercase tracking-wider ${i === step ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'
                                    }`}>
                                    {s.title}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6">
                    {step === 0 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-medium text-muted-foreground">First Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Jane"
                                            className="pl-9 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                            value={formData.firstName}
                                            onChange={(e) => handleChange('firstName', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-medium text-muted-foreground">Last Name</Label>
                                    <Input
                                        placeholder="Doe"
                                        className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                        value={formData.lastName}
                                        onChange={(e) => handleChange('lastName', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-medium text-muted-foreground">Date of Birth (Optional)</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        className="pl-9 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                        value={formData.dob}
                                        onChange={(e) => handleChange('dob', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-medium text-muted-foreground">Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            placeholder="jane@example.com"
                                            className="pl-9 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                            value={formData.email}
                                            onChange={(e) => handleChange('email', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-medium text-muted-foreground">Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="tel"
                                            placeholder="(555) 123-4567"
                                            className="pl-9 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                            value={formData.phone}
                                            onChange={(e) => handleChange('phone', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Address Section */}
                            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                                <Label className="font-medium text-muted-foreground flex items-center gap-2 mb-3">
                                    <MapPin className="h-4 w-4" /> Address (for geographic district assignment)
                                </Label>
                                <div className="space-y-3">
                                    <Input
                                        placeholder="Street Address"
                                        className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                        value={formData.street1}
                                        onChange={(e) => handleChange('street1', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Apt, Suite, Unit (Optional)"
                                        className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                        value={formData.street2}
                                        onChange={(e) => handleChange('street2', e.target.value)}
                                    />
                                    <div className="grid grid-cols-6 gap-2">
                                        <Input
                                            placeholder="City"
                                            className="col-span-3 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                            value={formData.city}
                                            onChange={(e) => handleChange('city', e.target.value)}
                                        />
                                        <Input
                                            placeholder="State"
                                            className="col-span-1 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                            value={formData.state}
                                            onChange={(e) => handleChange('state', e.target.value)}
                                        />
                                        <Input
                                            placeholder="ZIP"
                                            className="col-span-2 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                            value={formData.postalCode}
                                            onChange={(e) => handleChange('postalCode', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-medium text-muted-foreground">Initial Role</Label>
                                    <Select value={formData.role} onValueChange={(val) => handleChange('role', val)}>
                                        <SelectTrigger className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50">
                                            <SelectItem value="member">Member</SelectItem>
                                            <SelectItem value="visitor">Visitor</SelectItem>
                                            <SelectItem value="staff">Staff</SelectItem>
                                            <SelectItem value="ministry_leader">Ministry Leader</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-medium text-muted-foreground">Status</Label>
                                    <Select value={formData.membershipStage} onValueChange={(val) => handleChange('membershipStage', val)}>
                                        <SelectTrigger className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50">
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                            <SelectItem value="visitor">Visitor</SelectItem>
                                            <SelectItem value="non-member">Non-Member</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* District Assignment */}
                            <div className="pt-3 border-t border-gray-100 dark:border-zinc-800">
                                <Label className="font-medium text-muted-foreground flex items-center gap-2 mb-3">
                                    <ShieldCheck className="h-4 w-4 text-amber-500" /> Pastoral Care District (Optional)
                                </Label>

                                {/* Auto-match indicator */}
                                {matchingDistrict && formData.districtId === matchingDistrict.id && (
                                    <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/50">
                                        <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        <span className="text-xs text-green-700 dark:text-green-300">
                                            Auto-matched to <strong>{matchingDistrict.name}</strong> based on ZIP code {formData.postalCode}
                                        </span>
                                    </div>
                                )}

                                {!showCreateDistrict ? (
                                    <div className="space-y-3">
                                        <Select
                                            value={formData.districtId}
                                            onValueChange={(val) => handleChange('districtId', val === 'none' ? '' : val)}
                                        >
                                            <SelectTrigger className="rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                                <SelectValue placeholder="Select district (optional)" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50">
                                                <SelectItem value="none">No District</SelectItem>
                                                {districts.filter(d => d.isActive).map(district => (
                                                    <SelectItem key={district.id} value={district.id}>
                                                        <div className="flex items-center gap-2">
                                                            <span>{district.name}</span>
                                                            {district.geographicBounds?.zipCodes?.length ? (
                                                                <span className="text-xs text-green-600 dark:text-green-400">
                                                                    (Geographic)
                                                                </span>
                                                            ) : null}
                                                            <span className="text-xs text-muted-foreground">
                                                                ({district.memberIds?.length || 0} members)
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowCreateDistrict(true)}
                                            className="w-full rounded-xl border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create New District
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                                        <Label className="text-sm font-medium text-amber-900 dark:text-amber-100">
                                            New District Name
                                        </Label>
                                        <Input
                                            placeholder="e.g., North District, Zone A, Flock 1"
                                            value={newDistrictName}
                                            onChange={(e) => setNewDistrictName(e.target.value)}
                                            className="rounded-xl border-amber-200 dark:border-amber-700 bg-white dark:bg-zinc-800"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setShowCreateDistrict(false);
                                                    setNewDistrictName('');
                                                }}
                                                disabled={creatingDistrict}
                                                className="flex-1 rounded-xl"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleCreateDistrict}
                                                disabled={creatingDistrict || !newDistrictName.trim()}
                                                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                                            >
                                                {creatingDistrict ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Plus className="h-4 w-4 mr-2" />
                                                )}
                                                Create
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 flex items-center justify-between border-t border-gray-100 dark:border-zinc-800">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 0 || loading}
                        className="text-muted-foreground rounded-xl"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={loading}
                        className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white min-w-[120px] shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : step === steps.length - 1 ? (
                            <>Complete <CheckCircle className="w-4 h-4 ml-2" /></>
                        ) : (
                            <>Next <ArrowRight className="w-4 h-4 ml-2" /></>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
