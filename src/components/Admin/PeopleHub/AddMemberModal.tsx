"use client";

import React, { useState } from 'react';
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
import { Loader2, User, Mail, Phone, Calendar, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface AddMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const steps = [
    { title: "Personal Info", description: "Basic details about the member" },
    { title: "Contact Info", description: "How to reach them" },
    { title: "Church Role", description: "Membership details" }
];

export function AddMemberModal({ open, onOpenChange }: AddMemberModalProps) {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',
        role: 'member',
        membershipStage: 'active'
    });

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

    const handleSubmit = async () => {
        if (!formData.firstName || !formData.lastName) {
            toast.error("Name is required");
            return;
        }

        setLoading(true);
        try {
            // Create user document (mock logic for now - usually managed via Admin SDK/Auth)
            // Storing in 'users' collection directly for now as per app pattern (usually synced)
            // Or 'members' if distinct. Following existing pattern of 'users' being the directory.
            await addDoc(collection(db, 'users'), {
                displayName: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                phoneNumber: formData.phone,
                role: formData.role,
                membershipStage: formData.membershipStage,
                dateOfBirth: formData.dob || null,
                createdAt: serverTimestamp(),
                photoURL: null,
            });

            toast.success("Member added successfully!");
            onOpenChange(false);
            setStep(0);
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                dob: '',
                role: 'member',
                membershipStage: 'active'
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
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-gray-100 dark:border-zinc-800">
                {/* Header with visual step indicator */}
                <div className="bg-gray-50/50 dark:bg-zinc-900/50 p-6 border-b border-gray-100 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Add New Member</DialogTitle>
                        <DialogDescription>
                            {steps[step].description}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-2 mt-6">
                        {steps.map((s, i) => (
                            <div key={i} className="flex-1">
                                <div className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'bg-rose-500' : 'bg-gray-200 dark:bg-zinc-800'
                                    }`} />
                                <span className={`text-[10px] mt-1.5 block font-medium uppercase tracking-wider ${i === step ? 'text-rose-500' : 'text-muted-foreground'
                                    }`}>
                                    {s.title}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6">
                    {step === 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>First Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Jane"
                                            className="pl-9"
                                            value={formData.firstName}
                                            onChange={(e) => handleChange('firstName', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Last Name</Label>
                                    <Input
                                        placeholder="Doe"
                                        value={formData.lastName}
                                        onChange={(e) => handleChange('lastName', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Date of Birth (Optional)</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        className="pl-9"
                                        value={formData.dob}
                                        onChange={(e) => handleChange('dob', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="email"
                                        placeholder="jane@example.com"
                                        className="pl-9"
                                        value={formData.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="tel"
                                        placeholder="(555) 123-4567"
                                        className="pl-9"
                                        value={formData.phone}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label>Initial Role</Label>
                                <Select value={formData.role} onValueChange={(val) => handleChange('role', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="member">Member</SelectItem>
                                        <SelectItem value="visitor">Visitor</SelectItem>
                                        <SelectItem value="staff">Staff</SelectItem>
                                        <SelectItem value="ministry_leader">Ministry Leader</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.membershipStage} onValueChange={(val) => handleChange('membershipStage', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="visitor">Visitor</SelectItem>
                                        <SelectItem value="non-member">Non-Member</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-2 flex items-center justify-between border-t border-gray-50 dark:border-zinc-800">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 0 || loading}
                        className="text-muted-foreground"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={loading}
                        className="bg-rose-500 hover:bg-rose-600 text-white min-w-[100px]"
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
