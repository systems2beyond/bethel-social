'use client';

import React, { useState } from 'react';
import { PipelineBoard, PipelineStage } from '@/types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import {
    Plus,
    Trash2,
    GripVertical,
    X,
    Check,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import {
    addStageToBoard,
    updateStage,
    deleteStage,
    reorderStages
} from '@/lib/pipeline-boards';

interface StageEditorModalProps {
    board: PipelineBoard | null;
    open: boolean;
    onClose: () => void;
}

const PRESET_COLORS = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Green', value: '#10B981' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Indigo', value: '#6366F1' },
];

export default function StageEditorModal({ board, open, onClose }: StageEditorModalProps) {
    const [loading, setLoading] = useState(false);
    const [editingStageId, setEditingStageId] = useState<string | null>(null);
    const [newStageName, setNewStageName] = useState('');

    if (!board) return null;

    const stages = [...(board.stages || [])].sort((a, b) => a.order - b.order);

    const handleAddStage = async () => {
        if (!newStageName.trim()) return;
        setLoading(true);
        try {
            await addStageToBoard(board.id, newStageName, '#94A3B8'); // Default color gray
            setNewStageName('');
        } catch (error) {
            console.error('Failed to add stage:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStage = async (stageId: string, updates: Partial<PipelineStage>) => {
        try {
            await updateStage(board.id, stageId, updates);
        } catch (error) {
            console.error('Failed to update stage:', error);
        }
    };

    const handleDeleteStage = async (stageId: string) => {
        if (!confirm('Are you sure? Visitors in this stage will remain but be hidden from the pipeline view until moved.')) return;
        try {
            await deleteStage(board.id, stageId);
        } catch (error) {
            console.error('Failed to delete stage:', error);
        }
    };

    const handleReorder = async (currentIndex: number, direction: 'up' | 'down') => {
        const newStages = [...stages];
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= newStages.length) return;

        // Swap
        [newStages[currentIndex], newStages[targetIndex]] = [newStages[targetIndex], newStages[currentIndex]];

        // Optimistic UI update could be done here if we had local state for stages, 
        // but we rely on the board prop from parent subscription.

        try {
            await reorderStages(board.id, newStages.map(s => s.id));
        } catch (error) {
            console.error('Failed to reorder stages:', error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-white dark:bg-zinc-900">
                <DialogHeader>
                    <DialogTitle>Edit Stages: {board.name}</DialogTitle>
                    <DialogDescription>
                        Manage the stages for this pipeline. Reorder, rename, or add new steps.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Stage List */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {stages.map((stage, index) => (
                            <div
                                key={stage.id}
                                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-100 dark:border-zinc-800 group"
                            >
                                {/* Reorder Controls */}
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        onClick={() => handleReorder(index, 'up')}
                                        disabled={index === 0}
                                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                        <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleReorder(index, 'down')}
                                        disabled={index === stages.length - 1}
                                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                        <ArrowDown className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Color Indicator/Picker */}
                                <div className="relative group/color">
                                    <div
                                        className="w-4 h-8 rounded-full cursor-pointer transition-transform hover:scale-110"
                                        style={{ backgroundColor: stage.color }}
                                    ></div>
                                    {/* Color Tooltip/Picker - Simplified for now */}
                                    <div className="absolute top-full left-0 mt-1 p-1 bg-white shadow-lg rounded-lg border border-gray-100 z-10 hidden group-hover/color:flex gap-1 w-32 flex-wrap">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c.value}
                                                className="w-4 h-4 rounded-full border border-gray-200"
                                                style={{ backgroundColor: c.value }}
                                                onClick={() => handleUpdateStage(stage.id, { color: c.value })}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Name Editor */}
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        defaultValue={stage.name}
                                        onBlur={(e) => {
                                            if (e.target.value !== stage.name) {
                                                handleUpdateStage(stage.id, { name: e.target.value });
                                            }
                                        }}
                                        className="w-full bg-transparent text-sm font-medium border-0 p-0 focus:ring-0 text-gray-900 dark:text-gray-100"
                                    />
                                </div>

                                {/* Actions */}
                                <button
                                    onClick={() => handleDeleteStage(stage.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add New Stage */}
                    <div className="flex gap-2 items-center pt-2 border-t border-gray-100 dark:border-zinc-800">
                        <input
                            type="text"
                            placeholder="New stage name..."
                            value={newStageName}
                            onChange={(e) => setNewStageName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm"
                        />
                        <button
                            onClick={handleAddStage}
                            disabled={!newStageName.trim() || loading}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <DialogFooter>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Close
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
