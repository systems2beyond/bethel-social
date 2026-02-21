'use client';

import { useState, useEffect } from 'react';
import { Map, Plus, Target, ChevronRight, Loader2, CheckCircle2, Circle, Clock, Pencil } from 'lucide-react';
import { Ministry, MinistryRoadmap, RoadmapMilestone, MilestoneProgress } from '@/types';
import { RoadmapService } from '@/lib/services/RoadmapService';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MinistryRoadmapViewProps {
    ministry: Ministry;
    onCreateRoadmap?: () => void;
    onCreateMilestone?: () => void;
    onEditMilestone?: (milestone: RoadmapMilestone) => void;
    onEditRoadmap?: (roadmap: MinistryRoadmap) => void;
}

// Helper to get Date from Firestore Timestamp
const getDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
    return null;
};

export function MinistryRoadmapView({
    ministry,
    onCreateRoadmap,
    onCreateMilestone,
    onEditMilestone,
    onEditRoadmap
}: MinistryRoadmapViewProps) {
    const [roadmap, setRoadmap] = useState<MinistryRoadmap | null>(null);
    const [milestones, setMilestones] = useState<RoadmapMilestone[]>([]);
    const [progress, setProgress] = useState<Record<string, MilestoneProgress>>({});
    const [loading, setLoading] = useState(true);

    // Subscribe to active roadmap
    useEffect(() => {
        if (!ministry?.id) return;

        setLoading(true);
        const unsubRoadmap = RoadmapService.subscribeToActiveRoadmap(
            ministry.id,
            (fetchedRoadmap) => {
                setRoadmap(fetchedRoadmap);
                setLoading(false);
            }
        );

        return () => unsubRoadmap();
    }, [ministry?.id]);

    // Subscribe to milestones when roadmap changes
    useEffect(() => {
        if (!roadmap?.id) {
            setMilestones([]);
            return;
        }

        const unsubMilestones = RoadmapService.subscribeToMilestones(
            roadmap.id,
            async (fetchedMilestones) => {
                setMilestones(fetchedMilestones);

                // Fetch progress for each milestone
                const progressMap: Record<string, MilestoneProgress> = {};
                await Promise.all(
                    fetchedMilestones.map(async (m) => {
                        const prog = await RoadmapService.getMilestoneProgress(m.id);
                        progressMap[m.id] = prog;
                    })
                );
                setProgress(progressMap);
            }
        );

        return () => unsubMilestones();
    }, [roadmap?.id]);

    // Calculate overall roadmap progress
    const overallProgress = milestones.length > 0
        ? Math.round(
            milestones.reduce((sum, m) => sum + (progress[m.id]?.percent || 0), 0) / milestones.length
        )
        : 0;

    const inProgressCount = milestones.filter(m => m.status === 'in_progress').length;
    const completedCount = milestones.filter(m => m.status === 'completed').length;

    if (loading) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-6">
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    // No roadmap yet - show create CTA
    if (!roadmap) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                            <Map className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">
                                Ministry Roadmap
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Create a strategic roadmap to plan and track your ministry&apos;s goals.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCreateRoadmap}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-500/20 active:translate-y-0.5 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Create Roadmap
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                            <Map className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground">{roadmap.title}</h3>
                                <button
                                    onClick={() => onEditRoadmap?.(roadmap)}
                                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                    title="Edit Roadmap"
                                >
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</span>
                                {inProgressCount > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                        <Clock className="w-3.5 h-3.5" />
                                        {inProgressCount} in progress
                                    </span>
                                )}
                                {completedCount > 0 && (
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {completedCount} completed
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Overall progress */}
                    {milestones.length > 0 && (
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {overallProgress}%
                                </div>
                                <div className="text-xs text-muted-foreground">Overall Progress</div>
                            </div>
                            <div className="w-24 h-24">
                                <svg viewBox="0 0 36 36" className="transform -rotate-90">
                                    <path
                                        className="text-gray-200 dark:text-zinc-700"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        fill="none"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                        className="text-indigo-500"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        fill="none"
                                        strokeDasharray={`${overallProgress}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Milestones Grid */}
            <div className="p-6">
                {milestones.length === 0 ? (
                    <div className="text-center py-8">
                        <Target className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground mb-4">No milestones yet. Add your first milestone to start tracking progress.</p>
                        <button
                            onClick={onCreateMilestone}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-500/20 active:translate-y-0.5 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add First Milestone
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {milestones.map((milestone) => {
                            const prog = progress[milestone.id];
                            const targetDate = getDate(milestone.targetDate);

                            return (
                                <div
                                    key={milestone.id}
                                    onClick={() => onEditMilestone?.(milestone)}
                                    className={cn(
                                        "p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md",
                                        milestone.status === 'completed'
                                            ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50"
                                            : milestone.status === 'in_progress'
                                            ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50"
                                            : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700"
                                    )}
                                >
                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={cn(
                                            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
                                            milestone.status === 'completed'
                                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                                : milestone.status === 'in_progress'
                                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                                : "bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400"
                                        )}>
                                            {milestone.status === 'completed' ? (
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            ) : milestone.status === 'in_progress' ? (
                                                <Clock className="w-3.5 h-3.5" />
                                            ) : (
                                                <Circle className="w-3.5 h-3.5" />
                                            )}
                                            {milestone.status === 'completed' ? 'Done' : milestone.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                                        </div>
                                        {prog && prog.totalTasks > 0 && (
                                            <span className="text-sm font-bold text-foreground">
                                                {prog.percent}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h4 className={cn(
                                        "font-semibold mb-2",
                                        milestone.status === 'completed'
                                            ? "text-muted-foreground line-through"
                                            : "text-foreground"
                                    )}>
                                        {milestone.title}
                                    </h4>

                                    {/* Description preview */}
                                    {milestone.description && (
                                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                            {milestone.description}
                                        </p>
                                    )}

                                    {/* Progress bar */}
                                    {prog && prog.totalTasks > 0 && (
                                        <div className="mb-3">
                                            <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-300",
                                                        milestone.status === 'completed'
                                                            ? "bg-emerald-500"
                                                            : "bg-indigo-500"
                                                    )}
                                                    style={{ width: `${prog.percent}%` }}
                                                />
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {prog.completedTasks}/{prog.totalTasks} tasks completed
                                            </div>
                                        </div>
                                    )}

                                    {/* No tasks linked */}
                                    {prog && prog.totalTasks === 0 && (
                                        <div className="text-xs text-muted-foreground mb-3">
                                            No tasks linked yet
                                        </div>
                                    )}

                                    {/* Target date */}
                                    {targetDate && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Target className="w-3 h-3" />
                                            Target: {format(targetDate, 'MMM d, yyyy')}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Add Milestone Card */}
                        <button
                            onClick={onCreateMilestone}
                            className="p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all flex flex-col items-center justify-center min-h-[160px] group"
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 flex items-center justify-center transition-colors mb-2">
                                <Plus className="w-5 h-5 text-gray-400 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                Add Milestone
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
