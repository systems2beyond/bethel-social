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
import { useAuth } from '@/context/AuthContext';
import { RoadmapService } from '@/lib/services/RoadmapService';
import { Ministry, MinistryRoadmap } from '@/types';
import { toast } from 'sonner';
import { Map, Loader2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CreateRoadmapModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry: Ministry;
    roadmapToEdit?: MinistryRoadmap;
}

export function CreateRoadmapModal({
    isOpen,
    onClose,
    ministry,
    roadmapToEdit
}: CreateRoadmapModalProps) {
    const { userData } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [targetEndDate, setTargetEndDate] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (roadmapToEdit) {
                setTitle(roadmapToEdit.title);
                setDescription(roadmapToEdit.description || '');

                // Safe date extraction
                const extractDate = (val: any): string => {
                    if (!val) return '';
                    let d: Date | null = null;
                    if (val instanceof Date) d = val;
                    else if (val?.toDate) d = val.toDate();
                    else if (val?.seconds) d = new Date(val.seconds * 1000);
                    else if (typeof val === 'string') d = parseISO(val);
                    return d ? format(d, 'yyyy-MM-dd') : '';
                };

                setStartDate(extractDate(roadmapToEdit.startDate));
                setTargetEndDate(extractDate(roadmapToEdit.targetEndDate));
            } else {
                // Reset for new
                setTitle('');
                setDescription('');
                setStartDate(format(new Date(), 'yyyy-MM-dd'));
                setTargetEndDate('');
            }
        }
    }, [isOpen, roadmapToEdit]);

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Please enter a roadmap title');
            return;
        }
        if (!userData) {
            toast.error('You must be logged in');
            return;
        }

        setIsSubmitting(true);
        try {
            const roadmapData = {
                ministryId: ministry.id,
                churchId: ministry.churchId,
                title: title.trim(),
                description: description.trim() || undefined,
                startDate: startDate ? parseISO(`${startDate}T12:00:00`) : undefined,
                targetEndDate: targetEndDate ? parseISO(`${targetEndDate}T12:00:00`) : undefined,
                status: 'active' as const,
                createdBy: userData.uid,
                createdByName: userData.displayName || 'Unknown'
            };

            if (roadmapToEdit) {
                await RoadmapService.updateRoadmap(roadmapToEdit.id, {
                    title: roadmapData.title,
                    description: roadmapData.description,
                    startDate: roadmapData.startDate,
                    targetEndDate: roadmapData.targetEndDate
                });
                toast.success('Roadmap updated');
            } else {
                await RoadmapService.createRoadmap(roadmapData);
                toast.success('Roadmap created');
            }

            onClose();
        } catch (error) {
            console.error('Error saving roadmap:', error);
            toast.error('Failed to save roadmap');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditing = !!roadmapToEdit;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Map className="w-5 h-5 text-indigo-500" />
                        {isEditing ? 'Edit Roadmap' : 'Create Roadmap'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Update your ministry roadmap details.'
                            : 'Create a strategic roadmap to plan and track your ministry goals.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Roadmap Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g. 2026 Ministry Vision"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe the goals and vision for this roadmap..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate" className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Start Date
                            </Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="targetEndDate" className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Target End Date
                            </Label>
                            <Input
                                id="targetEndDate"
                                type="date"
                                value={targetEndDate}
                                onChange={(e) => setTargetEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Create Roadmap'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
