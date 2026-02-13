'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PersonalTask, TaskAttachment } from '@/types';
import { PersonalTaskService } from '@/lib/services/PersonalTaskService';
import { TaskAttachmentService } from '@/lib/services/TaskAttachmentService';
import { GoogleDriveUploadService, DriveApiError } from '@/lib/services/GoogleDriveUploadService';
import { TaskFileAttachmentSection, StagedAttachment } from '@/components/Tasks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardList, Calendar, Flag, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreatePersonalTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task?: PersonalTask | null; // Null for new, defined for edit
    onSuccess?: () => void;
}

export function CreatePersonalTaskModal({
    isOpen,
    onClose,
    task,
    onSuccess
}: CreatePersonalTaskModalProps) {
    const { user, userData, googleAccessToken, signInWithGoogle } = useAuth();
    const isEditing = !!task;

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');
    const [loading, setLoading] = useState(false);

    // Attachments
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

    // Populate form when editing
    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setPriority(task.priority);
            setStatus(task.status);
            if (task.dueDate) {
                const date = task.dueDate?.toDate ? task.dueDate.toDate() :
                    task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000) : null;
                if (date) {
                    setDueDate(date.toISOString().split('T')[0]);
                }
            }
            // Populate existing attachments
            setAttachments(task.attachments || []);
            setStagedAttachments([]);
        } else {
            resetForm();
        }
    }, [task, isOpen]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPriority('normal');
        setDueDate('');
        setStatus('todo');
        setAttachments([]);
        setStagedAttachments([]);
    };

    const handleSubmit = async () => {
        if (!user || !title.trim()) return;
        setLoading(true);

        try {
            // Upload staged attachments first
            const uploadedAttachments: TaskAttachment[] = [...attachments];
            const tempTaskId = task?.id || `temp-${Date.now()}`;

            for (const staged of stagedAttachments) {
                // Skip already-uploaded Drive files (uploaded inline via TaskFileAttachmentSection)
                if (staged.source === 'google_drive_upload' && staged.uploadedUrl) {
                    uploadedAttachments.push({
                        type: staged.type,
                        url: staged.uploadedUrl,
                        name: staged.name,
                        mimeType: staged.file?.type || 'application/octet-stream',
                        size: staged.size,
                        source: 'google_drive_upload',
                        uploadedBy: user.uid,
                        driveFileId: staged.driveFileId,
                    } as TaskAttachment);
                } else if (staged.source === 'firebase' && staged.file) {
                    const uploaded = await TaskAttachmentService.uploadToFirebase(
                        staged.file,
                        'personal',
                        tempTaskId,
                        user.uid,
                        userData?.churchId || ''
                    );
                    uploadedAttachments.push(uploaded);
                } else if (staged.source === 'google_drive_link' && staged.driveUrl) {
                    const driveAttachment = await TaskAttachmentService.processGoogleDriveLink(
                        staged.driveUrl,
                        user.uid
                    );
                    uploadedAttachments.push(driveAttachment);
                } else if (staged.source === 'google_drive_upload' && staged.file && googleAccessToken) {
                    try {
                        const driveResult = await GoogleDriveUploadService.uploadToUserDrive(
                            staged.file,
                            googleAccessToken
                        );
                        const driveAttachment = GoogleDriveUploadService.toTaskAttachment(driveResult, user.uid);
                        uploadedAttachments.push(driveAttachment);
                    } catch (driveError: any) {
                        if (driveError instanceof DriveApiError && driveError.status === 401) {
                            console.log('[CreatePersonalTaskModal] Token expired, re-authenticating...');
                            await signInWithGoogle();
                            const freshToken = sessionStorage.getItem('googleAccessToken');
                            if (freshToken) {
                                const driveResult = await GoogleDriveUploadService.uploadToUserDrive(
                                    staged.file,
                                    freshToken
                                );
                                const driveAttachment = GoogleDriveUploadService.toTaskAttachment(driveResult, user.uid);
                                uploadedAttachments.push(driveAttachment);
                            } else {
                                throw driveError;
                            }
                        } else {
                            throw driveError;
                        }
                    }
                }
            }

            const taskData: Omit<PersonalTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'> = {
                userId: user.uid,
                churchId: userData?.churchId,
                title: title.trim(),
                description: description.trim() || undefined,
                priority,
                status,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                isArchived: false,
                attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
            };

            if (isEditing && task) {
                await PersonalTaskService.updateTask(task.id, taskData);
            } else {
                await PersonalTaskService.createTask(taskData);
            }

            resetForm();
            onClose();
            onSuccess?.();
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Failed to save task. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const priorityOptions = [
        { value: 'low', label: 'Low', color: 'text-gray-500' },
        { value: 'normal', label: 'Normal', color: 'text-blue-500' },
        { value: 'high', label: 'High', color: 'text-orange-500' }
    ];

    const statusOptions = [
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'done', label: 'Done' }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                            <ClipboardList className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        {isEditing ? 'Edit Task' : 'New Personal Task'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {isEditing ? 'Update your task' : 'Create a personal reminder or to-do'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                            Task Title *
                        </Label>
                        <Input
                            id="title"
                            placeholder="What do you need to do?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="rounded-xl"
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                            Notes
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Add any additional details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[60px] rounded-xl resize-none"
                        />
                    </div>

                    {/* Two Column Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Due Date */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                Due Date
                            </Label>
                            <Input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>

                        {/* Priority */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                                <Flag className="w-3 h-3" />
                                Priority
                            </Label>
                            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {priorityOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <span className={opt.color}>{opt.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Status (for editing) */}
                    {isEditing && (
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Status
                            </Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {statusOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* File Attachments */}
                    <TaskFileAttachmentSection
                        attachments={attachments}
                        stagedAttachments={stagedAttachments}
                        onAttachmentsChange={setAttachments}
                        onStagedAttachmentsChange={setStagedAttachments}
                        mode="edit"
                    />
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
                        onClick={handleSubmit}
                        disabled={!title.trim() || loading}
                        className="rounded-xl bg-violet-600 hover:bg-violet-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        {isEditing ? 'Update' : 'Create Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
