'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Visitor, PipelineBoard, PipelineStage } from '@/types';
import {
    Loader2, UserPlus, MessageSquare, Users, Target, Trash2, Mail, Phone, Clock,
    CheckSquare, Square, Layout, Calendar, Briefcase, Plus
} from 'lucide-react';
import { updatePipelineStage, bulkUpdatePipelineStage } from '@/lib/crm';
import { subscribeToPipelineBoards, initializeDefaultBoard } from '@/lib/pipeline-boards';
import { useAuth } from '@/context/AuthContext';
import VisitorDetailModal from '@/components/CRM/VisitorDetailModal';
import BoardSelector from '@/components/CRM/BoardSelector';
import StageEditorModal from '@/components/CRM/StageEditorModal';

// Icon mapper for dynamic stages
const ICON_MAP: Record<string, any> = {
    'UserPlus': UserPlus,
    'MessageSquare': MessageSquare,
    'Users': Users,
    'Target': Target,
    'default': Layout
};

export default function VisitorPipeline() {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [boards, setBoards] = useState<PipelineBoard[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<PipelineBoard | null>(null);
    const [loading, setLoading] = useState(true);
    const [draggedVisitor, setDraggedVisitor] = useState<string | null>(null);
    const [selectedVisitors, setSelectedVisitors] = useState<Set<string>>(new Set());
    const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
    const [isStageEditorOpen, setIsStageEditorOpen] = useState(false);

    const { user } = useAuth();

    // Initialize Boards & Subscribe
    useEffect(() => {
        if (!user) return;

        // 1. Ensure default board exists
        initializeDefaultBoard(user.uid).then(() => {
            // 2. Subscribe to boards
            const unsubscribe = subscribeToPipelineBoards((data) => {
                setBoards(data);
                // Select first board if none selected using ID check to persist selection
                setSelectedBoard(prev => {
                    if (prev) {
                        const updated = data.find(b => b.id === prev.id);
                        return updated || prev;
                    }
                    return data[0] || null;
                });
            });
            return unsubscribe;
        });
    }, [user]);

    // Fetch Visitors
    useEffect(() => {
        const q = query(collection(db, 'visitors'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Visitor[];
            setVisitors(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this visitor record?")) return;
        try {
            await deleteDoc(doc(db, 'visitors', id));
        } catch (error) {
            console.error("Error deleting visitor:", error);
            alert("Failed to delete visitor");
        }
    };

    const handleDragStart = (e: React.DragEvent, visitorId: string) => {
        setDraggedVisitor(visitorId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetStage: string) => {
        e.preventDefault();
        if (!draggedVisitor) return;

        try {
            await updatePipelineStage(
                draggedVisitor,
                targetStage as any,
                user?.uid
            );
        } catch (error) {
            console.error("Error updating pipeline stage:", error);
            alert("Failed to update visitor stage");
        } finally {
            setDraggedVisitor(null);
        }
    };

    const toggleVisitorSelection = (visitorId: string) => {
        const newSelection = new Set(selectedVisitors);
        if (newSelection.has(visitorId)) {
            newSelection.delete(visitorId);
        } else {
            newSelection.add(visitorId);
        }
        setSelectedVisitors(newSelection);
    };

    const handleBulkStageUpdate = async (newStage: string) => {
        if (selectedVisitors.size === 0) return;
        if (!confirm(`Move ${selectedVisitors.size} visitor(s) to new stage?`)) return;

        try {
            await bulkUpdatePipelineStage(Array.from(selectedVisitors), newStage as any, user?.uid);
            setSelectedVisitors(new Set());
        } catch (error) {
            console.error("Error updating stages:", error);
            alert("Failed to update visitors");
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    if (!selectedBoard) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-500">Loading pipeline boards...</p>
            </div>
        );
    }

    // Filter visitors by board (Legacy support: show unassigned visitors on Sunday Service board)
    const boardVisitors = visitors.filter(v => {
        if (v.boardId === selectedBoard.id) return true;
        // Fallback: If no boardId and this is Sunday Service, show them
        if (!v.boardId && selectedBoard.type === 'sunday_service') return true;
        return false;
    });

    // Group visitors by pipeline stage
    // Use dynamic stages from selectedBoard
    const stages = selectedBoard.stages || [];
    const visitorsByStage = stages.reduce((acc, stage) => {
        acc[stage.name] = boardVisitors.filter(v => {
            // Map legacy fixed IDs to new dynamic names if needed, or rely on migration
            // For now, assuming direct match on stage name or ID if we stored IDs?
            // Wait, previous implementation stored IDs like 'new_guest'.
            // New implementation uses generated IDs. 
            // FIXME: Migration is needed.
            // Temporary mapping for display:
            const visitorStage = v.pipelineStage || 'New Guest';

            // Try to match by ID first, then name
            if (visitorStage === stage.id) return true;

            // Legacy mapping
            const legacyMap: Record<string, string> = {
                'new_guest': 'New Guest',
                'contacted': 'Contacted',
                'second_visit': 'Second Visit',
                'ready_for_membership': 'Ready for Member'
            };
            return (legacyMap[visitorStage] || visitorStage) === stage.name;
        });
        return acc;
    }, {} as Record<string, Visitor[]>);

    return (
        <div className="space-y-8">
            {/* Header / Board Selector */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <BoardSelector
                        boards={boards}
                        selectedBoard={selectedBoard}
                        onSelectBoard={setSelectedBoard}
                        onCreateBoard={() => {/* TODO */ }}
                    />
                    <div className="h-6 w-px bg-gray-200"></div>
                    <span className="text-sm text-gray-500">
                        {boardVisitors.length} active visitors
                    </span>
                </div>

                <button
                    onClick={() => setIsStageEditorOpen(true)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                    Edit Pipeline
                </button>
            </div>

            {/* Bulk Actions Bar */}
            {selectedVisitors.size > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                            {selectedVisitors.size} visitor(s) selected
                        </span>
                        <button
                            onClick={() => setSelectedVisitors(new Set())}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                            Clear Selection
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <select
                            onChange={(e) => e.target.value && handleBulkStageUpdate(e.target.value)}
                            className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-purple-200 dark:border-purple-700 rounded-lg text-sm"
                            defaultValue=""
                        >
                            <option value="" disabled>Move to stage...</option>
                            {stages.map((stage) => (
                                <option key={stage.id} value={stage.id}>{stage.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
                {stages.map((stage) => {
                    const stageVisitors = visitorsByStage[stage.name] || []; // Use name for mapping temporarily
                    const Icon = ICON_MAP[stage.icon || 'default'] || Layout;

                    return (
                        <div
                            key={stage.id}
                            className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-4 min-h-[500px] min-w-[280px]"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage.id)}
                            style={{ borderTop: `4px solid ${stage.color}` }}
                        >
                            {/* Column Header */}
                            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-zinc-700">
                                <h3 className="font-bold text-gray-900 dark:text-white truncate">{stage.name}</h3>
                                <span className="ml-auto text-xs font-bold text-gray-500 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full shadow-sm">
                                    {stageVisitors.length}
                                </span>
                            </div>

                            {/* Visitor Cards */}
                            <div className="space-y-3">
                                {stageVisitors.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                        Drop here
                                    </div>
                                ) : (
                                    stageVisitors.map((visitor) => (
                                        <div
                                            key={visitor.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, visitor.id)}
                                            className={`bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border transition-all cursor-grab active:cursor-grabbing group ${selectedVisitors.has(visitor.id)
                                                ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800'
                                                : 'border-gray-200 dark:border-zinc-700 hover:shadow-md'
                                                } ${draggedVisitor === visitor.id ? 'opacity-50' : ''}`}
                                        >
                                            <div className="flex items-start gap-3 mb-2">
                                                {/* Selection Checkbox */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleVisitorSelection(visitor.id);
                                                    }}
                                                    className={`mt-0.5 transition-colors ${selectedVisitors.has(visitor.id) ? 'text-purple-600' : 'text-gray-300 group-hover:text-gray-400'}`}
                                                >
                                                    {selectedVisitors.has(visitor.id) ? (
                                                        <CheckSquare className="w-4 h-4" />
                                                    ) : (
                                                        <Square className="w-4 h-4" />
                                                    )}
                                                </button>

                                                {/* Visitor Info - Clickable */}
                                                <div
                                                    className="flex-1 cursor-pointer"
                                                    onClick={() => setSelectedVisitor(visitor)}
                                                >
                                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                        {visitor.firstName} {visitor.lastName}
                                                    </h4>
                                                    {visitor.isFirstTime && (
                                                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 pl-7">
                                                {visitor.email && (
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <span className="truncate hover:text-gray-900">{visitor.email}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5 text-gray-400">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        {visitor.createdAt?.toDate ? visitor.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                                    </span>
                                                </div>
                                            </div>

                                            {visitor.prayerRequests && (
                                                <div className="mt-3 ml-7 bg-amber-50 dark:bg-amber-900/10 p-2 rounded text-xs text-amber-800 dark:text-amber-200 italic border border-amber-100 dark:border-amber-800 line-clamp-2">
                                                    "{visitor.prayerRequests}"
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            <VisitorDetailModal
                visitor={selectedVisitor}
                onClose={() => setSelectedVisitor(null)}
            />

            {/* Stage Editor */}
            <StageEditorModal
                board={selectedBoard}
                open={isStageEditorOpen}
                onClose={() => setIsStageEditorOpen(false)}
            />
        </div>
    );
}
