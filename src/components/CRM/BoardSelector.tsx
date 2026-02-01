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

interface BoardSelectorProps {
    boards: PipelineBoard[];
    selectedBoard: PipelineBoard | null;
    onSelectBoard: (board: PipelineBoard) => void;
    onCreateBoard: () => void;
}

export default function BoardSelector({
    boards,
    selectedBoard,
    onSelectBoard,
    onCreateBoard
}: BoardSelectorProps) {
    const [open, setOpen] = React.useState(false);

    const getBoardIcon = (type: PipelineBoard['type']) => {
        switch (type) {
            case 'sunday_service': return <Layout className="w-4 h-4 text-blue-500" />;
            case 'event': return <Calendar className="w-4 h-4 text-purple-500" />;
            case 'custom': return <Briefcase className="w-4 h-4 text-gray-500" />;
            default: return <Layout className="w-4 h-4" />;
        }
    };

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors min-w-[200px] justify-between group"
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedBoard ? (
                            <>
                                {getBoardIcon(selectedBoard.type)}
                                <span className="font-medium text-gray-700 truncate">
                                    {selectedBoard.name}
                                </span>
                            </>
                        ) : (
                            <span className="text-gray-400">Select Board...</span>
                        )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="z-50 w-[260px] bg-white rounded-xl shadow-lg border border-gray-100 p-1 animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                    sideOffset={5}
                    align="start"
                >
                    <div className="space-y-1">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Pipeline Boards
                        </div>

                        {boards.length === 0 && (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center italic">
                                No boards found.
                            </div>
                        )}

                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {boards.map((board) => (
                                <button
                                    key={board.id}
                                    onClick={() => {
                                        onSelectBoard(board);
                                        setOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selectedBoard?.id === board.id
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        {getBoardIcon(board.type)}
                                        <span className="truncate">{board.name}</span>
                                    </div>
                                    {selectedBoard?.id === board.id && (
                                        <Check className="w-4 h-4 text-blue-600" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="h-px bg-gray-100 my-1"></div>

                        <button
                            onClick={() => {
                                onCreateBoard();
                                setOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create New Board</span>
                        </button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
