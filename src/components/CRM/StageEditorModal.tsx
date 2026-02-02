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
            <DialogContent className="max-w-sm bg-zinc-900 border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-zinc-100 text-base">Edit Pipeline Stages</DialogTitle>
                    <DialogDescription className="text-zinc-500 text-xs">
                        Reorder, rename, or add stages to {board.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                    {/* Stage List */}
                    <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                        {stages.map((stage, index) => (
                            <div
                                key={stage.id}
                                className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-md border border-zinc-800 group hover:border-zinc-700 transition-colors"
                            >
                                {/* Reorder Controls */}
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        onClick={() => handleReorder(index, 'up')}
                                        disabled={index === 0}
                                        className="text-zinc-500 hover:text-zinc-300 disabled:opacity-20"
                                    >
                                        <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleReorder(index, 'down')}
                                        disabled={index === stages.length - 1}
                                        className="text-zinc-500 hover:text-zinc-300 disabled:opacity-20"
                                    >
                                        <ArrowDown className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Color Indicator/Picker */}
                                <div className="relative group/color">
                                    <div
                                        className="w-3 h-6 rounded-full cursor-pointer transition-transform hover:scale-110"
                                        style={{ backgroundColor: stage.color }}
                                    ></div>
                                    {/* Color Picker Dropdown */}
                                    <div className="absolute top-full left-0 mt-1 p-1.5 bg-zinc-800 shadow-xl rounded-lg border border-zinc-700 z-10 hidden group-hover/color:flex gap-1 w-28 flex-wrap">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c.value}
                                                className="w-4 h-4 rounded-full border border-zinc-600 hover:scale-110 transition-transform"
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
                                        className="w-full bg-transparent text-sm font-medium border-0 p-0 focus:ring-0 focus:outline-none text-zinc-200 placeholder:text-zinc-500"
                                    />
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={() => handleDeleteStage(stage.id)}
                                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add New Stage */}
                    <div className="flex gap-2 items-center pt-2 border-t border-zinc-800">
                        <input
                            type="text"
                            placeholder="New stage name..."
                            value={newStageName}
                            onChange={(e) => setNewStageName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                            className="flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                        />
                        <button
                            onClick={handleAddStage}
                            disabled={!newStageName.trim() || loading}
                            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <DialogFooter>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                    >
                        Done
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
