'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { VolunteerSchedulingService } from '@/lib/services/VolunteerSchedulingService';
import { Ministry, MinistryService, VolunteerSchedule } from '@/types';
import { toast } from 'sonner';
import { Loader2, Search, UserPlus, X, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface ScheduleVolunteerModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry: Ministry;
    service: MinistryService | null;
}

export function ScheduleVolunteerModal({
    isOpen,
    onClose,
    ministry,
    service
}: ScheduleVolunteerModalProps) {
    const { userData } = useAuth();

    // Data State
    const [members, setMembers] = useState<any[]>([]);
    const [schedules, setSchedules] = useState<VolunteerSchedule[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [isScheduling, setIsScheduling] = useState<string | null>(null);

    // Load Members and Schedules
    useEffect(() => {
        let unsubSchedules: (() => void) | undefined;

        const loadData = async () => {
            if (!isOpen || !service || !ministry) return;
            setLoading(true);

            try {
                // 1. Fetch Ministry Members
                const membersQuery = query(
                    collection(db, 'ministryMembers'),
                    where('ministryId', '==', ministry.id),
                    where('status', '==', 'active')
                );
                const membersSnap = await getDocs(membersQuery);
                const fetchedMembers = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMembers(fetchedMembers);

                // 2. Subscribe to current schedules for this service
                unsubSchedules = VolunteerSchedulingService.subscribeToServiceSchedules(
                    service.id,
                    (fetchedSchedules) => {
                        setSchedules(fetchedSchedules);
                        setLoading(false);
                    }
                );
            } catch (error) {
                console.error("Error loading scheduling data:", error);
                toast.error("Failed to load roster");
                setLoading(false);
            }
        };

        loadData();

        return () => {
            if (unsubSchedules) unsubSchedules();
        };
    }, [isOpen, service, ministry]);

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
            setSelectedRole('');
            setIsScheduling(null);
        }
    }, [isOpen]);

    if (!service) return null;

    const handleSchedule = async (member: any) => {
        const role = selectedRole.trim();
        if (!role) {
            toast.error("Please enter a role for this volunteer before scheduling");
            return;
        }

        setIsScheduling(member.userId);
        try {
            await VolunteerSchedulingService.createSchedule({
                serviceId: service.id,
                ministryId: ministry.id,
                userId: member.userId,
                role: role,
                status: 'pending',
                notes: '',
                createdBy: userData!.uid
            });
            toast.success(`${member.name} scheduled as ${role}`);
            setSearchTerm(''); // Clear search to easily find next
            // Don't clear selectedRole, often scheduling multiple people for same role
        } catch (error) {
            console.error("Error scheduling volunteer:", error);
            toast.error("Failed to schedule volunteer");
        } finally {
            setIsScheduling(null);
        }
    };

    const handleRemoveSchedule = async (scheduleId: string) => {
        try {
            await VolunteerSchedulingService.deleteSchedule(scheduleId);
            toast.success("Schedule removed");
        } catch {
            toast.error("Failed to remove schedule");
        }
    };

    // Derived Data
    const scheduledUserIds = new Set(schedules.map(s => s.userId));

    const availableMembers = members.filter(m =>
        !scheduledUserIds.has(m.userId) &&
        (m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.role?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'accepted': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'declined': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return <Clock className="w-4 h-4 text-amber-500" />;
        }
    };

    // Format service date for display
    let serviceDateDisplay = '';
    if (service.date) {
        const dVal = service.date;
        let d: Date | null = null;
        if (dVal instanceof Date) d = dVal;
        else if (dVal?.toDate) d = dVal.toDate();
        else if (dVal?.seconds) d = new Date(dVal.seconds * 1000);
        else if (typeof dVal === 'string') d = parseISO(dVal);

        if (d) {
            serviceDateDisplay = format(d, 'EEEE, MMM do yyyy');
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    <DialogTitle className="text-xl">
                        Schedule Volunteers
                    </DialogTitle>
                    <DialogDescription>
                        {service.name} • {serviceDateDisplay} {service.startTime && `• ${service.startTime}`}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="flex-1 flex border-t border-gray-100 dark:border-zinc-800 min-h-0 overflow-hidden">

                        {/* ROSTER PANEL (LEFT) */}
                        <div className="w-[50%] flex flex-col border-r border-gray-100 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-950/30">
                            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 shrink-0 space-y-3">
                                <h3 className="font-semibold text-sm text-foreground">Available Team Members</h3>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search roster..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-8 h-8 bg-white dark:bg-zinc-900"
                                        />
                                    </div>
                                    <Input
                                        placeholder="Role to assign (e.g. Usher)"
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        className="h-8 bg-white dark:bg-zinc-900"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {availableMembers.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        No available team members found.
                                    </div>
                                ) : (
                                    availableMembers.map(member => (
                                        <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                    {member.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{member.role || 'Member'}</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-7 px-2 shrink-0 ml-2"
                                                onClick={() => handleSchedule(member)}
                                                disabled={isScheduling === member.userId || !selectedRole.trim()}
                                            >
                                                {isScheduling === member.userId ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                                                        Add
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* SCHEDULED PANEL (RIGHT) */}
                        <div className="w-[50%] flex flex-col bg-white dark:bg-zinc-900">
                            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 shrink-0 flex items-center justify-between">
                                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                    Currently Scheduled
                                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 py-0.5 px-2 rounded-full text-xs">
                                        {schedules.length}
                                    </span>
                                </h3>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {schedules.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                                        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">No volunteers scheduled yet.</p>
                                        <p className="text-xs text-muted-foreground mt-1">Select a role and add team members from the left.</p>
                                    </div>
                                ) : (
                                    // Group by role for better viewing
                                    Object.entries(
                                        schedules.reduce((acc, sch) => {
                                            if (!acc[sch.role]) acc[sch.role] = [];
                                            acc[sch.role].push(sch);
                                            return acc;
                                        }, {} as Record<string, VolunteerSchedule[]>)
                                    ).map(([role, roleSchedules]) => (
                                        <div key={role} className="mb-4 last:mb-0">
                                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">{role}</h4>
                                            <div className="space-y-1.5">
                                                {roleSchedules.map(schedule => {
                                                    // Find member name from the loaded members array
                                                    const member = members.find(m => m.userId === schedule.userId);
                                                    const memberName = member?.name || 'Unknown User';

                                                    return (
                                                        <div key={schedule.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50 group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-gray-500 font-medium text-xs">
                                                                    {memberName.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-foreground leading-none mb-1">{memberName}</p>
                                                                    <div className="flex items-center gap-1">
                                                                        {getStatusIcon(schedule.status)}
                                                                        <span className="text-xs text-muted-foreground capitalize">
                                                                            {schedule.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleRemoveSchedule(schedule.id)}
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
