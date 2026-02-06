"use client";

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
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
    const [formData, setFormData] = useState<Partial<LifeEvent>>({
        eventType: 'other',
        priority: 'normal',
        description: '',
        requiresFollowUp: true,
        assignedTo: ''
    });

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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Log Life Event</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">

                    {/* Member Selector (if not pre-selected) */}
                    {!initialMemberId && members && members.length > 0 && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="member" className="text-right">Member</Label>
                            <Select
                                value={selectedMemberId}
                                onValueChange={setSelectedMemberId}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select member" />
                                </SelectTrigger>
                                <SelectContent>
                                    {members.map(member => (
                                        <SelectItem key={member.uid} value={member.uid}>
                                            {member.displayName || member.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Event Type */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="eventType" className="text-right">Type</Label>
                        <Select
                            value={formData.eventType}
                            onValueChange={(val) => setFormData({ ...formData, eventType: val as LifeEvent['eventType'] })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
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
                        <Label htmlFor="priority" className="text-right">Priority</Label>
                        <Select
                            value={formData.priority}
                            onValueChange={(val: any) => setFormData({ ...formData, priority: val })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="urgent" className="text-red-600 font-bold">Urgent</SelectItem>
                                <SelectItem value="high" className="text-orange-500">High</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="description" className="text-right mt-2">Details</Label>
                        <Textarea
                            id="description"
                            className="col-span-3"
                            placeholder="Describe the situation..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Assigned To */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="assignedTo" className="text-right">Assign To</Label>
                        <Input
                            id="assignedTo"
                            className="col-span-3"
                            placeholder="Staff member name (optional)"
                            value={formData.assignedTo}
                            onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                        />
                    </div>

                    {/* Follow Up Checkbox */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <div className="col-start-2 col-span-3 flex items-center space-x-2">
                            <Checkbox
                                id="followUp"
                                checked={formData.requiresFollowUp}
                                onCheckedChange={(checked) => setFormData({ ...formData, requiresFollowUp: checked as boolean })}
                            />
                            <Label htmlFor="followUp">Requires Follow-up?</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Event'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
