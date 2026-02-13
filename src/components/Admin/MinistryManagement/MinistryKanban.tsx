'use client';

import React, { useEffect, useState } from 'react';
import { MinistryAssignment, MinistryPipelineBoard, MinistryPipelineStage, Ministry } from '@/types';
import { MinistryAssignmentService } from '@/lib/services/MinistryAssignmentService';
import { MinistryPipelineBoardService } from '@/lib/services/MinistryPipelineBoardService';
import { AssignmentCard } from './AssignmentCard';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Plus, Loader2, CheckSquare, X, ArrowRight, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import "mobile-drag-drop/default.css";

interface MinistryKanbanProps {
    ministry: Ministry;
    onCreateAssignment: () => void;
    onEditAssignment: (assignment: MinistryAssignment) => void;
    onEditStages?: () => void;
}

export function MinistryKanban({
    ministry,
    onCreateAssignment,
    onEditAssignment,
    onEditStages
}: MinistryKanbanProps) {
    const { user, userData } = useAuth();
    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState<MinistryAssignment[]>([]);
    const [board, setBoard] = useState<MinistryPipelineBoard | null>(null);
    const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
    const [draggedAssignment, setDraggedAssignment] = useState<string | null>(null);

    // Initialize Mobile Drag Drop Polyfill
    useEffect(() => {
        polyfill({
            dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
            holdToDrag: 300
        });
    }, []);

    // Initialize board and subscribe to assignments
    useEffect(() => {
        if (!ministry.id || !userData?.churchId) return;

        let unsubAssignments: (() => void) | undefined;
        let unsubBoards: (() => void) | undefined;

        const init = async () => {
            try {
                // Initialize default board if needed
                const boardId = await MinistryPipelineBoardService.initializeDefaultBoard(
                    ministry.id,
                    userData.churchId!,
                    ministry.name
                );

                // Subscribe to board updates
                unsubBoards = MinistryPipelineBoardService.subscribeToMinistryBoards(
                    ministry.id,
                    (boards) => {
                        const defaultBoard = boards.find(b => b.isDefault) || boards[0];
                        setBoard(defaultBoard || null);
                    }
                );

                // Subscribe to assignments
                unsubAssignments = MinistryAssignmentService.subscribeToMinistryAssignments(
                    ministry.id,
                    (data) => {
                        setAssignments(data);
                        setLoading(false);
                    }
                );
            } catch (error) {
                console.error('Error initializing kanban:', error);
                setLoading(false);
            }
        };

        init();

        return () => {
            if (unsubAssignments) unsubAssignments();
            if (unsubBoards) unsubBoards();
        };
    }, [ministry.id, userData?.churchId, ministry.name]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;
        try {
            await MinistryAssignmentService.deleteAssignment(id);
        } catch (error) {
            console.error("Error deleting assignment:", error);
            alert("Failed to delete task");
        }
    };

    const handleMoveToStage = async (assignmentId: string, stageId: string) => {
        try {
            // Find stage to get status mapping
            const stage = board?.stages.find(s => s.id === stageId);
            const statusMap: Record<string, string> = {
                'Backlog': 'backlog',
                'Assigned': 'assigned',
                'In Progress': 'in_progress',
                'Review': 'review',
                'Completed': 'completed'
            };
            const newStatus = statusMap[stage?.name || ''] || 'backlog';

            await MinistryAssignmentService.updateAssignment(assignmentId, {
                stageId,
                status: newStatus as any
            });
        } catch (error) {
            console.error("Error moving assignment:", error);
            alert("Failed to move task");
        }
    };

    const handleDragStart = (e: React.DragEvent, assignmentId: string) => {
        setDraggedAssignment(assignmentId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        if (!draggedAssignment) return;

        try {
            await handleMoveToStage(draggedAssignment, targetStageId);
        } catch (error) {
            console.error("Error updating assignment stage:", error);
            alert("Failed to update task stage");
        } finally {
            setDraggedAssignment(null);
        }
    };

    const toggleSelection = (assignmentId: string) => {
        const newSelection = new Set(selectedAssignments);
        if (newSelection.has(assignmentId)) {
            newSelection.delete(assignmentId);
        } else {
            newSelection.add(assignmentId);
        }
        setSelectedAssignments(newSelection);
    };

    const handleBulkDelete = async () => {
        if (selectedAssignments.size === 0) return;
        if (!confirm(`Delete ${selectedAssignments.size} task(s)?`)) return;

        try {
            for (const id of selectedAssignments) {
                await MinistryAssignmentService.deleteAssignment(id);
            }
            setSelectedAssignments(new Set());
        } catch (error) {
            console.error("Error deleting tasks:", error);
            alert("Failed to delete some tasks");
        }
    };

    const handleBulkStageUpdate = async (stageId: string) => {
        if (selectedAssignments.size === 0) return;
        if (!confirm(`Move ${selectedAssignments.size} task(s) to new stage?`)) return;

        try {
            for (const id of selectedAssignments) {
                await handleMoveToStage(id, stageId);
            }
            setSelectedAssignments(new Set());
        } catch (error) {
            console.error("Error updating stages:", error);
            alert("Failed to update tasks");
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full animate-pulse" />
                    <Loader2 className="w-10 h-10 animate-spin text-orange-600 relative z-10" />
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium animate-pulse">
                    Loading tasks...
                </p>
            </div>
        );
    }

    if (!board) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
                    <Settings className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">No Task Board Found</h3>
                <p className="text-sm text-muted-foreground mb-8">
                    Setting up your task board...
                </p>
            </div>
        );
    }

    const stages = board.stages || [];

    // Group assignments by stage
    const assignmentsByStage = stages.reduce((acc, stage) => {
        acc[stage.id] = assignments.filter(a => {
            // Match by stageId first
            if (a.stageId === stage.id) return true;
            // Fallback: match by status to stage name
            const statusToStage: Record<string, string> = {
                'backlog': 'Backlog',
                'assigned': 'Assigned',
                'in_progress': 'In Progress',
                'review': 'Review',
                'completed': 'Completed',
                'blocked': 'Backlog'
            };
            return statusToStage[a.status]?.toLowerCase() === stage.name.toLowerCase();
        });
        return acc;
    }, {} as Record<string, MinistryAssignment[]>);

    const allAssignmentIds = assignments.map(a => a.id);
    const allSelected = allAssignmentIds.length > 0 && allAssignmentIds.every(id => selectedAssignments.has(id));

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-900 dark:text-zinc-300">
                        {assignments.length}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                        Tasks
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (allSelected) {
                                setSelectedAssignments(new Set());
                            } else {
                                setSelectedAssignments(new Set(allAssignmentIds));
                            }
                        }}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all border shadow-sm",
                            allSelected
                                ? "bg-orange-50 text-orange-600 border-orange-100"
                                : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50"
                        )}
                    >
                        <CheckSquare className="w-4 h-4" />
                        <span className="hidden sm:inline">Select</span>
                    </button>

                    {onEditStages && (
                        <button
                            onClick={onEditStages}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
                        >
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Stages</span>
                        </button>
                    )}

                    <Button
                        size="sm"
                        onClick={onCreateAssignment}
                        className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-md border-0 px-3 py-1.5 h-auto font-bold text-xs rounded-lg"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        <span>New Task</span>
                    </Button>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedAssignments.size > 0 && (
                <div className="flex items-center justify-between px-6 py-3 bg-orange-600/95 backdrop-blur-md text-white shadow-2xl animate-in slide-in-from-top duration-300 flex-shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <CheckSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="block text-sm font-black leading-none">
                                    {selectedAssignments.size} Tasks Selected
                                </span>
                                <button
                                    onClick={() => setSelectedAssignments(new Set())}
                                    className="text-[10px] font-bold text-orange-100 hover:text-white underline underline-offset-2"
                                >
                                    Deselect all
                                </button>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-white/20" />

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl text-xs font-bold text-orange-100 hover:text-white transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => setSelectedAssignments(new Set())}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-scroll px-4 py-4 pipeline-scrollbar">
                <div className="flex gap-6 h-full min-w-max items-start">
                    {stages.map((stage) => {
                        const stageAssignments = assignmentsByStage[stage.id] || [];

                        return (
                            <div
                                key={stage.id}
                                className="flex flex-col bg-gray-100/40 dark:bg-zinc-900/40 rounded-2xl w-[320px] flex-shrink-0 border border-gray-100 dark:border-zinc-800 h-full max-h-full"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.id)}
                            >
                                {/* Column Header */}
                                <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-sm"
                                            style={{ backgroundColor: stage.color }}
                                        />
                                        <h3 className="text-[11px] font-black text-gray-400 dark:text-zinc-500 truncate uppercase tracking-[0.1em]">
                                            {stage.name}
                                        </h3>
                                    </div>
                                    <div className="flex items-center px-2 py-0.5 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-700">
                                        <span className="text-[10px] font-bold text-gray-600 dark:text-zinc-400">
                                            {stageAssignments.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Cards List */}
                                <div className="flex-1 px-3 py-1 space-y-3 overflow-y-auto scrollbar-hide">
                                    {stageAssignments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-2xl bg-gray-50/50 dark:bg-zinc-900/10">
                                            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm mb-3">
                                                <Plus className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
                                            </div>
                                            <p className="text-[9px] font-black text-gray-300 dark:text-zinc-600 uppercase tracking-[0.2em]">
                                                Drop Task Here
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 pb-4">
                                            {stageAssignments.map((assignment) => (
                                                <AssignmentCard
                                                    key={assignment.id}
                                                    assignment={assignment}
                                                    isSelected={selectedAssignments.has(assignment.id)}
                                                    isDragging={draggedAssignment === assignment.id}
                                                    onSelect={() => toggleSelection(assignment.id)}
                                                    onClick={() => onEditAssignment(assignment)}
                                                    onDragStart={(e) => handleDragStart(e, assignment.id)}
                                                    onDelete={() => handleDelete(assignment.id)}
                                                    onMoveToStage={(stageId) => handleMoveToStage(assignment.id, stageId)}
                                                    stageColor={stage.color}
                                                    stages={stages}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
