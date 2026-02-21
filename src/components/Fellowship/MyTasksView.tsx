'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMinistry } from '@/context/MinistryContext';
import { MinistryAssignment, PersonalTask, Ministry, VolunteerSchedule, MinistryService } from '@/types';
import { MinistryAssignmentService } from '@/lib/services/MinistryAssignmentService';
import { PersonalTaskService } from '@/lib/services/PersonalTaskService';
import { VolunteerSchedulingService } from '@/lib/services/VolunteerSchedulingService';
import {
    TaskCard,
    UnifiedTask,
    ministryAssignmentToUnifiedTask,
    personalTaskToUnifiedTask
} from './TaskCard';
import { CreatePersonalTaskModal } from './CreatePersonalTaskModal';
import { cn } from '@/lib/utils';
import { Plus, Loader2, ClipboardList, Church, User, Clock, CheckCircle, Filter, Inbox, Calendar, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isPast, isToday, addDays, format } from 'date-fns';
import { toast } from 'sonner';

type FilterType = 'all' | 'ministry' | 'personal' | 'due_soon' | 'completed';

interface MyTasksViewProps {
    userId?: string;
}

export function MyTasksView({ userId }: MyTasksViewProps) {
    const { user, userData } = useAuth();
    const { ministries } = useMinistry();
    const effectiveUserId = userId || user?.uid;

    // State
    const [ministryAssignments, setMinistryAssignments] = useState<MinistryAssignment[]>([]);
    const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
    const [volunteerSchedules, setVolunteerSchedules] = useState<(VolunteerSchedule & { serviceDetails?: MinistryService; ministryDetails?: Ministry })[]>([]);
    const [loading, setLoading] = useState(true);
    const [schedulesLoading, setSchedulesLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<PersonalTask | null>(null);
    const [processingScheduleId, setProcessingScheduleId] = useState<string | null>(null);

    // Create ministry lookup map
    const ministryMap = useMemo(() => {
        const map: Record<string, Ministry> = {};
        ministries.forEach(m => { map[m.id] = m; });
        return map;
    }, [ministries]);

    // Subscribe to tasks
    useEffect(() => {
        if (!effectiveUserId) {
            setLoading(false);
            return;
        }

        let unsubAssignments: (() => void) | undefined;
        let unsubPersonal: (() => void) | undefined;

        // Subscribe to ministry assignments for this user
        unsubAssignments = MinistryAssignmentService.subscribeToMyAssignments(
            effectiveUserId,
            (assignments) => {
                setMinistryAssignments(assignments);
            }
        );

        // Subscribe to personal tasks
        unsubPersonal = PersonalTaskService.subscribeToUserTasks(
            effectiveUserId,
            (tasks) => {
                setPersonalTasks(tasks);
                setLoading(false);
            }
        );

        return () => {
            if (unsubAssignments) unsubAssignments();
            if (unsubPersonal) unsubPersonal();
        };
    }, [effectiveUserId]);

    // Subscribe to volunteer schedules
    useEffect(() => {
        if (!effectiveUserId) {
            setSchedulesLoading(false);
            return;
        }

        setSchedulesLoading(true);
        const unsubSchedules = VolunteerSchedulingService.subscribeToMySchedules(
            effectiveUserId,
            async (schedules) => {
                // Augment with service and ministry details
                const augmented = await Promise.all(
                    schedules.map(async (schedule) => {
                        const serviceDetails = await VolunteerSchedulingService.getService(schedule.serviceId);
                        const ministryDetails = ministryMap[schedule.ministryId];
                        return {
                            ...schedule,
                            serviceDetails: serviceDetails || undefined,
                            ministryDetails
                        };
                    })
                );
                // Sort by service date (closest first)
                augmented.sort((a, b) => {
                    const aDate = a.serviceDetails?.date?.toDate?.() || a.serviceDetails?.date?.seconds ? new Date(a.serviceDetails.date.seconds * 1000) : new Date(0);
                    const bDate = b.serviceDetails?.date?.toDate?.() || b.serviceDetails?.date?.seconds ? new Date(b.serviceDetails.date.seconds * 1000) : new Date(0);
                    return aDate.getTime() - bDate.getTime();
                });
                setVolunteerSchedules(augmented);
                setSchedulesLoading(false);
            }
        );

        return () => unsubSchedules();
    }, [effectiveUserId, ministryMap]);

    // Convert to unified tasks
    const unifiedTasks: UnifiedTask[] = useMemo(() => {
        const tasks: UnifiedTask[] = [];

        // Add ministry assignments
        ministryAssignments.forEach(assignment => {
            const ministry = ministryMap[assignment.ministryId];
            tasks.push(ministryAssignmentToUnifiedTask(
                assignment,
                ministry?.name,
                ministry?.color
            ));
        });

        // Add personal tasks
        personalTasks.forEach(task => {
            tasks.push(personalTaskToUnifiedTask(task));
        });

        // Sort by due date (overdue first), then by creation date
        return tasks.sort((a, b) => {
            const aDue = a.dueDate?.toDate?.() || a.dueDate?.seconds ? new Date(a.dueDate.seconds * 1000) : null;
            const bDue = b.dueDate?.toDate?.() || b.dueDate?.seconds ? new Date(b.dueDate.seconds * 1000) : null;

            // Completed tasks go to the bottom
            const aCompleted = a.status === 'done' || a.status === 'completed';
            const bCompleted = b.status === 'done' || b.status === 'completed';
            if (aCompleted && !bCompleted) return 1;
            if (!aCompleted && bCompleted) return -1;

            // Overdue tasks go to the top
            const aOverdue = aDue && isPast(aDue) && !isToday(aDue);
            const bOverdue = bDue && isPast(bDue) && !isToday(bDue);
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            // Due today next
            const aDueToday = aDue && isToday(aDue);
            const bDueToday = bDue && isToday(bDue);
            if (aDueToday && !bDueToday) return -1;
            if (!aDueToday && bDueToday) return 1;

            // Then by due date
            if (aDue && bDue) return aDue.getTime() - bDue.getTime();
            if (aDue && !bDue) return -1;
            if (!aDue && bDue) return 1;

            // Finally by creation date
            const aCreated = a.createdAt?.toDate?.() || a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(0);
            const bCreated = b.createdAt?.toDate?.() || b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(0);
            return bCreated.getTime() - aCreated.getTime();
        });
    }, [ministryAssignments, personalTasks, ministryMap]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        const now = new Date();
        const weekFromNow = addDays(now, 7);

        switch (activeFilter) {
            case 'ministry':
                return unifiedTasks.filter(t => t.isMinistryTask);
            case 'personal':
                return unifiedTasks.filter(t => !t.isMinistryTask);
            case 'due_soon':
                return unifiedTasks.filter(t => {
                    if (t.status === 'done' || t.status === 'completed') return false;
                    if (!t.dueDate) return false;
                    const due = t.dueDate?.toDate?.() || (t.dueDate?.seconds ? new Date(t.dueDate.seconds * 1000) : null);
                    return due && due <= weekFromNow;
                });
            case 'completed':
                return unifiedTasks.filter(t => t.status === 'done' || t.status === 'completed');
            default:
                return unifiedTasks;
        }
    }, [unifiedTasks, activeFilter]);

    // Counts for filters
    const counts = useMemo(() => ({
        all: unifiedTasks.length,
        ministry: unifiedTasks.filter(t => t.isMinistryTask).length,
        personal: unifiedTasks.filter(t => !t.isMinistryTask).length,
        due_soon: unifiedTasks.filter(t => {
            if (t.status === 'done' || t.status === 'completed') return false;
            if (!t.dueDate) return false;
            const due = t.dueDate?.toDate?.() || (t.dueDate?.seconds ? new Date(t.dueDate.seconds * 1000) : null);
            return due && due <= addDays(new Date(), 7);
        }).length,
        completed: unifiedTasks.filter(t => t.status === 'done' || t.status === 'completed').length
    }), [unifiedTasks]);

    // Handlers
    const handleStatusChange = async (taskId: string, newStatus: string, isMinistry: boolean) => {
        try {
            if (isMinistry) {
                await MinistryAssignmentService.updateAssignment(taskId, {
                    status: newStatus as any
                });
            } else {
                await PersonalTaskService.updateTaskStatus(taskId, newStatus as any);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    const handleDelete = async (taskId: string, isMinistry: boolean) => {
        try {
            if (isMinistry) {
                await MinistryAssignmentService.deleteAssignment(taskId);
            } else {
                await PersonalTaskService.deleteTask(taskId);
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handleArchive = async (taskId: string, isMinistry: boolean) => {
        try {
            if (isMinistry) {
                await MinistryAssignmentService.updateAssignment(taskId, { isArchived: true });
            } else {
                await PersonalTaskService.archiveTask(taskId);
            }
        } catch (error) {
            console.error('Error archiving task:', error);
        }
    };

    const handleTaskClick = (task: UnifiedTask) => {
        if (!task.isMinistryTask) {
            setEditingTask(task.originalTask as PersonalTask);
            setIsCreateModalOpen(true);
        }
        // For ministry tasks, could open a detail modal in the future
    };

    // Handle volunteer schedule response
    const handleScheduleResponse = async (scheduleId: string, response: 'accepted' | 'declined') => {
        setProcessingScheduleId(scheduleId);
        try {
            await VolunteerSchedulingService.updateScheduleStatus(scheduleId, response);
            toast.success(response === 'accepted' ? 'Shift accepted!' : 'Shift declined');
        } catch (error) {
            console.error('Error updating schedule:', error);
            toast.error('Failed to update shift');
        } finally {
            setProcessingScheduleId(null);
        }
    };

    // Filter schedules to show pending and upcoming accepted
    const pendingSchedules = volunteerSchedules.filter(s => s.status === 'pending');
    const upcomingSchedules = volunteerSchedules.filter(s => {
        if (s.status !== 'accepted') return false;
        const serviceDate = s.serviceDetails?.date?.toDate?.() || (s.serviceDetails?.date?.seconds ? new Date(s.serviceDetails.date.seconds * 1000) : null);
        return serviceDate && serviceDate >= new Date();
    });

    const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
        { key: 'all', label: 'All', icon: <Inbox className="w-3.5 h-3.5" /> },
        { key: 'ministry', label: 'Ministry', icon: <Church className="w-3.5 h-3.5" /> },
        { key: 'personal', label: 'Personal', icon: <User className="w-3.5 h-3.5" /> },
        { key: 'due_soon', label: 'Due Soon', icon: <Clock className="w-3.5 h-3.5" /> },
        { key: 'completed', label: 'Done', icon: <CheckCircle className="w-3.5 h-3.5" /> }
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                    <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse" />
                    <Loader2 className="w-10 h-10 animate-spin text-violet-600 relative z-10" />
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-4 animate-pulse">
                    Loading your tasks...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Upcoming Shifts Section */}
            {(pendingSchedules.length > 0 || upcomingSchedules.length > 0) && (
                <div className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-700/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-700/50 bg-amber-50/50 dark:bg-amber-900/10">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                                Upcoming Shifts
                            </h3>
                            {pendingSchedules.length > 0 && (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                                    {pendingSchedules.length} pending
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-zinc-700/50">
                        {/* Pending Shifts First */}
                        {pendingSchedules.map(schedule => {
                            const serviceDate = schedule.serviceDetails?.date?.toDate?.() || (schedule.serviceDetails?.date?.seconds ? new Date(schedule.serviceDetails.date.seconds * 1000) : null);
                            return (
                                <div key={schedule.id} className="p-4 bg-amber-50/30 dark:bg-amber-900/5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                </span>
                                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">
                                                    Response Needed
                                                </span>
                                            </div>
                                            <h4 className="font-semibold text-foreground truncate">
                                                {schedule.serviceDetails?.name || 'Service'}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {serviceDate ? format(serviceDate, 'EEE, MMM d, yyyy') : 'Date TBD'}
                                                {schedule.serviceDetails?.startTime && ` · ${schedule.serviceDetails.startTime}`}
                                                {schedule.serviceDetails?.endTime && ` - ${schedule.serviceDetails.endTime}`}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300">
                                                    {schedule.role}
                                                </span>
                                                {schedule.ministryDetails && (
                                                    <span
                                                        className="text-xs px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: `${schedule.ministryDetails.color}20`,
                                                            color: schedule.ministryDetails.color
                                                        }}
                                                    >
                                                        {schedule.ministryDetails.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                                                onClick={() => handleScheduleResponse(schedule.id, 'declined')}
                                                disabled={processingScheduleId === schedule.id}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => handleScheduleResponse(schedule.id, 'accepted')}
                                                disabled={processingScheduleId === schedule.id}
                                            >
                                                {processingScheduleId === schedule.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Check className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Accepted Upcoming Shifts */}
                        {upcomingSchedules.map(schedule => {
                            const serviceDate = schedule.serviceDetails?.date?.toDate?.() || (schedule.serviceDetails?.date?.seconds ? new Date(schedule.serviceDetails.date.seconds * 1000) : null);
                            return (
                                <div key={schedule.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-foreground truncate">
                                                {schedule.serviceDetails?.name || 'Service'}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                {serviceDate ? format(serviceDate, 'EEE, MMM d, yyyy') : 'Date TBD'}
                                                {schedule.serviceDetails?.startTime && ` · ${schedule.serviceDetails.startTime}`}
                                                {schedule.serviceDetails?.endTime && ` - ${schedule.serviceDetails.endTime}`}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300">
                                                    {schedule.role}
                                                </span>
                                                {schedule.ministryDetails && (
                                                    <span
                                                        className="text-xs px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: `${schedule.ministryDetails.color}20`,
                                                            color: schedule.ministryDetails.color
                                                        }}
                                                    >
                                                        {schedule.ministryDetails.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="text-xs font-medium">Accepted</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                        <ClipboardList className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">My Tasks</h2>
                        <p className="text-xs text-muted-foreground">
                            {counts.all - counts.completed} active, {counts.completed} completed
                        </p>
                    </div>
                </div>

                <Button
                    onClick={() => {
                        setEditingTask(null);
                        setIsCreateModalOpen(true);
                    }}
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white shadow-md rounded-xl"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    New Task
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {filters.map(filter => (
                    <button
                        key={filter.key}
                        onClick={() => setActiveFilter(filter.key)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                            activeFilter === filter.key
                                ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 shadow-sm"
                                : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700 border border-gray-100 dark:border-zinc-700"
                        )}
                    >
                        {filter.icon}
                        {filter.label}
                        <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                            activeFilter === filter.key
                                ? "bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300"
                                : "bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400"
                        )}>
                            {counts[filter.key]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-700/50">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                        <ClipboardList className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">
                        {activeFilter === 'all' ? 'No tasks yet' : `No ${filters.find(f => f.key === activeFilter)?.label.toLowerCase()} tasks`}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                        {activeFilter === 'all'
                            ? 'Create a personal task or wait for ministry assignments.'
                            : 'Try a different filter or create a new task.'}
                    </p>
                    {activeFilter === 'all' && (
                        <Button
                            onClick={() => {
                                setEditingTask(null);
                                setIsCreateModalOpen(true);
                            }}
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Create Personal Task
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map(task => (
                        <TaskCard
                            key={`${task.isMinistryTask ? 'ministry' : 'personal'}-${task.id}`}
                            task={task}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onArchive={handleArchive}
                            onClick={() => handleTaskClick(task)}
                        />
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <CreatePersonalTaskModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingTask(null);
                }}
                task={editingTask}
            />
        </div>
    );
}
