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
} from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { VolunteerSchedulingService } from '@/lib/services/VolunteerSchedulingService';
import { MinistryAssignmentService } from '@/lib/services/MinistryAssignmentService';
import { MinistryPipelineBoardService } from '@/lib/services/MinistryPipelineBoardService';
import { Ministry, MinistryService, MinistryAssignment, MinistryPipelineStage, FirestoreUser } from '@/types';
import { toast } from 'sonner';
import { Calendar, Clock, Loader2, Type, Users, Plus, CheckCircle2, Circle, User, Trash2, Flag } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Timestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface CreateServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry: Ministry;
    initialDate?: Date; // If they clicked a specific day on the calendar
    serviceToEdit?: MinistryService; // If editing an existing service
}

export function CreateServiceModal({
    isOpen,
    onClose,
    ministry,
    initialDate,
    serviceToEdit
}: CreateServiceModalProps) {
    const { user, userData } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentService, setCurrentService] = useState<MinistryService | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('11:00');
    const [description, setDescription] = useState('');

    // Volunteer Assignment State
    const [serviceTasks, setServiceTasks] = useState<MinistryAssignment[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [showAddTask, setShowAddTask] = useState(false);
    const [members, setMembers] = useState<FirestoreUser[]>([]);
    const [stages, setStages] = useState<MinistryPipelineStage[]>([]);

    // Quick task form state
    const [taskTitle, setTaskTitle] = useState('');
    const [taskAssigneeId, setTaskAssigneeId] = useState('');
    const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
    const [addingTask, setAddingTask] = useState(false);

    // Load ministry members and stages when modal opens
    useEffect(() => {
        if (isOpen && ministry.id) {
            loadMinistryData();
        }
    }, [isOpen, ministry.id]);

    // Load tasks for service when editing or after creation
    useEffect(() => {
        const serviceId = serviceToEdit?.id || currentService?.id;
        if (isOpen && serviceId) {
            loadServiceTasks(serviceId);
        }
    }, [isOpen, serviceToEdit?.id, currentService?.id]);

    useEffect(() => {
        if (isOpen) {
            if (serviceToEdit) {
                // Populate for edit
                setName(serviceToEdit.name);
                setCurrentService(serviceToEdit);

                // Safe date extraction (same logic as calendar)
                let d: Date | null = null;
                const dVal = serviceToEdit.date;
                if (dVal instanceof Date) d = dVal;
                else if (dVal?.toDate) d = dVal.toDate();
                else if (dVal?.seconds) d = new Date(dVal.seconds * 1000);
                else if (typeof dVal === 'string') d = parseISO(dVal);
                else if (typeof dVal === 'number') d = new Date(dVal);

                if (d) {
                    setDate(format(d, 'yyyy-MM-dd'));
                } else {
                    setDate('');
                }

                setStartTime(serviceToEdit.startTime || '09:00');
                setEndTime(serviceToEdit.endTime || '11:00');
                setDescription(serviceToEdit.description || '');
            } else {
                // Reset for new creation
                setName('');
                setDate(initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                setStartTime('09:00');
                setEndTime('11:00');
                setDescription('');
                setCurrentService(null);
                setServiceTasks([]);
                setShowAddTask(false);
                resetTaskForm();
            }
        }
    }, [isOpen, initialDate, serviceToEdit]);

    const loadMinistryData = async () => {
        try {
            // Load ministry members
            const membersQuery = query(
                collection(db, 'ministryMembers'),
                where('ministryId', '==', ministry.id),
                where('status', '==', 'active')
            );
            const membersSnapshot = await getDocs(membersQuery);
            const ministryMembers = membersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    uid: data.userId,
                    displayName: data.name || 'Unknown',
                    email: data.email || '',
                    photoURL: data.photoURL || null,
                    role: data.role || 'Member'
                } as FirestoreUser;
            });
            setMembers(ministryMembers);

            // Load pipeline stages
            const board = await MinistryPipelineBoardService.getDefaultBoard(ministry.id);
            if (board) {
                setStages(board.stages);
            }
        } catch (error) {
            console.error('Error loading ministry data:', error);
        }
    };

    const loadServiceTasks = async (serviceId: string) => {
        setLoadingTasks(true);
        try {
            const tasks = await MinistryAssignmentService.getAssignmentsByService(serviceId);
            setServiceTasks(tasks);
        } catch (error) {
            console.error('Error loading service tasks:', error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const resetTaskForm = () => {
        setTaskTitle('');
        setTaskAssigneeId('');
        setTaskPriority('normal');
        setShowAddTask(false);
    };

    const handleAddTask = async () => {
        if (!taskTitle.trim() || !currentService || !user || !userData?.churchId) return;

        setAddingTask(true);
        try {
            const assignee = members.find(m => m.uid === taskAssigneeId);

            const taskData: Omit<MinistryAssignment, 'id' | 'createdAt' | 'updatedAt'> = {
                churchId: userData.churchId,
                ministryId: ministry.id,
                title: taskTitle.trim(),
                priority: taskPriority,
                ...(taskAssigneeId && { assignedToId: taskAssigneeId }),
                ...(assignee?.displayName && { assignedToName: assignee.displayName }),
                assignedById: user.uid,
                assignedByName: userData.displayName || user.displayName || 'Admin',
                status: taskAssigneeId ? 'assigned' : 'backlog',
                stageId: stages[0]?.id || '',
                serviceSessionId: currentService.id,
                dueDate: currentService.date,
                attachments: [],
                isArchived: false
            };

            const taskId = await MinistryAssignmentService.createAssignment(taskData);

            // Notify assignee if assigned
            if (taskAssigneeId) {
                const savedTask = await MinistryAssignmentService.getAssignment(taskId);
                if (savedTask) {
                    await MinistryAssignmentService.notifyAssignee(
                        savedTask,
                        'assigned',
                        {
                            uid: user.uid,
                            displayName: userData.displayName || user.displayName || 'Admin',
                            photoURL: user.photoURL || undefined
                        }
                    );
                }
            }

            // Reload tasks
            await loadServiceTasks(currentService.id);
            resetTaskForm();
            toast.success('Volunteer task added');
        } catch (error) {
            console.error('Error adding task:', error);
            toast.error('Failed to add task');
        } finally {
            setAddingTask(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('Remove this volunteer assignment?')) return;

        try {
            await MinistryAssignmentService.deleteAssignment(taskId);
            setServiceTasks(prev => prev.filter(t => t.id !== taskId));
            toast.success('Task removed');
        } catch (error) {
            console.error('Error deleting task:', error);
            toast.error('Failed to remove task');
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Please enter a service name');
            return;
        }
        if (!date) {
            toast.error('Please select a date');
            return;
        }
        if (!user?.uid) {
            toast.error('You must be logged in to create a service');
            return;
        }

        setIsSubmitting(true);
        try {
            // Convert simple date string to Date object for backend storage
            // Add a middle-of-day time to avoid timezone shift issues before converting to Timestamp (which service does implicitly or explicitly)
            const serviceDate = parseISO(`${date}T12:00:00Z`); // using Z or local could shift, just stick to ISO

            if (serviceToEdit || currentService) {
                const serviceId = serviceToEdit?.id || currentService?.id;
                await VolunteerSchedulingService.updateService(serviceId!, {
                    name: name.trim(),
                    date: serviceDate,
                    startTime,
                    endTime,
                    description: description.trim()
                });
                toast.success('Service updated');
                onClose();
            } else {
                // Create new service and stay in modal to add volunteers
                const newServiceId = await VolunteerSchedulingService.createService({
                    ministryId: ministry.id,
                    name: name.trim(),
                    date: serviceDate,
                    startTime,
                    endTime,
                    description: description.trim(),
                    createdBy: user.uid
                });

                // Fetch the created service and switch to edit mode
                const newService = await VolunteerSchedulingService.getService(newServiceId);
                if (newService) {
                    setCurrentService(newService);
                    toast.success('Service created! You can now add volunteer tasks.');
                } else {
                    toast.success('Service created');
                    onClose();
                }
            }
        } catch (error) {
            console.error('Error saving service:', error);
            toast.error(serviceToEdit ? 'Failed to update service' : 'Failed to create service');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!serviceToEdit) return;

        if (!confirm(`Are you sure you want to delete "${serviceToEdit.name}" and all volunteer assignments for it?`)) {
            return;
        }

        setIsSubmitting(true);
        try {
            await VolunteerSchedulingService.deleteService(serviceToEdit.id);
            toast.success('Service deleted');
            onClose();
        } catch (error) {
            console.error('Error deleting service:', error);
            toast.error('Failed to delete service');
        } finally {
            setIsSubmitting(false);
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
            <DialogContent className={cn(
                "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800",
                (serviceToEdit || currentService) ? "sm:max-w-[700px]" : "sm:max-w-[500px]"
            )}>
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        {(serviceToEdit || currentService) ? 'Edit Service' : 'Create New Service'}
                    </DialogTitle>
                    <DialogDescription>
                        {(serviceToEdit || currentService)
                            ? 'Update service details and manage volunteer assignments.'
                            : 'Set up a new service event that requires volunteers.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-foreground">Service Name <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Type className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Sunday Morning Service"
                                className="pl-9 bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Date & Time Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-foreground">Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="pl-9 bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="startTime" className="text-foreground">Start</Label>
                                <div className="relative">
                                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        id="startTime"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="pl-8 text-sm bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endTime" className="text-foreground">End</Label>
                                <div className="relative">
                                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        id="endTime"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="pl-8 text-sm bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-foreground">Description/Notes</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Any specific details for this service..."
                            className="bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 min-h-[80px] resize-y focus-visible:ring-emerald-500"
                        />
                    </div>

                    {/* Volunteer Assignments Section - Show when editing or after creating */}
                    {(serviceToEdit || currentService) && (
                        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                            <div className="flex items-center justify-between">
                                <Label className="text-foreground flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-500" />
                                    Volunteer Assignments
                                </Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAddTask(!showAddTask)}
                                    className="h-8 text-xs"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Task
                                </Button>
                            </div>

                            {/* Quick Add Task Form */}
                            {showAddTask && (
                                <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <Input
                                                placeholder="Task title (e.g., Lead worship)"
                                                value={taskTitle}
                                                onChange={(e) => setTaskTitle(e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Select
                                                value={taskAssigneeId || '__unassigned__'}
                                                onValueChange={(v) => setTaskAssigneeId(v === '__unassigned__' ? '' : v)}
                                            >
                                                <SelectTrigger className="h-9 text-sm">
                                                    <SelectValue placeholder="Assign to...">
                                                        {taskAssigneeId ? (
                                                            <span className="flex items-center gap-2">
                                                                <User className="w-3 h-3" />
                                                                {members.find(m => m.uid === taskAssigneeId)?.displayName || 'Select member'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">Assign to...</span>
                                                        )}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__unassigned__">
                                                        <span className="text-muted-foreground">Unassigned</span>
                                                    </SelectItem>
                                                    {members.map(member => (
                                                        <SelectItem key={member.uid} value={member.uid}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                                                                    {member.displayName?.charAt(0) || '?'}
                                                                </div>
                                                                {member.displayName}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as any)}>
                                            <SelectTrigger className="h-8 w-28 text-xs">
                                                <Flag className="w-3 h-3 mr-1" />
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {priorityOptions.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        <span className={opt.color}>{opt.label}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={resetTaskForm}
                                                className="h-8 text-xs"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleAddTask}
                                                disabled={!taskTitle.trim() || addingTask}
                                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                                            >
                                                {addingTask ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Task List */}
                            {loadingTasks ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : serviceTasks.length === 0 ? (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                    No volunteer tasks assigned yet. Click &quot;Add Task&quot; to assign volunteers.
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {serviceTasks.map(task => (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "flex items-center justify-between p-2 rounded-lg border",
                                                task.status === 'completed'
                                                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50"
                                                    : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                {task.status === 'completed' ? (
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Circle className="w-4 h-4 text-gray-400" />
                                                )}
                                                <div>
                                                    <p className={cn(
                                                        "text-sm font-medium",
                                                        task.status === 'completed' && "line-through text-muted-foreground"
                                                    )}>
                                                        {task.title}
                                                    </p>
                                                    {task.assignedToName && (
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {task.assignedToName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteTask(task.id)}
                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                    {(serviceToEdit || currentService) ? (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="mr-auto"
                        >
                            Delete Service
                        </Button>
                    ) : <div></div>}

                    <div className="flex gap-2">
                        {(serviceToEdit || currentService) ? (
                            <>
                                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                                    Done
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSubmitting}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSubmitting}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4 mr-1" />
                                            Create & Add Volunteers
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
