'use client';

import React from 'react';
import { MousePointer2, Users } from 'lucide-react';

export const GroupNavigationTutorial = () => {
    return (
        <div className="relative w-full max-w-[320px] mx-auto h-[160px] bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-inner flex flex-col items-center justify-center p-4">
            {/* Mock Navigation Bar */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 flex items-center px-4 gap-4 opacity-50">
                <div className="w-16 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full"></div>
                <div className="hidden sm:flex gap-4">
                    <div className="w-12 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full"></div>
                    <div className="w-12 h-2 bg-gray-200 dark:bg-zinc-800 rounded-full"></div>
                </div>
            </div>

            {/* Target Area (Groups Tab) */}
            <div className="mt-8 flex flex-col items-center gap-2 animate-pulse">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-zinc-900 transition-all">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-semibold">Groups</span>
                </div>
                <p className="text-xs text-gray-500 font-medium">Click here to find your group</p>
            </div>

            {/* Animated Cursor */}
            <div className="absolute top-[60%] right-[20%] animate-cursor-move text-slate-800 dark:text-slate-100 drop-shadow-md">
                <MousePointer2 className="w-6 h-6 fill-black dark:fill-white stroke-white dark:stroke-black" />
            </div>

            <style jsx>{`
                @keyframes cursor-move {
                    0% { transform: translate(40px, 40px); opacity: 0; }
                    20% { opacity: 1; }
                    50% { transform: translate(-10px, -40px); }
                    60% { transform: translate(-10px, -40px) scale(0.9); } /* Click effect */
                    70% { transform: translate(-10px, -40px) scale(1); }
                    100% { transform: translate(-10px, -40px); opacity: 0; }
                }
                .animate-cursor-move {
                    animation: cursor-move 2.5s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};
