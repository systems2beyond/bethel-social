"use client";

import React, { useState, useRef, useEffect } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LifeEvent, FirestoreUser } from '@/types';
import { LifeEventService } from '@/lib/services/LifeEventService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { serverTimestamp } from 'firebase/firestore';
import { Search, X, User } from 'lucide-react';

interface LifeEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberId?: string;
    members?: FirestoreUser[];
    onSuccess?: () => void;
}

export const LifeEventModal: React.FC<LifeEventModalProps> = ({
    isOpen,
    onClose,
    memberId: initialMemberId,
    members,
    onSuccess
}) => {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId || '');
    const [memberSearch, setMemberSearch] = useState('');
    const [showMemberDropdown, setShowMemberDropdown] = useState(false);
    const memberSearchRef = useRef<HTMLDivElement>(null);
    const [formData, setFormData] = useState<Partial<LifeEvent>>({
        eventType: 'other',
        priority: 'normal',
        description: '',
        requiresFollowUp: true,
        assignedTo: ''
    });

    // Filter members based on search
    const filteredMembers = members?.filter(member => {
        if (!memberSearch.trim()) return true;
        const searchLower = memberSearch.toLowerCase();
        const name = member.displayName?.toLowerCase() || '';
        const email = member.email?.toLowerCase() || '';
        return name.includes(searchLower) || email.includes(searchLower);
    }).slice(0, 10) || []; // Limit to 10 results for performance

    // Get selected member name for display
    const selectedMember = members?.find(m => m.uid === selectedMemberId);
    const selectedMemberName = selectedMember?.displayName || selectedMember?.email || '';

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (memberSearchRef.current && !memberSearchRef.current.contains(event.target as Node)) {
                setShowMemberDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle member selection
    const handleSelectMember = (member: FirestoreUser) => {
        setSelectedMemberId(member.uid);
        setMemberSearch(member.displayName || member.email || '');
        setShowMemberDropdown(false);
    };

    // Clear member selection
    const handleClearMember = () => {
        setSelectedMemberId('');
        setMemberSearch('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const targetMemberId = initialMemberId || selectedMemberId;
        if (!targetMemberId) {
            toast.error('Please select a member');
            return;
        }

        const selectedMember = members?.find(m => m.uid === targetMemberId);
        if (!selectedMember && !initialMemberId) {
            toast.error('Member not found');
            return;
        }

        setLoading(true);
        try {
            await LifeEventService.createLifeEvent(
                {
                    memberId: targetMemberId,
                    memberName: selectedMember?.displayName || 'Unknown Member',
                    eventType: formData.eventType as LifeEvent['eventType'],
                    eventDate: serverTimestamp(),
                    description: formData.description || '',
                    priority: formData.priority as LifeEvent['priority'],
                    requiresFollowUp: formData.requiresFollowUp || false,
                    assignedTo: formData.assignedTo || undefined,
                    status: 'new',
                    isActive: true
                },
                userData?.uid || 'system'
            );

            toast.success('Life event logged successfully');

            // Reset form
            setFormData({
                eventType: 'other',
                priority: 'normal',
                description: '',
                requiresFollowUp: true,
                assignedTo: ''
            });
            setSelectedMemberId('');
            setMemberSearch('');

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Failed to create life event:', error);
            toast.error('Failed to log life event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[520px] rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/30">
                            <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        Log Life Event
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Record a significant life event for pastoral care tracking
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 py-4">

                    {/* Member Selector (if not pre-selected) - Searchable Input */}
                    {!initialMemberId && members && members.length > 0 && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="member" className="text-right font-medium text-muted-foreground">Member</Label>
                            <div className="col-span-3 relative" ref={memberSearchRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        type="text"
                                        placeholder="Search members by name or email..."
                                        value={memberSearch}
                                        onChange={(e) => {
                                            setMemberSearch(e.target.value);
                                            setShowMemberDropdown(true);
                                            if (!e.target.value.trim()) {
                                                setSelectedMemberId('');
                                            }
                                        }}
                                        onFocus={() => setShowMemberDropdown(true)}
                                        className="pl-9 pr-8 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                                    />
                                    {selectedMemberId && (
                                        <button
                                            type="button"
                                            onClick={handleClearMember}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown Results */}
                                {showMemberDropdown && memberSearch.trim() && filteredMembers.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-[200px] overflow-y-auto">
                                        {filteredMembers.map(member => (
                                            <button
                                                key={member.uid}
                                                type="button"
                                                onClick={() => handleSelectMember(member)}
                                                className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors ${
                                                    selectedMemberId === member.uid ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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

                                {/* No results message */}
                                {showMemberDropdown && memberSearch.trim() && filteredMembers.length === 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg p-3 text-center text-muted-foreground text-sm">
                                        No members found matching "{memberSearch}"
                                    </div>
                                )}

                                {/* Selected member indicator */}
                                {selectedMemberId && selectedMemberName && !showMemberDropdown && (
                                    <div className="mt-1.5 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                        <User className="h-3.5 w-3.5" />
                                        <span>Selected: {selectedMemberName}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Event Type */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="eventType" className="text-right font-medium text-muted-foreground">Type</Label>
                        <Select
                            value={formData.eventType}
                            onValueChange={(val) => setFormData({ ...formData, eventType: val as LifeEvent['eventType'] })}
                        >
                            <SelectTrigger className="col-span-3 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50 max-h-[300px]">
                                <SelectItem value="hospitalized">Hospitalized</SelectItem>
                                <SelectItem value="surgery">Surgery</SelectItem>
                                <SelectItem value="serious_illness">Serious Illness</SelectItem>
                                <SelectItem value="pregnancy_announced">Pregnancy Announced</SelectItem>
                                <SelectItem value="baby_born">Baby Born</SelectItem>
                                <SelectItem value="engagement">Engagement</SelectItem>
                                <SelectItem value="marriage">Marriage</SelectItem>
                                <SelectItem value="divorce">Divorce</SelectItem>
                                <SelectItem value="death_in_family">Death in Family</SelectItem>
                                <SelectItem value="job_loss">Job Loss</SelectItem>
                                <SelectItem value="new_job">New Job</SelectItem>
                                <SelectItem value="retirement">Retirement</SelectItem>
                                <SelectItem value="graduation">Graduation</SelectItem>
                                <SelectItem value="college_acceptance">College Acceptance</SelectItem>
                                <SelectItem value="moved">Moved</SelectItem>
                                <SelectItem value="milestone_birthday">Milestone Birthday</SelectItem>
                                <SelectItem value="anniversary">Anniversary</SelectItem>
                                <SelectItem value="salvation">Salvation</SelectItem>
                                <SelectItem value="baptism_scheduled">Baptism Scheduled</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Priority */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="priority" className="text-right font-medium text-muted-foreground">Priority</Label>
                        <Select
                            value={formData.priority}
                            onValueChange={(val: any) => setFormData({ ...formData, priority: val })}
                        >
                            <SelectTrigger className="col-span-3 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border border-gray-200/50 dark:border-zinc-700/50">
                                <SelectItem value="urgent" className="text-red-600 font-bold">Urgent</SelectItem>
                                <SelectItem value="high" className="text-orange-500">High</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="description" className="text-right mt-2 font-medium text-muted-foreground">Details</Label>
                        <Textarea
                            id="description"
                            className="col-span-3 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200 min-h-[100px]"
                            placeholder="Describe the situation..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Assigned To */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="assignedTo" className="text-right font-medium text-muted-foreground">Assign To</Label>
                        <Input
                            id="assignedTo"
                            className="col-span-3 rounded-xl border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-200"
                            placeholder="Staff member name (optional)"
                            value={formData.assignedTo}
                            onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                        />
                    </div>

                    {/* Follow Up Checkbox */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <div className="col-start-2 col-span-3 flex items-center space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50">
                            <Checkbox
                                id="followUp"
                                checked={formData.requiresFollowUp}
                                onCheckedChange={(checked) => setFormData({ ...formData, requiresFollowUp: checked as boolean })}
                                className="data-[state=checked]:bg-blue-600"
                            />
                            <Label htmlFor="followUp" className="cursor-pointer">Requires Follow-up?</Label>
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800 gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-200">
                            {loading ? 'Saving...' : 'Save Event'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
