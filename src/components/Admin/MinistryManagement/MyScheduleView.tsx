'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { VolunteerSchedulingService } from '@/lib/services/VolunteerSchedulingService';
import { VolunteerSchedule, MinistryService, Ministry } from '@/types';
import { toast } from 'sonner';
import { Loader2, CalendarCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AugmentedSchedule extends VolunteerSchedule {
    serviceDetails?: MinistryService;
    ministryDetails?: Ministry;
}

export function MyScheduleView() {
    const { userData } = useAuth();
    const [schedules, setSchedules] = useState<AugmentedSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (!userData?.uid) return;

        let unsubSchedules: (() => void) | undefined;

        const loadData = async () => {
            setLoading(true);
            try {
                // Subscribe to user's schedules
                unsubSchedules = VolunteerSchedulingService.subscribeToMySchedules(
                    userData.uid,
                    async (baseSchedules) => {
                        // Augment schedules with full Service and Ministry details
                        const augmented: AugmentedSchedule[] = [];

                        // Sort so mostly recent/future are at top (client side sort)
                        // This uses created date or could fetch service doc first.
                        // Let's fetch service docs in parallel

                        const serviceCache = new Map<string, MinistryService | null>();
                        const ministryCache = new Map<string, Ministry | null>();

                        for (const sch of baseSchedules) {
                            let serviceDetail = serviceCache.get(sch.serviceId);
                            let ministryDetail = ministryCache.get(sch.ministryId);

                            if (serviceDetail === undefined) {
                                const svcDoc = await getDoc(doc(db, 'ministryServices', sch.serviceId));
                                serviceDetail = svcDoc.exists() ? { id: svcDoc.id, ...svcDoc.data() } as MinistryService : null;
                                serviceCache.set(sch.serviceId, serviceDetail);
                            }

                            if (ministryDetail === undefined && sch.ministryId) {
                                const minDoc = await getDoc(doc(db, 'ministries', sch.ministryId));
                                ministryDetail = minDoc.exists() ? { id: minDoc.id, ...minDoc.data() } as Ministry : null;
                                ministryCache.set(sch.ministryId, ministryDetail);
                            }

                            augmented.push({
                                ...sch,
                                serviceDetails: serviceDetail || undefined,
                                ministryDetails: ministryDetail || undefined
                            });
                        }

                        // Sort by service date (closest first)
                        augmented.sort((a, b) => {
                            const dateA = a.serviceDetails?.date?.seconds || 0;
                            const dateB = b.serviceDetails?.date?.seconds || 0;
                            return dateA - dateB; // ascending
                        });

                        setSchedules(augmented);
                        setLoading(false);
                    }
                );
            } catch (error) {
                console.error("Error loading user schedules:", error);
                toast.error("Failed to load your schedule");
                setLoading(false);
            }
        };

        loadData();

        return () => {
            if (unsubSchedules) unsubSchedules();
        };
    }, [userData?.uid]);

    const handleUpdateStatus = async (scheduleId: string, status: 'accepted' | 'declined') => {
        setProcessingId(scheduleId);
        try {
            await VolunteerSchedulingService.updateScheduleStatus(scheduleId, status);
            toast.success(`Schedule ${status}`);
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (schedules.length === 0) {
        return (
            <div className="text-center py-12 border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50/50 dark:bg-zinc-950/50">
                <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-foreground">No Upcoming Shifts</h3>
                <p className="text-sm text-muted-foreground mt-1">You are not scheduled for any upcoming services.</p>
            </div>
        );
    }

    // Split into pending vs past/responded
    const pendingSchedules = schedules.filter(s => s.status === 'pending');
    const respondedSchedules = schedules.filter(s => s.status !== 'pending');

    const renderScheduleCard = (schedule: AugmentedSchedule) => {
        let serviceDateDisplay = 'Unknown Date';
        if (schedule.serviceDetails?.date) {
            const dVal = schedule.serviceDetails.date;
            let d: Date | null = null;
            if (dVal instanceof Date) d = dVal;
            else if (dVal?.toDate) d = dVal.toDate();
            else if (dVal?.seconds) d = new Date(dVal.seconds * 1000);
            else if (typeof dVal === 'string') d = parseISO(dVal);

            if (d) {
                serviceDateDisplay = format(d, 'EEEE, MMM do yyyy');
            }
        }

        const isDeclined = schedule.status === 'declined';
        const isAccepted = schedule.status === 'accepted';
        const isPending = schedule.status === 'pending';

        return (
            <div
                key={schedule.id}
                className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors gap-4",
                    isPending ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30" :
                        isAccepted ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/20" :
                            "bg-gray-50/50 dark:bg-zinc-950/50 border-gray-100 dark:border-zinc-800 opacity-75"
                )}
            >
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {isPending && <Clock className="w-4 h-4 text-amber-500" />}
                        {isAccepted && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {isDeclined && <XCircle className="w-4 h-4 text-red-500" />}
                        <h4 className="font-semibold text-foreground">
                            {schedule.serviceDetails?.name || 'Unknown Service'}
                        </h4>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center flex-wrap gap-x-3 gap-y-1">
                        <span>{serviceDateDisplay} {schedule.serviceDetails?.startTime && `• ${schedule.serviceDetails.startTime}`}</span>
                        {schedule.ministryDetails && (
                            <span className="flex items-center gap-1">
                                <span className="text-gray-300 dark:text-zinc-700">|</span>
                                {schedule.ministryDetails.name}
                            </span>
                        )}
                    </p>
                    <div className="inline-block px-2.5 py-0.5 mt-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-full text-xs font-medium text-foreground">
                        Role: {schedule.role}
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    {isPending ? (
                        <>
                            <Button
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:hover:bg-red-950/30 dark:text-red-400"
                                onClick={() => handleUpdateStatus(schedule.id, 'declined')}
                                disabled={processingId === schedule.id}
                            >
                                {processingId === schedule.id ? 'Processing...' : 'Decline'}
                            </Button>
                            <Button
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={() => handleUpdateStatus(schedule.id, 'accepted')}
                                disabled={processingId === schedule.id}
                            >
                                {processingId === schedule.id ? 'Processing...' : 'Accept'}
                            </Button>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800">
                            {isAccepted ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">Accepted</span>
                            ) : (
                                <span className="text-red-600 dark:text-red-400 font-medium text-sm">Declined</span>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-muted-foreground px-2"
                                onClick={() => handleUpdateStatus(schedule.id, isAccepted ? 'declined' : 'accepted')}
                                disabled={processingId === schedule.id}
                            >
                                Change
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {pendingSchedules.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                        </span>
                        Needs Your Response
                    </h3>
                    <div className="grid gap-3">
                        {pendingSchedules.map(renderScheduleCard)}
                    </div>
                </div>
            )}

            {respondedSchedules.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Upcoming & Past Responses</h3>
                    <div className="grid gap-3">
                        {respondedSchedules.map(renderScheduleCard)}
                    </div>
                </div>
            )}
        </div>
    );
}
