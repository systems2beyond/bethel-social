'use client';

import { useState, useEffect } from 'react';
import { Map, Plus, Target, ChevronRight, Loader2, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-6">
                <div className="text-center py-8">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Map className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        No Roadmap Yet
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Create a strategic roadmap to plan and track your ministry&apos;s goals.
                    </p>
                    <Button
                        onClick={onCreateRoadmap}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Create Roadmap
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div
                className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                onClick={() => onEditRoadmap?.(roadmap)}
            >
                <div className="flex items-center gap-2 mb-1">
                    <Map className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                        Ministry Roadmap
                    </span>
                </div>
                <h3 className="font-semibold text-foreground truncate" title={roadmap.title}>
                    {roadmap.title}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</span>
                    {inProgressCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                            {inProgressCount} in progress
                        </span>
                    )}
                    {completedCount > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                            {completedCount} done
                        </span>
                    )}
                </div>

                {/* Overall progress bar */}
                {milestones.length > 0 && (
                    <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Overall Progress</span>
                            <span className="font-medium text-foreground">{overallProgress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${overallProgress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Milestones List */}
            <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
                {milestones.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No milestones yet. Add your first milestone to start tracking progress.
                    </div>
                ) : (
                    milestones.map((milestone) => {
                        const prog = progress[milestone.id];
                        const targetDate = getDate(milestone.targetDate);

                        return (
                            <div
                                key={milestone.id}
                                className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                                onClick={() => onEditMilestone?.(milestone)}
                            >
                                <div className="flex items-start gap-2">
                                    {/* Status Icon */}
                                    <div className="mt-0.5">
                                        {milestone.status === 'completed' ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        ) : milestone.status === 'in_progress' ? (
                                            <Clock className="w-4 h-4 text-amber-500" />
                                        ) : (
                                            <Circle className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={cn(
                                                "font-medium text-sm truncate",
                                                milestone.status === 'completed'
                                                    ? "text-muted-foreground line-through"
                                                    : "text-foreground"
                                            )}>
                                                {milestone.title}
                                            </span>
                                            {prog && prog.totalTasks > 0 && (
                                                <span className="text-xs font-medium text-muted-foreground shrink-0">
                                                    {prog.percent}%
                                                </span>
                                            )}
                                        </div>

                                        {/* Target date */}
                                        {targetDate && (
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Target: {format(targetDate, 'MMM d, yyyy')}
                                            </div>
                                        )}

                                        {/* Progress bar */}
                                        {prog && prog.totalTasks > 0 && (
                                            <div className="mt-2">
                                                <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
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
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    {prog.completedTasks}/{prog.totalTasks} tasks
                                                </div>
                                            </div>
                                        )}

                                        {/* No tasks linked */}
                                        {prog && prog.totalTasks === 0 && (
                                            <div className="text-[10px] text-muted-foreground mt-1">
                                                No tasks linked
                                            </div>
                                        )}
                                    </div>

                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add Milestone Button */}
            <div className="p-3 border-t border-gray-100 dark:border-zinc-800">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={onCreateMilestone}
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Milestone
                </Button>
            </div>
        </div>
    );
}
