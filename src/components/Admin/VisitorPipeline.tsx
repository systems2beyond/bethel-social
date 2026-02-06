'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Visitor, PipelineBoard, PipelineStage, Event } from '@/types';
import {
    Loader2, Calendar, Plus, QrCode, Download, Printer, Settings,
    MoreHorizontal, Search, Filter, Trash2, Eye, Tag, ArrowRight,
    CheckSquare, Square, X, ArrowUpDown, Clock, SortAsc, SortDesc,
    Milestone, Layout
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { updatePipelineStage, bulkUpdatePipelineStage } from '@/lib/crm';
import { subscribeToPipelineBoards, initializeDefaultBoard, DEFAULT_STAGES } from '@/lib/pipeline-boards';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import VisitorDetailModal from '@/components/CRM/VisitorDetailModal';
import BoardSelector from '@/components/CRM/BoardSelector';
import StageEditorModal from '@/components/CRM/StageEditorModal';
import CreateBoardModal from '@/components/CRM/CreateBoardModal';
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import "mobile-drag-drop/default.css";

// Compact visitor card component with dropdown menu
function VisitorCard({
    visitor,
    isSelected,
    isDragging,
    onSelect,
    onClick,
    onDragStart,
    onDelete,
    onMoveToStage,
    stageColor,
    stages
}: {
    visitor: Visitor;
    isSelected: boolean;
    isDragging: boolean;
    onSelect: () => void;
    onClick: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDelete: () => void;
    onMoveToStage: (stageId: string) => void;
    stageColor: string;
    stages: PipelineStage[];
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [showStageSubmenu, setShowStageSubmenu] = useState(false);

    return (
        <div
            draggable
            onDragStart={onDragStart}
            className={`
                group relative bg-white dark:bg-zinc-800 rounded-xl border transition-all cursor-grab active:cursor-grabbing shadow-sm
                ${isSelected
                    ? 'border-rose-300 ring-1 ring-rose-500/20'
                    : 'border-gray-100 dark:border-zinc-700/50 hover:border-gray-200'}
                ${isDragging ? 'opacity-40 scale-95' : (showMenu ? 'shadow-md border-rose-300' : 'hover:scale-[1.02] hover:shadow-md')}
                ${showMenu ? 'z-[60]' : 'z-auto'}
            `}
        >
            {/* Color indicator bar */}
            <div
                className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full"
                style={{ backgroundColor: stageColor }}
            />

            <div className="p-3 pl-5">
                <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}
                        aria-label="Select visitor"
                        className={`
                            flex-shrink-0 w-4 h-4 rounded border transition-all
                            ${isSelected
                                ? 'bg-rose-500 border-rose-500 text-white'
                                : 'border-gray-300 dark:border-zinc-600 hover:border-rose-400'}
                        `}
                    >
                        {isSelected && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>

                    {/* Content - clickable */}
                    <div className="flex-1 min-w-0" onClick={onClick}>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">
                                {visitor.firstName} {visitor.lastName}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {visitor.isFirstTime && (
                                <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 text-[9px] font-bold rounded uppercase tracking-wider">
                                    New Guest
                                </span>
                            )}
                            {visitor.prayerRequests && (
                                <span className="flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold rounded uppercase tracking-wider border border-amber-100">
                                    Prayer
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
                                        View Profile
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
                                        <ArrowRight className={`w-3 h-3 text-gray-400 transition-transform ${showStageSubmenu ? 'rotate-90' : ''}`} />
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
                                        Delete Record
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

interface VisitorPipelineProps {
    externalSearch?: string;
    sortBy: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
    setSortBy: (sort: 'newest' | 'oldest' | 'name_asc' | 'name_desc') => void;
    filterMode: 'all' | 'new_guest' | 'prayer_request';
    setFilterMode: (mode: 'all' | 'new_guest' | 'prayer_request') => void;
}

export default function VisitorPipeline({
    externalSearch = "",
    sortBy,
    setSortBy,
    filterMode,
    setFilterMode
}: VisitorPipelineProps) {
    const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
    const [isStageEditorOpen, setIsStageEditorOpen] = useState(false);
    const [linkedEvent, setLinkedEvent] = useState<Event | null>(null);
    const [showQRCode, setShowQRCode] = useState(false);
    const [createBoardOpen, setCreateBoardOpen] = useState(false);

    const [boards, setBoards] = useState<PipelineBoard[]>([]);
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBoard, setSelectedBoard] = useState<PipelineBoard | null>(null);
    const [selectedVisitors, setSelectedVisitors] = useState<Set<string>>(new Set());
    const [draggedVisitor, setDraggedVisitor] = useState<string | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Sync external search
    useEffect(() => {
        setSearchQuery(externalSearch);
    }, [externalSearch]);

    // Initialize Mobile Drag Drop Polyfill for iPad/Touch Support
    useEffect(() => {
        polyfill({
            dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
            holdToDrag: 300 // Slight delay to distinguish scroll from drag
        });

        // Prevent default scrolling when touching draggable elements on iOS 10+
        const preventTouchScroll = (e: TouchEvent) => {
            // Logic handled by polyfill's CSS usually, but this listener helps passive event issues
        };
        window.addEventListener('touchmove', function () { }, { passive: false });
    }, []);

    const { user, userData } = useAuth();

    // Initialize Boards & Subscribe
    useEffect(() => {
        if (!user) return;

        let isMounted = true;

        // Safety timeout for boards loading
        const boardsTimeoutId = setTimeout(() => {
            if (isMounted) setLoading(false);
        }, 10000); // Extended timeout as fallback

        let unsubscribe: (() => void) | undefined;

        // 1. Subscribe to boards IMMEDIATELY
        unsubscribe = subscribeToPipelineBoards((data) => {
            if (!isMounted) return;
            clearTimeout(boardsTimeoutId);
            setBoards(data);

            // Select first board if none selected using ID check to persist selection
            setSelectedBoard(prev => {
                // If we already have a selected board, update it with fresh data
                if (prev) {
                    const updated = data.find(b => b.id === prev.id);
                    return updated || prev;
                }
                // Otherwise default to the first one available
                return data.length > 0 ? data[0] : null;
            });

            // Clear loading if we got data or if empty array returned (subscription working)
            setLoading(false);
        });

        // 2. Run initialization check in BACKGROUND (don't block UI)
        initializeDefaultBoard(user.uid)
            .catch(err => {
                console.error("Background board initialization failed:", err);
                // We don't stop loading here, we rely on the subscription or timeout
            });

        return () => {
            isMounted = false;
            clearTimeout(boardsTimeoutId);
            if (unsubscribe) unsubscribe();
        };
    }, [user]);

    // Fetch Linked Event Details
    useEffect(() => {
        if (selectedBoard?.linkedEventId) {
            import('@/lib/services/EventsService').then(({ EventsService }) => {
                EventsService.getEvent(selectedBoard.linkedEventId!)
                    .then(event => setLinkedEvent(event))
                    .catch(err => console.error('Failed to fetch linked event:', err));
            });
        } else {
            setLinkedEvent(null);
        }
    }, [selectedBoard?.linkedEventId]);

    // Fetch Visitors
    useEffect(() => {
        const q = query(collection(db, 'visitors'), orderBy('createdAt', 'desc'));

        // Safety timeout to ensure loading spinner doesn't stay forever
        const timeoutId = setTimeout(() => {
            setLoading(false);
        }, 5000);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            clearTimeout(timeoutId);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Visitor[];
            setVisitors(data);
            setLoading(false);
        }, (error) => {
            console.error("Firestore onSnapshot error:", error);
            clearTimeout(timeoutId);
            setLoading(false);
        });
        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
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

    const handleMoveToStage = async (visitorId: string, stageId: string) => {
        try {
            await updatePipelineStage(visitorId, stageId as any, user?.uid);
        } catch (error) {
            console.error("Error moving visitor:", error);
            alert("Failed to move visitor");
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
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full animate-pulse" />
                    <Loader2 className="w-10 h-10 animate-spin text-rose-600 relative z-10" />
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium animate-pulse">
                    Loading pipeline boards...
                </p>
            </div>
        );
    }

    if (!selectedBoard) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
                    <Milestone className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">No Pipeline Boards Found</h3>
                <p className="text-sm text-muted-foreground mb-8">
                    We couldn't load your pipeline boards. This might be due to a connection issue or no boards being initialized yet.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <Button
                        onClick={() => window.location.reload()}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-6 h-11 transition-all"
                    >
                        Retry Connection
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setSelectedBoard({ id: 'preview', name: 'Sample Pipeline', stages: DEFAULT_STAGES } as any)}
                        className="flex-1 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 font-semibold rounded-xl px-6 h-11 transition-all"
                    >
                        Show Sample View
                    </Button>
                </div>
            </div>
        );
    }

    // Filter visitors by board (Legacy support: show unassigned visitors on Sunday Service board)
    let boardVisitors = visitors.filter(v => {
        if (v.boardId === selectedBoard.id) return true;
        // Fallback: If no boardId and this is Sunday Service, show them
        if (!v.boardId && selectedBoard.type === 'sunday_service') return true;
        return false;
    });

    // Apply search filter
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        boardVisitors = boardVisitors.filter(v =>
            v.firstName?.toLowerCase().includes(query) ||
            v.lastName?.toLowerCase().includes(query) ||
            v.email?.toLowerCase().includes(query) ||
            v.phone?.includes(query)
        );
    }

    // Apply filters
    if (filterMode === 'new_guest') {
        boardVisitors = boardVisitors.filter(v => v.isFirstTime === true);
    }
    if (filterMode === 'prayer_request') {
        boardVisitors = boardVisitors.filter(v => !!v.prayerRequests);
    }

    // Apply sorting
    boardVisitors = [...boardVisitors].sort((a, b) => {
        switch (sortBy) {
            case 'oldest':
                return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
            case 'name_asc':
                return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
            case 'name_desc':
                return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
            case 'newest':
            default:
                return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
        }
    });
    const allVisitorIds = boardVisitors.map(v => v.id);
    const allSelected = allVisitorIds.length > 0 && allVisitorIds.every(id => selectedVisitors.has(id));
    const someSelected = allVisitorIds.some(id => selectedVisitors.has(id));

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedVisitors(new Set());
        } else {
            setSelectedVisitors(new Set(allVisitorIds));
        }
    };

    const clearFilters = () => {
        setSortBy('newest');
        setFilterMode('all');
    };

    const hasActiveFilters = externalSearch || sortBy !== 'newest' || filterMode !== 'all';





    // Group visitors by pipeline stage
    // Use dynamic stages from selectedBoard
    const stages = selectedBoard.stages || [];
    const visitorsByStage = stages.reduce((acc, stage) => {
        acc[stage.id] = boardVisitors.filter(v => {
            const visitorStage = v.pipelineStage || 'new_guest';

            // 1. Direct match by ID (preferred)
            if (visitorStage === stage.id) return true;

            // 2. Legacy stage mapping (backward compatibility)
            const legacyMap: Record<string, string> = {
                'new_guest': 'New Guest',
                'contacted': 'Contacted',
                'second_visit': 'Second Visit',
                'ready_for_membership': 'Ready for Member'
            };

            // Normalize visitor stage name
            const normalizedVisitorStage = legacyMap[visitorStage] || visitorStage;

            // Match by normalized name
            return normalizedVisitorStage.toLowerCase() === stage.name.toLowerCase();
        });
        return acc;
    }, {} as Record<string, Visitor[]>);

    const currentBoardIds = boardVisitors.map(v => v.id);

    return (
        <div className="bg-gray-50 dark:bg-zinc-950 flex flex-col h-full overflow-hidden">
            {/* Copper Style Toolbar Area - Made Sticky */}
            <div className="sticky top-0 z-40 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm flex-shrink-0">
                <div className="max-w-full mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left: Board Selector + Info */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <BoardSelector
                                boards={boards}
                                selectedBoard={selectedBoard}
                                onSelectBoard={setSelectedBoard}
                            />

                            <div className="h-6 w-px bg-gray-100 dark:bg-zinc-700 hidden sm:block" />

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900 dark:text-zinc-300">
                                    {boardVisitors.length}
                                </span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider text-[10px] font-semibold mr-4">
                                    Contacts
                                </span>
                            </div>

                            {linkedEvent && (
                                <>
                                    <div className="h-6 w-px bg-gray-100 dark:bg-zinc-700 hidden sm:block" />
                                    <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full shadow-sm">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span className="text-xs font-bold">
                                            {linkedEvent.title}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 justify-end flex-shrink-0">

                            {/* Select All Button */}
                            <button
                                onClick={() => {
                                    if (selectedVisitors.size === currentBoardIds.length && currentBoardIds.length > 0) {
                                        setSelectedVisitors(new Set());
                                    } else {
                                        setSelectedVisitors(new Set(currentBoardIds));
                                    }
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all border shadow-sm active:scale-95 whitespace-nowrap",
                                    selectedVisitors.size === currentBoardIds.length && currentBoardIds.length > 0
                                        ? "bg-rose-50 text-rose-600 border-rose-100"
                                        : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700"
                                )}
                                title="Select All Visible"
                            >
                                <CheckSquare className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden lg:inline">Select All</span>
                            </button>

                            <div className="h-6 w-px bg-gray-100 dark:bg-zinc-700 mx-1 hidden sm:block" />

                            <button
                                onClick={() => setShowQRCode(!showQRCode)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all border shadow-sm active:scale-95 whitespace-nowrap",
                                    showQRCode
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                        : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700"
                                )}
                                title="Share QR Code"
                            >
                                <QrCode className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden lg:inline">QR Code</span>
                            </button>

                            <Link
                                href="/admin/connect"
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                title="Form Editor"
                            >
                                <Layout className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden lg:inline">Form Editor</span>
                            </Link>

                            <Button
                                size="sm"
                                onClick={() => setCreateBoardOpen(true)}
                                className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-md border-0 px-4 font-black tracking-tight rounded-xl active:scale-95 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                <span className="hidden sm:inline">Create Pipeline</span>
                                <span className="sm:hidden">Create</span>
                            </Button>

                            <div className="h-6 w-px bg-gray-100 dark:bg-zinc-700 mx-1 hidden sm:block" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Board Modal */}
            < CreateBoardModal
                open={createBoardOpen}
                onOpenChange={setCreateBoardOpen}
                onSuccess={(newBoardId) => {
                    // Logic to select the new board if needed
                    // For now, the subscription should pick it up
                }
                }
            />
            {/* Bulk Actions Highlight Bar - Floating Premium Style */}
            {
                selectedVisitors.size > 0 && (
                    <div className="sticky top-0 z-[60] flex items-center justify-between px-6 py-3 bg-rose-600/95 backdrop-blur-md text-white shadow-2xl animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <CheckSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="block text-sm font-black leading-none">
                                        {selectedVisitors.size} Contacts Selected
                                    </span>
                                    <button
                                        onClick={() => setSelectedVisitors(new Set())}
                                        className="text-[10px] font-bold text-rose-100 hover:text-white underline underline-offset-2 transition-colors"
                                    >
                                        Deselect all
                                    </button>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-white/20" />

                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-2 px-4 py-2 bg-white text-rose-600 rounded-xl text-xs font-black shadow-sm hover:bg-rose-50 transition-all active:scale-95">
                                    <ArrowRight className="w-4 h-4" />
                                    Move Stage
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-all active:scale-95">
                                    <Tag className="w-4 h-4" />
                                    Add Tags
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Delete ${selectedVisitors.size} records?`)) return;
                                        for (const id of selectedVisitors) {
                                            await deleteDoc(doc(db, 'visitors', id));
                                        }
                                        setSelectedVisitors(new Set());
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl text-xs font-bold text-rose-100 hover:text-white transition-all underline underline-offset-4"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedVisitors(new Set())}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )
            }

            {/* QR Code Panel */}
            {
                showQRCode && userData?.churchId && (
                    <div className="px-4 pt-3">
                        <QRCodePanel
                            churchId={userData.churchId}
                            onClose={() => setShowQRCode(false)}
                        />
                    </div>
                )
            }

            {/* Kanban Board Container */}
            <div className="flex-1 overflow-x-scroll px-6 py-6 pb-20 mb-24 pipeline-scrollbar">
                <div className="flex gap-6 h-full min-w-max items-start">
                    {stages.map((stage) => {
                        const stageVisitors = visitorsByStage[stage.id] || [];

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
                                            {stageVisitors.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Cards List */}
                                <div className="flex-1 px-3 py-1 space-y-3 overflow-y-auto scrollbar-hide custom-scrollbar">
                                    {stageVisitors.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-3xl bg-gray-50/50 dark:bg-zinc-900/10 transition-colors hover:bg-gray-100/50 dark:hover:bg-zinc-800/30">
                                            <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm mb-4">
                                                <Plus className="w-5 h-5 text-gray-300 dark:text-zinc-600" />
                                            </div>
                                            <p className="text-[10px] font-black text-gray-300 dark:text-zinc-600 uppercase tracking-[0.25em]">Drop Guest Here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {stageVisitors.map((visitor) => (
                                                <VisitorCard
                                                    key={visitor.id}
                                                    visitor={visitor}
                                                    isSelected={selectedVisitors.has(visitor.id)}
                                                    isDragging={draggedVisitor === visitor.id}
                                                    onSelect={() => toggleVisitorSelection(visitor.id)}
                                                    onClick={() => setSelectedVisitor(visitor)}
                                                    onDragStart={(e) => handleDragStart(e, visitor.id)}
                                                    onDelete={() => handleDelete(visitor.id)}
                                                    onMoveToStage={(stageId) => handleMoveToStage(visitor.id, stageId)}
                                                    stageColor={stage.color}
                                                    stages={stages}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Action - Standard Link */}

                            </div>
                        );
                    })}
                </div>
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
        </div >

    );
}

// QR Code Panel Component
function QRCodePanel({ churchId, onClose }: { churchId: string; onClose: () => void }) {
    const connectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/connect/${churchId}`
        : `https://bethel-metro-social.netlify.app/connect/${churchId}`;

    const handleDownload = () => {
        const svg = document.getElementById('connect-qr-code');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL('image/png');

            const downloadLink = document.createElement('a');
            downloadLink.download = 'bethel-connect-qr.png';
            downloadLink.href = pngFile;
            downloadLink.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const svg = document.getElementById('connect-qr-code');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Connect Card QR Code</title>
                    <style>
                        body {
                            display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                        .container {
                            text - align: center;
                        padding: 40px;
                    }
                        h1 {
                            font - size: 32px;
                        margin-bottom: 8px;
                        color: #1a1a1a;
                    }
                        p {
                            font - size: 18px;
                        color: #666;
                        margin-bottom: 32px;
                    }
                        .qr-container {
                            padding: 24px;
                        background: white;
                        border-radius: 16px;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
                        display: inline-block;
                    }
                        .url {
                            margin - top: 24px;
                        font-size: 14px;
                        color: #888;
                    }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Bethel Metropolitan</h1>
                        <p>Scan to connect with us</p>
                        <div class="qr-container">
                            ${svgData}
                        </div>
                        <p class="url">${connectUrl}</p>
                    </div>
                </body>
            </html>
            `);

        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-start gap-6">
                {/* QR Code */}
                <div className="bg-white p-4 rounded-2xl flex-shrink-0 shadow-inner border border-gray-50 dark:border-zinc-800">
                    <QRCodeSVG
                        id="connect-qr-code"
                        value={connectUrl}
                        size={140}
                        level="H"
                        includeMargin={false}
                        bgColor="#FFFFFF"
                        fgColor="#18181B"
                    />
                </div>

                {/* Info & Actions */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-1">
                                Digital Connection Card
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4 leading-relaxed">
                                Display this QR code during service walkthroughs. Visitors can scan to instantly submit their info directly into this pipeline.
                            </p>
                            <div className="flex items-center gap-2 group">
                                <code className="flex-1 text-[10px] text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg font-mono truncate border border-gray-50 dark:border-zinc-700">
                                    {connectUrl}
                                </code>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-400 dark:text-zinc-500 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mt-6">
                        <button
                            onClick={handleDownload}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-700 dark:text-zinc-300 transition-all shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Download SVG
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-700 dark:text-zinc-300 transition-all shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Print Flyer
                        </button>
                        <Link
                            href="/admin/connect"
                            className="flex items-center justify-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-600 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-rose-500/20"
                        >
                            <Settings className="w-4 h-4" />
                            Customize Form
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
