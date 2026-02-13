'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MinistryAssignment, MinistryPipelineStage, FirestoreUser, Ministry, TaskAttachment } from '@/types';
import { MinistryAssignmentService } from '@/lib/services/MinistryAssignmentService';
import { TaskAttachmentService } from '@/lib/services/TaskAttachmentService';
import { TaskFileAttachmentSection, StagedAttachment } from '@/components/Tasks';
import { MinistryPipelineBoardService } from '@/lib/services/MinistryPipelineBoardService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardList, Calendar, User, Flag, Send, MessageSquare, Users, Paperclip } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry: Ministry;
    assignment?: MinistryAssignment | null; // Null for new, defined for edit
    onSuccess?: () => void;
}

export function AssignmentModal({
    isOpen,
    onClose,
    ministry,
    assignment,
    onSuccess
}: AssignmentModalProps) {
    const { user, userData } = useAuth();
    const isEditing = !!assignment;

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [dueDate, setDueDate] = useState('');
    const [stageId, setStageId] = useState('');

    // Options
    const [postToGroup, setPostToGroup] = useState(false);
    const [sendDM, setSendDM] = useState(true);

    // Attachments
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

    // Data
    const [members, setMembers] = useState<FirestoreUser[]>([]);
    const [stages, setStages] = useState<MinistryPipelineStage[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    // Load members and stages when modal opens
    useEffect(() => {
        if (isOpen && ministry.id) {
            loadData();
        }
    }, [isOpen, ministry.id]);

    // Populate form when editing
    useEffect(() => {
        if (assignment) {
            setTitle(assignment.title);
            setDescription(assignment.description || '');
            setPriority(assignment.priority);
            setAssigneeId(assignment.assignedToId || '');
            setStageId(assignment.stageId || '');
            setAttachments(assignment.attachments || []);
            if (assignment.dueDate) {
                const date = assignment.dueDate?.toDate ? assignment.dueDate.toDate() :
                    assignment.dueDate?.seconds ? new Date(assignment.dueDate.seconds * 1000) : null;
                if (date) {
                    setDueDate(date.toISOString().split('T')[0]);
                }
            }
        } else {
            resetForm();
        }
    }, [assignment]);

    const loadData = async () => {
        setLoadingData(true);
        try {
            // Load ministry members (users who are serving in this ministry)
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const allUsers = usersSnapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            })) as FirestoreUser[];

            // Filter to members serving in this ministry
            const ministryMembers = allUsers.filter(u =>
                u.servingIn?.some(s => s.ministryId === ministry.id && s.status === 'active') ||
                u.volunteerProfile?.ministries?.includes(ministry.id)
            );
            setMembers(ministryMembers);

            // Load pipeline stages
            const board = await MinistryPipelineBoardService.getDefaultBoard(ministry.id);
            if (board) {
                setStages(board.stages);
                if (!stageId && board.stages.length > 0) {
                    setStageId(board.stages[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPriority('normal');
        setAssigneeId('');
        setDueDate('');
        setPostToGroup(false);
        setSendDM(true);
        setAttachments([]);
        setStagedAttachments([]);
    };

    const handleSubmit = async () => {
        if (!user || !userData?.churchId || !title.trim()) return;
        setLoading(true);

        try {
            const assignee = members.find(m => m.uid === assigneeId);

            // Upload staged attachments
            const uploadedAttachments: TaskAttachment[] = [...attachments];

            for (const staged of stagedAttachments) {
                if (staged.source === 'firebase' && staged.file) {
                    // Upload to Firebase Storage
                    const uploaded = await TaskAttachmentService.uploadToFirebase(
                        staged.file,
                        'ministry',
                        assignment?.id || 'temp',
                        user.uid,
                        userData.churchId
                    );
                    uploadedAttachments.push(uploaded);
                } else if (staged.source === 'google_drive_link' && staged.driveUrl) {
                    // Process Drive link
                    const driveAttachment = await TaskAttachmentService.processGoogleDriveLink(
                        staged.driveUrl,
                        user.uid
                    );
                    uploadedAttachments.push(driveAttachment);
                } else if (staged.source === 'google_drive_upload' && staged.uploadedUrl) {
                    // Already uploaded to Drive
                    uploadedAttachments.push({
                        type: staged.type,
                        url: staged.uploadedUrl,
                        name: staged.name,
                        mimeType: staged.file?.type || 'application/octet-stream',
                        size: staged.size,
                        source: 'google_drive_upload',
                        uploadedBy: user.uid,
                        uploadedAt: new Date(),
                        driveFileId: staged.driveFileId,
                        isPublicLink: true
                    });
                }
            }

            const assignmentData: Omit<MinistryAssignment, 'id' | 'createdAt' | 'updatedAt'> = {
                churchId: userData.churchId,
                ministryId: ministry.id,
                title: title.trim(),
                description: description.trim() || undefined,
                priority,
                assignedToId: assigneeId || undefined,
                assignedToName: assignee?.displayName || undefined,
                assignedById: user.uid,
                assignedByName: userData.displayName || user.displayName || 'Admin',
                status: assigneeId ? 'assigned' : 'backlog',
                stageId: stageId || stages[0]?.id || '',
                dueDate: dueDate ? new Date(dueDate) : undefined,
                attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
                isArchived: false
            };

            let savedAssignmentId: string;

            if (isEditing && assignment) {
                await MinistryAssignmentService.updateAssignment(assignment.id, assignmentData);
                savedAssignmentId = assignment.id;
            } else {
                savedAssignmentId = await MinistryAssignmentService.createAssignment(assignmentData);
            }

            // Get full assignment for integrations
            const savedAssignment = await MinistryAssignmentService.getAssignment(savedAssignmentId);

            if (savedAssignment && assigneeId) {
                // Send notification
                await MinistryAssignmentService.notifyAssignee(
                    savedAssignment,
                    isEditing ? 'status_changed' : 'assigned',
                    {
                        uid: user.uid,
                        displayName: userData.displayName || user.displayName || 'Admin',
                        photoURL: user.photoURL || undefined
                    }
                );

                // Send DM if enabled
                if (sendDM && !isEditing) {
                    await MinistryAssignmentService.createDMThread(
                        savedAssignment,
                        {
                            uid: user.uid,
                            displayName: userData.displayName || user.displayName || 'Admin',
                            photoURL: user.photoURL || undefined
                        }
                    );
                }

                // Post to group if enabled
                if (postToGroup && ministry.linkedGroupId) {
                    await MinistryAssignmentService.postToMinistryGroup(
                        savedAssignment,
                        ministry.linkedGroupId,
                        {
                            name: userData.displayName || user.displayName || 'Admin',
                            avatarUrl: user.photoURL || undefined,
                            uid: user.uid
                        }
                    );
                }
            }

            resetForm();
            onClose();
            onSuccess?.();
        } catch (error) {
            console.error('Error saving assignment:', error);
            alert('Failed to save task. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const priorityOptions = [
        { value: 'low', label: 'Low', color: 'text-gray-500' },
        { value: 'normal', label: 'Normal', color: 'text-blue-500' },
        { value: 'high', label: 'High', color: 'text-orange-500' },
        { value: 'urgent', label: 'Urgent', color: 'text-red-500' }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                            <ClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        {isEditing ? 'Edit Task' : 'Create Task'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {isEditing ? 'Update task details' : `Create a new task for ${ministry.name}`}
                    </DialogDescription>
                </DialogHeader>

                {loadingData ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : (
                    <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Task Title *
                            </Label>
                            <Input
                                id="title"
                                placeholder="Enter task title..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                placeholder="Add details about this task..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="min-h-[80px] rounded-xl resize-none"
                            />
                        </div>

                        {/* File Attachments */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                                <Paperclip className="w-3 h-3" />
                                Attachments
                            </Label>
                            <TaskFileAttachmentSection
                                attachments={attachments}
                                onAttachmentsChange={setAttachments}
                                stagedAttachments={stagedAttachments}
                                onStagedAttachmentsChange={setStagedAttachments}
                                mode="edit"
                                disabled={loading}
                            />
                        </div>

                        {/* Two Column Row */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Assignee */}
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-2">
                                    <User className="w-3 h-3" />
                                    Assign To
                                </Label>
                                <Select
                                    value={assigneeId || '__unassigned__'}
                                    onValueChange={(v) => setAssigneeId(v === '__unassigned__' ? '' : v)}
                                >
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select member" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                        {members.map(member => (
                                            <SelectItem key={member.uid} value={member.uid || `member-${member.uid}`}>
                                                {member.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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

                        {/* Due Date and Stage Row */}
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

                            {/* Stage */}
                            <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                    Stage
                                </Label>
                                <Select value={stageId} onValueChange={setStageId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select stage" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {stages.filter(s => s.id).map(stage => (
                                            <SelectItem key={stage.id} value={stage.id}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: stage.color }}
                                                    />
                                                    {stage.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Integration Options */}
                        {assigneeId && !isEditing && (
                            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
                                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                    Notification Options
                                </Label>

                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <MessageSquare className="w-4 h-4 text-blue-500" />
                                        <div>
                                            <p className="text-sm font-medium">Send Direct Message</p>
                                            <p className="text-xs text-muted-foreground">Notify assignee via inbox</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={sendDM}
                                        onCheckedChange={setSendDM}
                                    />
                                </div>

                                {ministry.linkedGroupId && (
                                    <div className="flex items-center justify-between py-2">
                                        <div className="flex items-center gap-3">
                                            <Users className="w-4 h-4 text-purple-500" />
                                            <div>
                                                <p className="text-sm font-medium">Post to Group</p>
                                                <p className="text-xs text-muted-foreground">Share in ministry group feed</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={postToGroup}
                                            onCheckedChange={setPostToGroup}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
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
                        disabled={!title.trim() || loading || loadingData}
                        className="rounded-xl bg-orange-600 hover:bg-orange-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        {isEditing ? 'Update Task' : 'Create Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
