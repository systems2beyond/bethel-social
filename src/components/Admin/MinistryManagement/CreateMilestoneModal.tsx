'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RoadmapService } from '@/lib/services/RoadmapService';
import { MinistryRoadmap, RoadmapMilestone, MilestoneStatus } from '@/types';
import { toast } from 'sonner';
import { Target, Loader2, Calendar, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CreateMilestoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    roadmap: MinistryRoadmap;
    milestoneToEdit?: RoadmapMilestone;
    existingMilestonesCount?: number; // For setting default order
}

export function CreateMilestoneModal({
    isOpen,
    onClose,
    roadmap,
    milestoneToEdit,
    existingMilestonesCount = 0
}: CreateMilestoneModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [status, setStatus] = useState<MilestoneStatus>('not_started');

    useEffect(() => {
        if (isOpen) {
            if (milestoneToEdit) {
                setTitle(milestoneToEdit.title);
                setDescription(milestoneToEdit.description || '');
                setStatus(milestoneToEdit.status);

                // Safe date extraction
                const val = milestoneToEdit.targetDate;
                if (val) {
                    let d: Date | null = null;
                    if (val instanceof Date) d = val;
                    else if (val?.toDate) d = val.toDate();
                    else if (val?.seconds) d = new Date(val.seconds * 1000);
                    else if (typeof val === 'string') d = parseISO(val);
                    setTargetDate(d ? format(d, 'yyyy-MM-dd') : '');
                } else {
                    setTargetDate('');
                }
            } else {
                // Reset for new
                setTitle('');
                setDescription('');
                setTargetDate('');
                setStatus('not_started');
            }
        }
    }, [isOpen, milestoneToEdit]);

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Please enter a milestone title');
            return;
        }

        setIsSubmitting(true);
        try {
            const milestoneData = {
                roadmapId: roadmap.id,
                ministryId: roadmap.ministryId,
                title: title.trim(),
                description: description.trim() || undefined,
                targetDate: targetDate ? parseISO(`${targetDate}T12:00:00`) : undefined,
                status,
                order: milestoneToEdit?.order ?? existingMilestonesCount
            };

            if (milestoneToEdit) {
                await RoadmapService.updateMilestone(milestoneToEdit.id, {
                    title: milestoneData.title,
                    description: milestoneData.description,
                    targetDate: milestoneData.targetDate,
                    status: milestoneData.status
                });
                toast.success('Milestone updated');
            } else {
                await RoadmapService.createMilestone(milestoneData);
                toast.success('Milestone created');
            }

            onClose();
        } catch (error) {
            console.error('Error saving milestone:', error);
            toast.error('Failed to save milestone');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!milestoneToEdit) return;

        if (!confirm('Are you sure you want to delete this milestone? This cannot be undone.')) {
            return;
        }

        setIsDeleting(true);
        try {
            await RoadmapService.deleteMilestone(milestoneToEdit.id);
            toast.success('Milestone deleted');
            onClose();
        } catch (error) {
            console.error('Error deleting milestone:', error);
            toast.error('Failed to delete milestone');
        } finally {
            setIsDeleting(false);
        }
    };

    const isEditing = !!milestoneToEdit;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-500" />
                        {isEditing ? 'Edit Milestone' : 'Add Milestone'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update this milestone and track your progress.'
                            : 'Add a milestone to track progress toward your ministry goals.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Milestone Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Launch new choir program"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe what this milestone involves..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Target Date & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="targetDate" className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Target Date
                            </Label>
                            <Input
                                id="targetDate"
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={status} onValueChange={(val) => setStatus(val as MilestoneStatus)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="not_started">Not Started</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {isEditing && (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isSubmitting || isDeleting}
                            className="sm:mr-auto"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Delete
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting || isDeleting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSubmitting || isDeleting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Add Milestone'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
