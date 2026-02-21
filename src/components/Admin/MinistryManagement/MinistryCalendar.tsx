'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react';
import { Ministry, MinistryAssignment, MinistryService } from '@/types';
import { MinistryAssignmentService } from '@/lib/services/MinistryAssignmentService';
import { VolunteerSchedulingService } from '@/lib/services/VolunteerSchedulingService';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

interface MinistryCalendarProps {
    ministry: Ministry;
    onCreateService?: (date?: Date) => void;
    onEditService?: (service: MinistryService) => void;
    onEditAssignment?: (assignment: MinistryAssignment) => void;
}

// Helper to reliably get Date from Firestore Timestamp or string
const getDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
    if (typeof dateVal === 'string') return parseISO(dateVal);
    if (typeof dateVal === 'number') return new Date(dateVal);
    return null;
};

export function MinistryCalendar({
    ministry,
    onCreateService,
    onEditService,
    onEditAssignment
}: MinistryCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [assignments, setAssignments] = useState<MinistryAssignment[]>([]);
    const [services, setServices] = useState<MinistryService[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch data when ministry or month changes
    useEffect(() => {
        if (!ministry?.id) return;

        setLoading(true);

        // Subscribe to assignments
        const unsubAssignments = MinistryAssignmentService.subscribeToMinistryAssignments(
            ministry.id,
            (fetchedAssignments) => {
                setAssignments(fetchedAssignments);
                setLoading(false); // Can be false once either returns, optimistic
            }
        );

        // Subscribe to services
        const unsubServices = VolunteerSchedulingService.subscribeToMinistryServices(
            ministry.id,
            (fetchedServices) => {
                setServices(fetchedServices);
                setLoading(false);
            }
        );

        return () => {
            unsubAssignments();
            unsubServices();
        };
    }, [ministry?.id, currentDate]); // re-fetch isn't strictly needed for current date if we fetch all, but good for future scoping

    // Navigation
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const today = () => setCurrentDate(new Date());

    // Generate Calendar Grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
        days.push(day);
        day = addDays(day, 1);
    }

    // Map events for easy lookup by date string (YYYY-MM-DD)
    const eventsByDate = useMemo(() => {
        const map: Record<string, { type: 'task' | 'service', data: any }[]> = {};

        assignments.forEach(task => {
            const date = getDate(task.dueDate);
            if (!date) return;
            const key = format(date, 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push({ type: 'task', data: task });
        });

        services.forEach(service => {
            const date = getDate(service.date);
            if (!date) return;
            const key = format(date, 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push({ type: 'service', data: service });
        });

        return map;
    }, [assignments, services]);

    if (loading && assignments.length === 0 && services.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            {/* Calendar Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50">
                {/* Left: Title and Navigation */}
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                        <CalendarIcon className="w-5 h-5 text-emerald-500" />
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm">
                        <button
                            onClick={prevMonth}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-l-lg transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        </button>
                        <button
                            onClick={today}
                            className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border-x border-zinc-200 dark:border-zinc-700"
                        >
                            Today
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-r-lg transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Right: Legend and Add Service */}
                <div className="flex items-center gap-6">
                    {/* Legend */}
                    <div className="flex items-center gap-5 text-sm text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <span>Tasks</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>Services</span>
                        </div>
                    </div>

                    {/* Add Service Button */}
                    <button
                        onClick={() => onCreateService?.()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-md shadow-emerald-500/20 active:translate-y-0.5 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Add Service
                    </button>
                </div>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
                    <div key={dayName} className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {dayName}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr h-[600px]">
                {days.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDate[dateKey] || [];
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentDate);

                    return (
                        <div
                            key={idx}
                            onClick={() => onCreateService?.(day)}
                            className={cn(
                                "min-h-[100px] border-b border-r border-gray-100 dark:border-zinc-800/60 p-1.5 transition-colors group relative",
                                !isCurrentMonth && "bg-gray-50/50 dark:bg-zinc-950/50 text-muted-foreground",
                                isToday && "bg-blue-50/30 dark:bg-blue-900/10",
                                "hover:bg-gray-50 dark:hover:bg-zinc-800/80 cursor-pointer"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                    isToday ? "bg-blue-600 text-white shadow-sm" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/60"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {/* Add button - always visible for touch, brighter on hover */}
                                <div className="opacity-30 group-hover:opacity-100 transition-opacity">
                                    <Plus className="w-4 h-4 text-emerald-500" />
                                </div>
                            </div>

                            <div className="space-y-1.5 overflow-y-auto max-h-[85px] no-scrollbar pr-1">
                                {dayEvents.map((event, eventIdx) => {
                                    if (event.type === 'service') {
                                        const srv = event.data as MinistryService;
                                        return (
                                            <div
                                                key={`srv-${srv.id}-${eventIdx}`}
                                                onClick={(e) => { e.stopPropagation(); onEditService?.(srv); }}
                                                className="px-2 py-1 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 truncate hover:opacity-80 transition-opacity cursor-pointer shadow-sm"
                                                title={srv.name}
                                            >
                                                {srv.startTime && <span className="opacity-75 mr-1">{srv.startTime}</span>}
                                                {srv.name}
                                            </div>
                                        );
                                    } else {
                                        const task = event.data as MinistryAssignment;
                                        return (
                                            <div
                                                key={`tsk-${task.id}-${eventIdx}`}
                                                onClick={(e) => { e.stopPropagation(); onEditAssignment?.(task); }}
                                                className={cn(
                                                    "px-2 py-1 text-xs font-medium rounded-md truncate hover:opacity-80 transition-opacity cursor-pointer shadow-sm border",
                                                    task.status === 'completed'
                                                        ? "bg-gray-100 text-gray-500 border-transparent dark:bg-zinc-800 dark:text-zinc-400"
                                                        : "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50"
                                                )}
                                                title={task.title}
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full bg-current inline-block mr-1.5 opacity-70" />
                                                {task.title}
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
