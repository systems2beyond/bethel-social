import React, { useState } from 'react';
import { Users, Wifi, Share2, Globe, Settings, Lock, Eye, Edit2 } from 'lucide-react';
import TiptapEditor, { EditorToolbar } from '../Editor/TiptapEditor'; // Assuming default import
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface FellowshipViewProps {
    editorProps: any; // Pass through props for Tiptap
    onlineCount?: number; // Placeholder for now, can perform awareness logic later or inside
    scrollId: string;
}

export default function FellowshipView({ editorProps, scrollId }: FellowshipViewProps) {
    const { userData } = useAuth();
    const [showSettings, setShowSettings] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [allowEditing, setAllowEditing] = useState(true);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0B1120]"> {/* Distinct Background */}
            {/* Fellowship Header */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-indigo-100 dark:border-indigo-900/30 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20 text-white animate-pulse-slow">
                        <Users className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            Fellowship Scroll
                            {isPublic ? (
                                <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[10px] flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-mono">
                                    <Globe className="w-3 h-3" /> Public
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center gap-1 text-slate-500 font-mono">
                                    <Lock className="w-3 h-3" /> Private
                                </span>
                            )}
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Wifi className="w-3 h-3 text-green-500" /> Live Connection • ID: {scrollId.slice(0, 8)}...
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500'}`}
                        title="Collaboration Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-indigo-500" title="Share Scroll">
                        <Share2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white dark:bg-[#0f172a] border-b border-indigo-100 dark:border-indigo-900/30 overflow-hidden"
                    >
                        <div className="p-4 grid gap-4 grid-cols-2">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                                        <Eye className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Visibility</p>
                                        <p className="text-[10px] text-slate-500">Who can see this scroll</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsPublic(!isPublic)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isPublic ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                                        <Edit2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Permissions</p>
                                        <p className="text-[10px] text-slate-500">Allow others to edit</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAllowEditing(!allowEditing)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${allowEditing ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${allowEditing ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Editor Container with Special Styling */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-[0.03] pointer-events-none" /> {/* Subtle pattern */}
                <div className="h-full flex flex-col">
                    <div className="border-b border-indigo-50 dark:border-indigo-900/20 px-2 bg-white/50 dark:bg-[#0B1120]/50 backdrop-blur-sm">
                        {/* We can place a specific toolbar here if we want overrides, 
                             but using the Editor's internal logic is often cleaner unless we want a floating one. */}
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <TiptapEditor
                            {...editorProps}
                            className="h-full overflow-y-auto px-6 py-6 custom-scrollbar prose-indigo max-w-none"
                        />
                    </div>
                </div>
            </div>

            {/* Fellowship Footer / Status */}
            <div className="shrink-0 bg-indigo-50 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-900/20 px-4 py-2 flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>Participating as {userData?.displayName || 'Anonymous'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span>{editorProps.collaborationId ? 'Synced' : 'Offline'}</span>
                    <span className="opacity-50">|</span>
                    <span>v1.2.0</span>
                </div>
            </div>
        </div>
    );
}
