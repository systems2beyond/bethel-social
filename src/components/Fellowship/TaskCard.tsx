'use client';

import React, { useState } from 'react';
import { MinistryAssignment, PersonalTask } from '@/types';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import {
    Calendar,
    AlertCircle,
    Clock,
    CheckCircle2,
    Circle,
    PlayCircle,
    MoreHorizontal,
    Trash2,
    Archive,
    Church,
    User as UserIcon,
    Paperclip
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Unified task type for display
export interface UnifiedTask {
    id: string;
    title: string;
    description?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    status: 'todo' | 'in_progress' | 'done' | 'backlog' | 'assigned' | 'review' | 'completed' | 'blocked';
    dueDate?: any;
    isMinistryTask: boolean;
    ministryName?: string;
    ministryColor?: string;
    assignedByName?: string;
    createdAt: any;
    attachmentCount?: number;
    // Original data for updates
    originalTask: MinistryAssignment | PersonalTask;
}

interface TaskCardProps {
    task: UnifiedTask;
    onStatusChange: (taskId: string, newStatus: string, isMinistry: boolean) => void;
    onDelete: (taskId: string, isMinistry: boolean) => void;
    onArchive?: (taskId: string, isMinistry: boolean) => void;
    onClick?: () => void;
}

export function TaskCard({
    task,
    onStatusChange,
    onDelete,
    onArchive,
    onClick
}: TaskCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);

    // Priority styling
    const priorityStyles = {
        low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        normal: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        high: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        urgent: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
    };

    // Status icon and color
    const getStatusIcon = () => {
        const normalizedStatus = normalizeStatus(task.status);
        switch (normalizedStatus) {
            case 'done':
                return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'in_progress':
                return <PlayCircle className="w-5 h-5 text-amber-500" />;
            default:
                return <Circle className="w-5 h-5 text-gray-400" />;
        }
    };

    // Normalize ministry statuses to personal task statuses
    const normalizeStatus = (status: string): 'todo' | 'in_progress' | 'done' => {
        switch (status) {
            case 'completed':
            case 'done':
                return 'done';
            case 'in_progress':
            case 'review':
                return 'in_progress';
            default:
                return 'todo';
        }
    };

    // Get next status for cycling
    const getNextStatus = (): string => {
        const normalized = normalizeStatus(task.status);
        if (task.isMinistryTask) {
            // For ministry tasks, cycle through ministry statuses
            switch (task.status) {
                case 'backlog':
                case 'assigned':
                    return 'in_progress';
                case 'in_progress':
                    return 'review';
                case 'review':
                    return 'completed';
                case 'completed':
                    return 'backlog';
                default:
                    return 'in_progress';
            }
        } else {
            // For personal tasks
            switch (normalized) {
                case 'todo':
                    return 'in_progress';
                case 'in_progress':
                    return 'done';
                case 'done':
                    return 'todo';
                default:
                    return 'in_progress';
            }
        }
    };

    // Due date helpers
    const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() :
        task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000) : null;
    const isCompleted = normalizeStatus(task.status) === 'done';
    const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && !isCompleted;
    const isDueToday = dueDate && isToday(dueDate);
    const isDueTomorrow = dueDate && isTomorrow(dueDate);

    const handleStatusClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsUpdating(true);
        try {
            await onStatusChange(task.id, getNextStatus(), task.isMinistryTask);
        } finally {
            setIsUpdating(false);
        }
    };

    const getDueDateDisplay = () => {
        if (!dueDate) return null;

        let label = format(dueDate, 'MMM d');
        let className = 'text-gray-500';

        if (isOverdue) {
            label = 'Overdue';
            className = 'text-red-500 font-semibold';
        } else if (isDueToday) {
            label = 'Today';
            className = 'text-amber-600 font-semibold';
        } else if (isDueTomorrow) {
            label = 'Tomorrow';
            className = 'text-blue-500';
        }

        return (
            <span className={cn("flex items-center gap-1 text-xs", className)}>
                <Calendar className="w-3 h-3" />
                {label}
            </span>
        );
    };

    return (
        <div
            className={cn(
                "group relative bg-white dark:bg-zinc-800 rounded-xl border transition-all",
                "hover:shadow-md hover:border-gray-200 dark:hover:border-zinc-600",
                isCompleted
                    ? "border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10"
                    : "border-gray-100 dark:border-zinc-700/50",
                onClick && "cursor-pointer"
            )}
            onClick={onClick}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Status Button */}
                    <button
                        onClick={handleStatusClick}
                        disabled={isUpdating}
                        className={cn(
                            "flex-shrink-0 mt-0.5 transition-transform hover:scale-110",
                            isUpdating && "opacity-50 animate-pulse"
                        )}
                        aria-label="Toggle status"
                    >
                        {getStatusIcon()}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Title */}
                        <h4 className={cn(
                            "text-sm font-semibold text-gray-900 dark:text-zinc-100 line-clamp-2",
                            isCompleted && "line-through text-gray-500 dark:text-zinc-500"
                        )}>
                            {task.title}
                        </h4>

                        {/* Description preview */}
                        {task.description && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-1">
                                {task.description}
                            </p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {/* Ministry badge */}
                            {task.isMinistryTask && task.ministryName && (
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                    style={{
                                        backgroundColor: `${task.ministryColor || '#6B7280'}15`,
                                        color: task.ministryColor || '#6B7280'
                                    }}
                                >
                                    <Church className="w-2.5 h-2.5" />
                                    {task.ministryName}
                                </span>
                            )}

                            {/* Personal badge */}
                            {!task.isMinistryTask && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                                    <UserIcon className="w-2.5 h-2.5" />
                                    Personal
                                </span>
                            )}

                            {/* Priority badge */}
                            <span className={cn(
                                "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider",
                                priorityStyles[task.priority]
                            )}>
                                {task.priority}
                            </span>

                            {/* Due date */}
                            {getDueDateDisplay()}

                            {/* Attachment count */}
                            {task.attachmentCount && task.attachmentCount > 0 && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                                    <Paperclip className="w-3 h-3" />
                                    {task.attachmentCount}
                                </span>
                            )}

                            {/* Overdue indicator */}
                            {isOverdue && (
                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                        </div>

                        {/* Assigned by (for ministry tasks) */}
                        {task.isMinistryTask && task.assignedByName && (
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-2">
                                Assigned by {task.assignedByName}
                            </p>
                        )}
                    </div>

                    {/* More menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <MoreHorizontal className="w-4 h-4 text-gray-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                            {!isCompleted && (
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(
                                            task.id,
                                            task.isMinistryTask ? 'completed' : 'done',
                                            task.isMinistryTask
                                        );
                                    }}
                                    className="text-emerald-600"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Mark Done
                                </DropdownMenuItem>
                            )}
                            {isCompleted && (
                                <DropdownMenuItem
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(
                                            task.id,
                                            task.isMinistryTask ? 'backlog' : 'todo',
                                            task.isMinistryTask
                                        );
                                    }}
                                >
                                    <Circle className="w-4 h-4 mr-2" />
                                    Reopen
                                </DropdownMenuItem>
                            )}
                            {onArchive && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onArchive(task.id, task.isMinistryTask);
                                        }}
                                    >
                                        <Archive className="w-4 h-4 mr-2" />
                                        Archive
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this task?')) {
                                        onDelete(task.id, task.isMinistryTask);
                                    }
                                }}
                                className="text-red-600"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}

// Helper to convert MinistryAssignment to UnifiedTask
export function ministryAssignmentToUnifiedTask(
    assignment: MinistryAssignment,
    ministryName?: string,
    ministryColor?: string
): UnifiedTask {
    // Count all attachments (leader's + completion)
    const attachmentCount =
        (assignment.attachments?.length || 0) +
        (assignment.completionAttachments?.length || 0);

    return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        priority: assignment.priority,
        status: assignment.status,
        dueDate: assignment.dueDate,
        isMinistryTask: true,
        ministryName,
        ministryColor,
        assignedByName: assignment.assignedByName,
        createdAt: assignment.createdAt,
        attachmentCount: attachmentCount > 0 ? attachmentCount : undefined,
        originalTask: assignment
    };
}

// Helper to convert PersonalTask to UnifiedTask
export function personalTaskToUnifiedTask(task: PersonalTask): UnifiedTask {
    const attachmentCount = task.attachments?.length || 0;

    return {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        isMinistryTask: false,
        createdAt: task.createdAt,
        attachmentCount: attachmentCount > 0 ? attachmentCount : undefined,
        originalTask: task
    };
}
