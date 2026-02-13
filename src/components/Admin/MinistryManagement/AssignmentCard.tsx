'use client';

import React, { useState } from 'react';
import { MinistryAssignment, MinistryPipelineStage } from '@/types';
import { MoreHorizontal, Eye, ArrowRight, Trash2, Calendar, AlertCircle, User, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';

interface AssignmentCardProps {
    assignment: MinistryAssignment;
    isSelected: boolean;
    isDragging: boolean;
    onSelect: () => void;
    onClick: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDelete: () => void;
    onMoveToStage: (stageId: string) => void;
    stageColor: string;
    stages: MinistryPipelineStage[];
}

export function AssignmentCard({
    assignment,
    isSelected,
    isDragging,
    onSelect,
    onClick,
    onDragStart,
    onDelete,
    onMoveToStage,
    stageColor,
    stages
}: AssignmentCardProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [showStageSubmenu, setShowStageSubmenu] = useState(false);

    // Priority styling
    const priorityColors = {
        low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        normal: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        high: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        urgent: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
    };

    // Due date helpers
    const dueDate = assignment.dueDate?.toDate ? assignment.dueDate.toDate() :
                    assignment.dueDate?.seconds ? new Date(assignment.dueDate.seconds * 1000) : null;
    const isOverdue = dueDate && isPast(dueDate) && assignment.status !== 'completed';
    const isDueToday = dueDate && isToday(dueDate);

    return (
        <div
            draggable
            onDragStart={onDragStart}
            className={cn(
                "group relative bg-white dark:bg-zinc-800 rounded-xl border transition-all cursor-grab active:cursor-grabbing shadow-sm",
                isSelected
                    ? 'border-orange-300 ring-1 ring-orange-500/20'
                    : 'border-gray-100 dark:border-zinc-700/50 hover:border-gray-200',
                isDragging ? 'opacity-40 scale-95' : (showMenu ? 'shadow-md border-orange-300' : 'hover:scale-[1.02] hover:shadow-md'),
                showMenu ? 'z-[60]' : 'z-auto'
            )}
        >
            {/* Color indicator bar */}
            <div
                className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full"
                style={{ backgroundColor: stageColor }}
            />

            <div className="p-3 pl-5">
                <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}
                        aria-label="Select assignment"
                        className={cn(
                            "flex-shrink-0 w-4 h-4 rounded border transition-all mt-1",
                            isSelected
                                ? 'bg-orange-500 border-orange-500 text-white'
                                : 'border-gray-300 dark:border-zinc-600 hover:border-orange-400'
                        )}
                    >
                        {isSelected && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>

                    {/* Content - clickable */}
                    <div className="flex-1 min-w-0" onClick={onClick}>
                        {/* Title */}
                        <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-1 line-clamp-2">
                            {assignment.title}
                        </h4>

                        {/* Description preview */}
                        {assignment.description && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2 line-clamp-2">
                                {assignment.description}
                            </p>
                        )}

                        {/* Badges row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Priority badge */}
                            <span className={cn(
                                "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider",
                                priorityColors[assignment.priority]
                            )}>
                                {assignment.priority}
                            </span>

                            {/* Overdue badge */}
                            {isOverdue && (
                                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    Overdue
                                </span>
                            )}

                            {/* Due Today badge */}
                            {isDueToday && !isOverdue && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-bold rounded uppercase tracking-wider">
                                    Due Today
                                </span>
                            )}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 dark:text-zinc-500">
                            {/* Assignee */}
                            {assignment.assignedToName && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {assignment.assignedToName}
                                </span>
                            )}

                            {/* Due date */}
                            {dueDate && (
                                <span className={cn(
                                    "flex items-center gap-1",
                                    isOverdue && "text-red-500"
                                )}>
                                    <Calendar className="w-3 h-3" />
                                    {format(dueDate, 'MMM d')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* More button */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowStageSubmenu(false); }}
                            aria-label="More options"
                            className="p-1 px-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {showMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-[65]"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        setShowStageSubmenu(false);
                                    }}
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-xl z-[70] py-1.5 overflow-hidden">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onClick(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors font-medium"
                                    >
                                        <Eye className="w-4 h-4 text-gray-400" />
                                        View Details
                                    </button>

                                    <div className="border-t border-gray-50 dark:border-zinc-700 my-1" />

                                    {/* Move Submenu */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowStageSubmenu(!showStageSubmenu); }}
                                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        <span className="flex items-center gap-2 font-medium">
                                            <ArrowRight className="w-4 h-4 text-gray-400" />
                                            Update Stage
                                        </span>
                                        <ArrowRight className={cn("w-3 h-3 text-gray-400 transition-transform", showStageSubmenu && "rotate-90")} />
                                    </button>

                                    {showStageSubmenu && (
                                        <div className="bg-gray-50/50 dark:bg-zinc-900/50 py-1">
                                            {stages.map((stage) => (
                                                <button
                                                    key={stage.id}
                                                    onClick={(e) => { e.stopPropagation(); onMoveToStage(stage.id); setShowMenu(false); setShowStageSubmenu(false); }}
                                                    className="w-full flex items-center gap-2 px-3 pl-9 py-1.5 text-xs text-gray-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 hover:text-gray-900 transition-colors"
                                                >
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                                    {stage.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="border-t border-gray-50 dark:border-zinc-700 my-1" />

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-medium"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Task
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
