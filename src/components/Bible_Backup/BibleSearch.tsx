'use client';

import React, { useState } from 'react';
import { Search, Loader2, BookOpen } from 'lucide-react';
import { useBible } from '@/context/BibleContext';

interface SearchResult {
    reference: string;
    text: string;
    book_id: string;
    chapter: number;
    verse: number;
}

export default function BibleSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { openBible } = useBible();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        try {
            // Using bible-api.com for search (King James Version by default)
            const res = await fetch(`https://bible-api.com/?search=${encodeURIComponent(query)}`);

            if (!res.ok) {
                throw new Error('Failed to fetch results');
            }

            const data = await res.json();

            if (data.verses) {
                setResults(data.verses);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error("Search failed:", error);
            setError("Failed to search. Please check your connection.");
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
            <form onSubmit={handleSearch} className="p-4 border-b border-gray-100 dark:border-zinc-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search verses (e.g., 'love', 'John 3:16')..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white placeholder-gray-500"
                    />
                </div>
            </form>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                ) : error ? (
                    <div className="text-center py-8 text-red-500 text-sm">
                        {error}
                    </div>
                ) : results.length > 0 ? (
                    results.map((verse: any, idx) => (
                        <div
                            key={idx}
                            onClick={() => {
                                openBible({
                                    book: verse.book_name || verse.book_id,
                                    chapter: verse.chapter,
                                    verse: verse.verse
                                });
                            }}
                            className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-zinc-800"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                                    {verse.reference}
                                </span>
                                <BookOpen className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed line-clamp-2">
                                {verse.text}
                            </p>
                        </div>
                    ))
                ) : query && !loading ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                        No results found for "{query}"
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                        Search for keywords or references to find verses.
                    </div>
                )}
            </div>
        </div>
    );
}
