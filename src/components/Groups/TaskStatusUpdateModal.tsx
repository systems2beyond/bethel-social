'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MinistryAssignment, MinistryAssignmentStatus } from '@/types';
import { MinistryAssignmentService } from '@/lib/services/MinistryAssignmentService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardList, CheckCircle, Inbox, PlayCircle, Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskStatusUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    assignmentId: string;
    currentStatus?: string;
    taskTitle?: string;
    onSuccess?: () => void;
}

const statusOptions: { value: MinistryAssignmentStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'backlog', label: 'Backlog', icon: <Inbox className="w-4 h-4" />, color: '#6B7280' },
    { value: 'assigned', label: 'Assigned', icon: <AlertCircle className="w-4 h-4" />, color: '#3B82F6' },
    { value: 'in_progress', label: 'In Progress', icon: <PlayCircle className="w-4 h-4" />, color: '#F59E0B' },
    { value: 'review', label: 'Review', icon: <Eye className="w-4 h-4" />, color: '#8B5CF6' },
    { value: 'completed', label: 'Completed', icon: <CheckCircle className="w-4 h-4" />, color: '#10B981' }
];

export function TaskStatusUpdateModal({
    isOpen,
    onClose,
    assignmentId,
    currentStatus,
    taskTitle,
    onSuccess
}: TaskStatusUpdateModalProps) {
    const { user, userData } = useAuth();
    const [status, setStatus] = useState<MinistryAssignmentStatus>((currentStatus as MinistryAssignmentStatus) || 'backlog');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [assignment, setAssignment] = useState<MinistryAssignment | null>(null);
    const [loadingAssignment, setLoadingAssignment] = useState(true);

    // Load assignment details
    useEffect(() => {
        if (isOpen && assignmentId) {
            loadAssignment();
        }
    }, [isOpen, assignmentId]);

    // Reset form when currentStatus changes
    useEffect(() => {
        if (currentStatus) {
            setStatus(currentStatus as MinistryAssignmentStatus);
        }
    }, [currentStatus]);

    const loadAssignment = async () => {
        setLoadingAssignment(true);
        try {
            const data = await MinistryAssignmentService.getAssignment(assignmentId);
            setAssignment(data);
            if (data?.status) {
                setStatus(data.status);
            }
        } catch (error) {
            console.error('Error loading assignment:', error);
        } finally {
            setLoadingAssignment(false);
        }
    };

    const handleSubmit = async () => {
        if (!user || !assignmentId) return;
        setLoading(true);

        try {
            // Update the assignment status
            await MinistryAssignmentService.updateAssignment(assignmentId, {
                status
            });

            // Add a comment with the status update if notes provided
            if (notes.trim() && assignment) {
                // If there's a linked group post, we could add a comment there
                // For now, just update the status
            }

            // Send notification about status change
            if (assignment && assignment.assignedById && assignment.assignedById !== user.uid) {
                await MinistryAssignmentService.notifyAssignee(
                    { ...assignment, status },
                    'status_changed',
                    {
                        uid: user.uid,
                        displayName: userData?.displayName || user.displayName || 'Team Member',
                        photoURL: user.photoURL || undefined
                    }
                );
            }

            setNotes('');
            onClose();
            onSuccess?.();
        } catch (error) {
            console.error('Error updating task status:', error);
            alert('Failed to update status. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const currentStatusOption = statusOptions.find(s => s.value === status);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                            <ClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        Update Task Status
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {taskTitle || 'Update the status of this task'}
                    </DialogDescription>
                </DialogHeader>

                {loadingAssignment ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : (
                    <div className="space-y-5 py-4">
                        {/* Current Status Display */}
                        {assignment && (
                            <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                                <h4 className="text-sm font-bold text-foreground mb-1 line-clamp-2">
                                    {assignment.title}
                                </h4>
                                {assignment.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {assignment.description}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Status Selector */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                New Status
                            </Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as MinistryAssignmentStatus)}>
                                <SelectTrigger className="rounded-xl h-12">
                                    <SelectValue>
                                        {currentStatusOption && (
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: `${currentStatusOption.color}20` }}
                                                >
                                                    <span style={{ color: currentStatusOption.color }}>
                                                        {currentStatusOption.icon}
                                                    </span>
                                                </div>
                                                <span className="font-medium">{currentStatusOption.label}</span>
                                            </div>
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {statusOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value} className="rounded-lg">
                                            <div className="flex items-center gap-3 py-1">
                                                <div
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: `${option.color}20` }}
                                                >
                                                    <span style={{ color: option.color }}>
                                                        {option.icon}
                                                    </span>
                                                </div>
                                                <span className="font-medium">{option.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Add a Note (Optional)
                            </Label>
                            <Textarea
                                placeholder="Share an update about this task..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[80px] rounded-xl resize-none"
                            />
                        </div>
                    </div>
                )}

                <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800 gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || loadingAssignment}
                        className="rounded-xl bg-orange-600 hover:bg-orange-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Update Status
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
