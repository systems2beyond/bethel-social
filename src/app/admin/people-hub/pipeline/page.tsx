"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Milestone, Loader2, Search, Plus } from "lucide-react";
import VisitorPipeline from '@/components/Admin/VisitorPipeline';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Filter, SortAsc, SortDesc, ArrowUpAZ, ArrowDownZA, Check } from "lucide-react";

function PipelinePageInner() {
    const { userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

    // Filter State
    const [filterMode, setFilterMode] = useState<'all' | 'new_guest' | 'prayer_request'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
    const [showFilter, setShowFilter] = useState(false);

    const hasActiveFilters = filterMode !== 'all' || sortBy !== 'newest';

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-rose-600/20" />
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
            {/* Main Header - Consistent with People Hub style */}
            <div className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm flex-shrink-0">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left: Back + Title */}
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin/people-hub"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 shadow-sm">
                                        <Milestone className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">Visitor Pipeline</h1>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Track guest follow-ups and follow follow-up journeys
                                </p>
                            </div>
                        </div>

                        {/* Center: Search Pipeline */}
                        <div className="hidden md:flex flex-1 max-w-md mx-8">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by name, phone or email..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Filter Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowFilter(!showFilter)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-tight rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap",
                                        hasActiveFilters
                                            ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                                            : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
                                    )}
                                >
                                    <Filter className="w-4 h-4 flex-shrink-0" />
                                    <span>Filter</span>
                                    {hasActiveFilters && (
                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse ml-1" />
                                    )}
                                </button>

                                {showFilter && (
                                    <>
                                        <div className="fixed inset-0 z-[60]" onClick={() => setShowFilter(false)} />
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-2xl z-[70] py-3 animate-in fade-in slide-in-from-top-2">
                                            {/* Sort Order */}
                                            <div className="px-4 py-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Sort By</label>
                                                <div className="space-y-1">
                                                    {[
                                                        { value: 'newest', label: 'Newest First', icon: SortDesc },
                                                        { value: 'oldest', label: 'Oldest First', icon: SortAsc },
                                                        { value: 'name_asc', label: 'Name (A-Z)', icon: ArrowUpAZ },
                                                        { value: 'name_desc', label: 'Name (Z-A)', icon: ArrowDownZA },
                                                    ].map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => setSortBy(option.value as any)}
                                                            className={cn(
                                                                "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-lg transition-colors",
                                                                sortBy === option.value
                                                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30"
                                                                    : "text-gray-600 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <option.icon className="w-3.5 h-3.5" />
                                                                <span>{option.label}</span>
                                                            </div>
                                                            {sortBy === option.value && <Check className="w-3.5 h-3.5" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="border-t border-gray-50 dark:border-zinc-700 my-2" />

                                            {/* Filter By */}
                                            <div className="px-4 py-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Filter Members</label>
                                                <div className="space-y-1">
                                                    {[
                                                        { value: 'all', label: 'Show All' },
                                                        { value: 'new_guest', label: 'New Guests Only' },
                                                        { value: 'prayer_request', label: 'Prayer Requests' },
                                                    ].map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => setFilterMode(option.value as any)}
                                                            className={cn(
                                                                "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-lg transition-colors",
                                                                filterMode === option.value
                                                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30"
                                                                    : "text-gray-600 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                                            )}
                                                        >
                                                            <span>{option.label}</span>
                                                            {filterMode === option.value && <Check className="w-3.5 h-3.5" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {hasActiveFilters && (
                                                <>
                                                    <div className="border-t border-gray-50 dark:border-zinc-700 my-2" />
                                                    <div className="px-4 pt-1">
                                                        <button
                                                            onClick={() => {
                                                                setSortBy('newest');
                                                                setFilterMode('all');
                                                            }}
                                                            className="w-full px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-center"
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
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline Board - Full Screen Height minus Header */}
            <div className="flex-1 overflow-hidden">
                <VisitorPipeline
                    externalSearch={searchQuery}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    filterMode={filterMode}
                    setFilterMode={setFilterMode}
                />
            </div>
        </div>
    );
}

export default function PipelinePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-rose-600" /></div>}>
            <PipelinePageInner />
        </Suspense>
    );
}
