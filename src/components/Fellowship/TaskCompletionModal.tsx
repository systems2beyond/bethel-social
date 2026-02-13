'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MinistryAssignment, TaskAttachment, CompletionAttachment } from '@/types';
import { MinistryAssignmentService } from '@/lib/services/MinistryAssignmentService';
import { TaskAttachmentService } from '@/lib/services/TaskAttachmentService';
import { GoogleDriveUploadService, DriveApiError } from '@/lib/services/GoogleDriveUploadService';
import { TaskFileAttachmentSection, StagedAttachment } from '@/components/Tasks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Loader2,
    CheckCircle2,
    Download,
    Calendar,
    Flag,
    User,
    FileText,
    ExternalLink,
    Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { serverTimestamp } from 'firebase/firestore';

interface TaskCompletionModalProps {
    assignment: MinistryAssignment;
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

export function TaskCompletionModal({
    assignment,
    isOpen,
    onClose,
    onComplete
}: TaskCompletionModalProps) {
    const { user, userData, googleAccessToken, signInWithGoogle } = useAuth();

    // Form State
    const [completionNotes, setCompletionNotes] = useState(assignment.completionNotes || '');
    const [completionAttachments, setCompletionAttachments] = useState<CompletionAttachment[]>(
        assignment.completionAttachments || []
    );
    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
    const [loading, setLoading] = useState(false);

    const handleMarkComplete = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Upload any staged completion attachments
            const uploadedAttachments: CompletionAttachment[] = [...completionAttachments];

            for (const staged of stagedAttachments) {
                let uploaded: TaskAttachment | null = null;

                // Skip already-uploaded Drive files (uploaded inline via TaskFileAttachmentSection)
                if (staged.source === 'google_drive_upload' && staged.uploadedUrl) {
                    uploaded = {
                        type: staged.type,
                        url: staged.uploadedUrl,
                        name: staged.name,
                        mimeType: staged.file?.type || 'application/octet-stream',
                        size: staged.size,
                        source: 'google_drive_upload',
                        uploadedBy: user.uid,
                        driveFileId: staged.driveFileId,
                    } as TaskAttachment;
                } else if (staged.source === 'firebase' && staged.file) {
                    uploaded = await TaskAttachmentService.uploadToFirebase(
                        staged.file,
                        'ministry',
                        assignment.id,
                        user.uid,
                        userData?.churchId || ''
                    );
                } else if (staged.source === 'google_drive_link' && staged.driveUrl) {
                    uploaded = await TaskAttachmentService.processGoogleDriveLink(
                        staged.driveUrl,
                        user.uid
                    );
                } else if (staged.source === 'google_drive_upload' && staged.file && googleAccessToken) {
                    try {
                        const driveResult = await GoogleDriveUploadService.uploadToUserDrive(
                            staged.file,
                            googleAccessToken
                        );
                        uploaded = GoogleDriveUploadService.toTaskAttachment(driveResult, user.uid);
                    } catch (driveError: any) {
                        if (driveError instanceof DriveApiError && driveError.status === 401) {
                            console.log('[TaskCompletionModal] Token expired, re-authenticating...');
                            await signInWithGoogle();
                            const freshToken = sessionStorage.getItem('googleAccessToken');
                            if (freshToken) {
                                const driveResult = await GoogleDriveUploadService.uploadToUserDrive(
                                    staged.file,
                                    freshToken
                                );
                                uploaded = GoogleDriveUploadService.toTaskAttachment(driveResult, user.uid);
                            } else {
                                throw driveError;
                            }
                        } else {
                            throw driveError;
                        }
                    }
                }

                if (uploaded) {
                    uploadedAttachments.push({
                        ...uploaded,
                        attachmentContext: 'completion'
                    } as CompletionAttachment);
                }
            }

            // Update assignment with completion data
            await MinistryAssignmentService.updateAssignment(assignment.id, {
                status: 'completed',
                completedAt: serverTimestamp(),
                completedBy: user.uid,
                completionNotes: completionNotes.trim() || undefined,
                completionAttachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
            });

            onClose();
            onComplete?.();
        } catch (error) {
            console.error('Error completing task:', error);
            alert('Failed to complete task. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: any): string => {
        if (!date) return 'No due date';
        const d = date?.toDate ? date.toDate() :
            date?.seconds ? new Date(date.seconds * 1000) :
                new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const isOverdue = (): boolean => {
        if (!assignment.dueDate) return false;
        const due = assignment.dueDate?.toDate ? assignment.dueDate.toDate() :
            assignment.dueDate?.seconds ? new Date(assignment.dueDate.seconds * 1000) :
                new Date(assignment.dueDate);
        return due < new Date();
    };

    const priorityColors: Record<string, string> = {
        low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };

    const handleDownloadAttachment = (attachment: TaskAttachment) => {
        window.open(attachment.url, '_blank');
    };

    // Convert TaskAttachment[] to setter for TaskFileAttachmentSection
    const handleAttachmentsChange = (attachments: TaskAttachment[]) => {
        setCompletionAttachments(attachments.map(a => ({
            ...a,
            attachmentContext: 'completion' as const
        })));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        Complete Task
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Review task details and submit your completion
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Task Title & Priority */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {assignment.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge className={cn('text-xs', priorityColors[assignment.priority])}>
                                <Flag className="w-3 h-3 mr-1" />
                                {assignment.priority.charAt(0).toUpperCase() + assignment.priority.slice(1)}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={cn(
                                    isOverdue() && 'border-red-500 text-red-600 dark:text-red-400'
                                )}
                            >
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(assignment.dueDate)}
                            </Badge>
                        </div>
                    </div>

                    {/* Description */}
                    {assignment.description && (
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Description
                            </Label>
                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                                {assignment.description}
                            </p>
                        </div>
                    )}

                    {/* Assigned By */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        Assigned by {assignment.assignedByName}
                    </div>

                    {/* Leader's Attachments (Download) */}
                    {assignment.attachments && assignment.attachments.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                                <Paperclip className="w-3 h-3" />
                                Attached Files ({assignment.attachments.length})
                            </Label>
                            <div className="space-y-2">
                                {assignment.attachments.map((attachment, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {attachment.name}
                                                </p>
                                                {attachment.size && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {(attachment.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownloadAttachment(attachment)}
                                            className="flex-shrink-0"
                                        >
                                            {attachment.source === 'google_drive_link' || attachment.source === 'google_drive_upload' ? (
                                                <ExternalLink className="w-4 h-4" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Your Completion
                        </h4>

                        {/* Completion Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="completionNotes" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Completion Notes
                            </Label>
                            <Textarea
                                id="completionNotes"
                                placeholder="Add any notes about how you completed this task..."
                                value={completionNotes}
                                onChange={(e) => setCompletionNotes(e.target.value)}
                                className="min-h-[80px] rounded-xl resize-none"
                            />
                        </div>

                        {/* Completion File Attachments */}
                        <div className="mt-4">
                            <TaskFileAttachmentSection
                                attachments={completionAttachments}
                                stagedAttachments={stagedAttachments}
                                onAttachmentsChange={handleAttachmentsChange}
                                onStagedAttachmentsChange={setStagedAttachments}
                                mode="edit"
                            />
                        </div>
                    </div>
                </div>

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
                        onClick={handleMarkComplete}
                        disabled={loading}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Mark Complete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
