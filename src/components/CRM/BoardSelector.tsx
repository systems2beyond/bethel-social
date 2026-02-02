'use client';

import React from 'react';
import { PipelineBoard } from '@/types';
import {
    Layout,
    Calendar,
    Plus,
    Check,
    ChevronDown,
    Briefcase
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import CreateBoardModal from './CreateBoardModal';

interface BoardSelectorProps {
    boards: PipelineBoard[];
    selectedBoard: PipelineBoard | null;
    onSelectBoard: (board: PipelineBoard) => void;
}

export default function BoardSelector({
    boards,
    selectedBoard,
    onSelectBoard
}: BoardSelectorProps) {
    const [createModalOpen, setCreateModalOpen] = React.useState(false);
    const [open, setOpen] = React.useState(false);

    const getBoardIcon = (type: PipelineBoard['type']) => {
        switch (type) {
            case 'sunday_service': return <Layout className="w-3.5 h-3.5 text-blue-400" />;
            case 'event': return <Calendar className="w-3.5 h-3.5 text-purple-400" />;
            case 'custom': return <Briefcase className="w-3.5 h-3.5 text-zinc-400" />;
            default: return <Layout className="w-3.5 h-3.5 text-zinc-400" />;
        }
    };

    return (
        <>
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                    <button
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-750 hover:border-zinc-600 transition-colors min-w-[180px] justify-between group"
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedBoard ? (
                                <>
                                    {getBoardIcon(selectedBoard.type)}
                                    <span className="text-sm font-medium text-zinc-200 truncate">
                                        {selectedBoard.name}
                                    </span>
                                </>
                            ) : (
                                <span className="text-sm text-zinc-500">Select Board...</span>
                            )}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        className="z-50 w-[240px] bg-zinc-900 rounded-lg shadow-xl border border-zinc-800 p-1 animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                        sideOffset={4}
                        align="start"
                    >
                        <div className="space-y-0.5">
                            <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                                Boards
                            </div>

                            {boards.length === 0 && (
                                <div className="px-2.5 py-3 text-xs text-zinc-500 text-center">
                                    No boards found.
                                </div>
                            )}

                            <div className="max-h-[280px] overflow-y-auto space-y-0.5">
                                {boards.map((board) => (
                                    <button
                                        key={board.id}
                                        onClick={() => {
                                            onSelectBoard(board);
                                            setOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-colors ${selectedBoard?.id === board.id
                                            ? 'bg-blue-500/20 text-blue-300'
                                            : 'text-zinc-300 hover:bg-zinc-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {getBoardIcon(board.type)}
                                            <span className="truncate text-sm">{board.name}</span>
                                        </div>
                                        {selectedBoard?.id === board.id && (
                                            <Check className="w-3.5 h-3.5 text-blue-400" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="h-px bg-zinc-800 my-1"></div>

                            <button
                                onClick={() => {
                                    setCreateModalOpen(true);
                                    setOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create New Board</span>
                            </button>
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>

            <CreateBoardModal
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
                onSuccess={(newBoardId) => {
                    // Optionally auto-select the new board, but we might rely on the subscription in parent to pick it up?
                    // Ideally we passed down a way to select it, or the parent subscription sees it.
                    // The parent subscription updates `boards`, but `selectedBoard` logic picks the first if none selected,
                    // or keeps current. 
                    // We might want to auto-select the new one.
                    // For now, let's just let it appear in the list.
                }}
            />
        </>
    );
}
