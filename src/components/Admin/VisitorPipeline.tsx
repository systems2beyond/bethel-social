'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Visitor, PipelineBoard, PipelineStage, Event } from '@/types';
import {
    Loader2, Calendar, Plus, QrCode, Download, Printer, Settings,
    MoreHorizontal, Search, Filter, Trash2, Eye, Tag, ArrowRight,
    CheckSquare, Square, X, ArrowUpDown, Clock, SortAsc, SortDesc
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { updatePipelineStage, bulkUpdatePipelineStage } from '@/lib/crm';
import { subscribeToPipelineBoards, initializeDefaultBoard } from '@/lib/pipeline-boards';
import { useAuth } from '@/context/AuthContext';
import VisitorDetailModal from '@/components/CRM/VisitorDetailModal';
import BoardSelector from '@/components/CRM/BoardSelector';
import StageEditorModal from '@/components/CRM/StageEditorModal';

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
                group relative bg-zinc-800 rounded-lg border transition-all cursor-grab active:cursor-grabbing
                ${isSelected
                    ? 'border-purple-500 ring-1 ring-purple-500/50'
                    : 'border-zinc-700/50 hover:border-zinc-600'}
                ${isDragging ? 'opacity-40 scale-95' : 'hover:bg-zinc-750'}
            `}
        >
            {/* Color indicator bar */}
            <div
                className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
                style={{ backgroundColor: stageColor }}
            />

            <div className="p-2.5 pl-4">
                <div className="flex items-center gap-2">
                    {/* Checkbox - always visible */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}
                        className={`
                            flex-shrink-0 w-4 h-4 rounded border transition-all
                            ${isSelected
                                ? 'bg-purple-500 border-purple-500 text-white'
                                : 'border-zinc-600 hover:border-zinc-400'}
                        `}
                    >
                        {isSelected && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>

                    {/* Avatar */}
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: `${stageColor}30`, color: stageColor }}
                    >
                        {visitor.firstName?.[0]}{visitor.lastName?.[0]}
                    </div>

                    {/* Name - clickable */}
                    <button
                        onClick={onClick}
                        className="flex-1 text-left text-sm font-medium text-zinc-100 hover:text-white truncate"
                    >
                        {visitor.firstName} {visitor.lastName}
                    </button>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {visitor.isFirstTime && (
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-semibold rounded uppercase">
                                New
                            </span>
                        )}
                        {visitor.prayerRequests && (
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" title="Has prayer request" />
                        )}
                    </div>

                    {/* More button with dropdown - always visible */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowStageSubmenu(false); }}
                            className="p-0.5 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-zinc-200"
                        >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>

                        {/* Dropdown Menu - uses fixed positioning to avoid clipping */}
                        {showMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-[100]"
                                    onClick={() => { setShowMenu(false); setShowStageSubmenu(false); }}
                                />
                                <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-[101] py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onClick(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        View Details
                                    </button>

                                    {/* Move to Stage - click to expand inline */}
                                    <div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowStageSubmenu(!showStageSubmenu); }}
                                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <ArrowRight className="w-3.5 h-3.5" />
                                                Move to Stage
                                            </span>
                                            <ArrowRight className={`w-3 h-3 text-zinc-500 transition-transform ${showStageSubmenu ? 'rotate-90' : ''}`} />
                                        </button>
                                        {showStageSubmenu && (
                                            <div className="bg-zinc-900/50 py-1">
                                                {stages.map((stage) => (
                                                    <button
                                                        key={stage.id}
                                                        onClick={(e) => { e.stopPropagation(); onMoveToStage(stage.id); setShowMenu(false); setShowStageSubmenu(false); }}
                                                        className="w-full flex items-center gap-2 px-3 pl-8 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                                                    >
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                                        {stage.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onClick(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                                    >
                                        <Tag className="w-3.5 h-3.5" />
                                        Manage Tags
                                    </button>

                                    <div className="border-t border-zinc-700 my-1" />

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
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

export default function VisitorPipeline() {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [boards, setBoards] = useState<PipelineBoard[]>([]);
    const [selectedBoard, setSelectedBoard] = useState<PipelineBoard | null>(null);
    const [loading, setLoading] = useState(true);
    const [draggedVisitor, setDraggedVisitor] = useState<string | null>(null);
    const [selectedVisitors, setSelectedVisitors] = useState<Set<string>>(new Set());
    const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
    const [isStageEditorOpen, setIsStageEditorOpen] = useState(false);
    const [linkedEvent, setLinkedEvent] = useState<Event | null>(null);
    const [showQRCode, setShowQRCode] = useState(false);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
    const [filterFirstTime, setFilterFirstTime] = useState<boolean | null>(null);
    const [filterHasPrayer, setFilterHasPrayer] = useState<boolean | null>(null);

    const { user, userData } = useAuth();

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
    if (filterFirstTime !== null) {
        boardVisitors = boardVisitors.filter(v => v.isFirstTime === filterFirstTime);
    }
    if (filterHasPrayer !== null) {
        boardVisitors = boardVisitors.filter(v => filterHasPrayer ? !!v.prayerRequests : !v.prayerRequests);
    }

    // Apply sorting
    boardVisitors = [...boardVisitors].sort((a, b) => {
        switch (sortOrder) {
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

    // Select All helper
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
        setSearchQuery('');
        setSortOrder('newest');
        setFilterFirstTime(null);
        setFilterHasPrayer(null);
    };

    const hasActiveFilters = searchQuery || sortOrder !== 'newest' || filterFirstTime !== null || filterHasPrayer !== null;

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
        <div className="bg-zinc-950">
            {/* Top Header Bar */}
            <div className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center justify-between px-4 py-2">
                    {/* Left side - Board selector and info */}
                    <div className="flex items-center gap-3">
                        <BoardSelector
                            boards={boards}
                            selectedBoard={selectedBoard}
                            onSelectBoard={setSelectedBoard}
                        />

                        <div className="h-5 w-px bg-zinc-700" />

                        <span className="text-xs text-zinc-400">
                            {boardVisitors.length} contacts
                        </span>

                        {linkedEvent && (
                            <>
                                <div className="h-5 w-px bg-zinc-700" />
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                    <Calendar className="w-3 h-3 text-blue-400" />
                                    <span className="text-[11px] font-medium text-blue-300">
                                        {linkedEvent.title}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right side - Actions */}
                    <div className="flex items-center gap-1.5">
                        {/* Select All Checkbox */}
                        <button
                            onClick={handleSelectAll}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
                            title={allSelected ? "Deselect all" : "Select all"}
                        >
                            {allSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                            ) : someSelected ? (
                                <Square className="w-3.5 h-3.5 text-purple-400" />
                            ) : (
                                <Square className="w-3.5 h-3.5" />
                            )}
                            <span>Select All</span>
                        </button>

                        <div className="h-5 w-px bg-zinc-700 mx-1" />

                        {/* Search */}
                        <div className="relative flex items-center gap-1">
                            <button
                                onClick={() => setShowSearch(!showSearch)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                    showSearch || searchQuery
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                }`}
                            >
                                <Search className="w-3.5 h-3.5" />
                                <span>Search</span>
                            </button>

                            {/* Active search indicator - shows when search is active but popup is closed */}
                            {searchQuery && !showSearch && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-md">
                                    <span className="text-[11px] text-blue-300 max-w-[100px] truncate">
                                        "{searchQuery}"
                                    </span>
                                    <span className="text-[10px] text-blue-400/70">
                                        ({boardVisitors.length})
                                    </span>
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="ml-0.5 p-0.5 hover:bg-blue-500/20 rounded transition-colors"
                                        title="Clear search"
                                    >
                                        <X className="w-3 h-3 text-blue-400" />
                                    </button>
                                </div>
                            )}

                            {showSearch && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                            <input
                                                type="text"
                                                placeholder="Search by name, email, phone..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-8 pr-8 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                                                autoFocus
                                            />
                                            {searchQuery && (
                                                <button
                                                    onClick={() => setSearchQuery('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        {searchQuery && (
                                            <p className="text-[10px] text-zinc-500 mt-2">
                                                Found {boardVisitors.length} result{boardVisitors.length !== 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilter(!showFilter)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                    showFilter || hasActiveFilters
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                }`}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                <span>Filter</span>
                                {hasActiveFilters && (
                                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                )}
                            </button>

                            {showFilter && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowFilter(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                        {/* Sort Order */}
                                        <div className="px-3 py-2">
                                            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Sort By</label>
                                            <div className="mt-1.5 space-y-1">
                                                {[
                                                    { value: 'newest', label: 'Newest First', icon: SortDesc },
                                                    { value: 'oldest', label: 'Oldest First', icon: SortAsc },
                                                    { value: 'name_asc', label: 'Name A-Z', icon: SortAsc },
                                                    { value: 'name_desc', label: 'Name Z-A', icon: SortDesc },
                                                ].map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setSortOrder(opt.value as any)}
                                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                                                            sortOrder === opt.value
                                                                ? 'bg-zinc-700 text-zinc-100'
                                                                : 'text-zinc-400 hover:bg-zinc-700/50'
                                                        }`}
                                                    >
                                                        <opt.icon className="w-3 h-3" />
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-t border-zinc-700 my-1" />

                                        {/* Filter: First Time */}
                                        <div className="px-3 py-2">
                                            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">First Time Visitor</label>
                                            <div className="mt-1.5 flex gap-1">
                                                {[
                                                    { value: null, label: 'All' },
                                                    { value: true, label: 'Yes' },
                                                    { value: false, label: 'No' },
                                                ].map(opt => (
                                                    <button
                                                        key={String(opt.value)}
                                                        onClick={() => setFilterFirstTime(opt.value)}
                                                        className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                                                            filterFirstTime === opt.value
                                                                ? 'bg-zinc-700 text-zinc-100'
                                                                : 'text-zinc-400 hover:bg-zinc-700/50'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Filter: Has Prayer Request */}
                                        <div className="px-3 py-2">
                                            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Prayer Request</label>
                                            <div className="mt-1.5 flex gap-1">
                                                {[
                                                    { value: null, label: 'All' },
                                                    { value: true, label: 'Has' },
                                                    { value: false, label: 'None' },
                                                ].map(opt => (
                                                    <button
                                                        key={String(opt.value)}
                                                        onClick={() => setFilterHasPrayer(opt.value)}
                                                        className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                                                            filterHasPrayer === opt.value
                                                                ? 'bg-zinc-700 text-zinc-100'
                                                                : 'text-zinc-400 hover:bg-zinc-700/50'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {hasActiveFilters && (
                                            <>
                                                <div className="border-t border-zinc-700 my-1" />
                                                <div className="px-3 py-2">
                                                    <button
                                                        onClick={clearFilters}
                                                        className="w-full px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    >
                                                        Clear All Filters
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="h-5 w-px bg-zinc-700 mx-1" />
                        <button
                            onClick={() => setShowQRCode(!showQRCode)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                showQRCode
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                        >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR Code</span>
                        </button>
                        <button
                            onClick={() => setIsStageEditorOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Edit Stages</span>
                        </button>
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedVisitors.size > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 bg-purple-500/10 border-t border-purple-500/20">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-purple-300">
                                {selectedVisitors.size} selected
                            </span>
                            <button
                                onClick={() => setSelectedVisitors(new Set())}
                                className="text-[11px] text-purple-400 hover:text-purple-300 hover:underline"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                onChange={(e) => e.target.value && handleBulkStageUpdate(e.target.value)}
                                className="px-2 py-1 bg-zinc-800 border border-purple-500/30 rounded text-xs text-zinc-200"
                                defaultValue=""
                            >
                                <option value="" disabled>Move to...</option>
                                {stages.map((stage) => (
                                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={async () => {
                                    if (!confirm(`Delete ${selectedVisitors.size} visitor(s)? This cannot be undone.`)) return;
                                    for (const id of selectedVisitors) {
                                        await deleteDoc(doc(db, 'visitors', id));
                                    }
                                    setSelectedVisitors(new Set());
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                                Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* QR Code Panel */}
            {showQRCode && userData?.churchId && (
                <div className="px-4 pt-3">
                    <QRCodePanel
                        churchId={userData.churchId}
                        onClose={() => setShowQRCode(false)}
                    />
                </div>
            )}

            {/* Kanban Board - fits viewport with room for horizontal scrollbar */}
            <div className="flex gap-3 p-4 overflow-x-auto pb-2" style={{ height: 'calc(100vh - 300px)' }}>
                {stages.map((stage) => {
                    const stageVisitors = visitorsByStage[stage.name] || [];

                    return (
                        <div
                            key={stage.id}
                            className="flex flex-col bg-zinc-900/80 rounded-lg w-[260px] flex-shrink-0 max-h-full"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage.id)}
                        >
                            {/* Column Header */}
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800 flex-shrink-0">
                                <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: stage.color }}
                                />
                                <span className="text-sm font-medium text-zinc-200 truncate">
                                    {stage.name}
                                </span>
                                <span className="text-xs text-zinc-500 font-medium">
                                    / {stageVisitors.length}
                                </span>
                            </div>

                            {/* Cards Container - scrolls internally */}
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0">
                                {stageVisitors.length === 0 ? (
                                    <div className="flex items-center justify-center h-16 border border-dashed border-zinc-700 rounded-lg">
                                        <span className="text-xs text-zinc-600">Drop here</span>
                                    </div>
                                ) : (
                                    stageVisitors.map((visitor) => (
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
                                    ))
                                )}
                            </div>

                            {/* Add Card Button */}
                            <button className="flex items-center justify-center gap-1.5 m-2 p-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors flex-shrink-0">
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Item</span>
                            </button>
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
                        text-align: center;
                        padding: 40px;
                    }
                    h1 {
                        font-size: 32px;
                        margin-bottom: 8px;
                        color: #1a1a1a;
                    }
                    p {
                        font-size: 18px;
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
                        margin-top: 24px;
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-in slide-in-from-top-2">
            <div className="flex items-start gap-4">
                {/* QR Code */}
                <div className="bg-white p-3 rounded-lg flex-shrink-0">
                    <QRCodeSVG
                        id="connect-qr-code"
                        value={connectUrl}
                        size={120}
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
                            <h3 className="text-sm font-semibold text-zinc-100 mb-1">
                                Digital Connection Card
                            </h3>
                            <p className="text-xs text-zinc-400 mb-2">
                                Display during service for visitors to connect.
                            </p>
                            <code className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-1 rounded font-mono block truncate">
                                {connectUrl}
                            </code>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-zinc-500 hover:text-zinc-300 text-xs"
                        >
                            Close
                        </button>
                    </div>

                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-medium text-zinc-300 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-medium text-zinc-300 transition-colors"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                        </button>
                        <Link
                            href="/admin/connect"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium text-white transition-colors"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            Edit Form
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
