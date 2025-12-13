'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { bibleSearch } from '@/lib/search/bible-index';
import { Plus, X, Loader2, Check, AlertCircle, Link as LinkIcon, BookOpen } from 'lucide-react';

export default function BibleSettings() {
    const { user, userData } = useAuth();
    const [newItemName, setNewItemName] = useState('');
    const [newItemUrl, setNewItemUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const customSources = userData?.customBibleSources || [];

    const handleAddSource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim() || !newItemUrl.trim() || !user) return;

        setIsAdding(true);
        setError(null);

        try {
            // 1. Verify URL works first
            try {
                const res = await fetch(newItemUrl);
                if (!res.ok) throw new Error('Failed to fetch URL');
                const json = await res.json();
                if (!Array.isArray(json)) throw new Error('Invalid JSON format (Must be array of books)');
            } catch (validationErr) {
                throw new Error('Invalid Source URL: Verify it points to a valid JSON Bible.');
            }

            // 2. Add to Firestore
            const newSource = { name: newItemName.trim(), url: newItemUrl.trim() };
            const userRef = doc(db, 'users', user.uid);

            await updateDoc(userRef, {
                customBibleSources: arrayUnion(newSource)
            });

            // 3. Clear form
            setNewItemName('');
            setNewItemUrl('');

            // Note: Context will auto-update bibleSearchService via useEffect in BibleContext

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to add source');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveSource = async (source: any) => {
        if (!user || !confirm(`Remove ${source.name}?`)) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                customBibleSources: arrayRemove(source)
            });
        } catch (err) {
            console.error('Failed to remove source', err);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Custom Bible Sources
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Add your own Bible translations by providing a link to a compatible JSON source.
                    These will be downloaded and indexed locally on your device.
                </p>

                {/* List */}
                <div className="space-y-3 mb-6">
                    {customSources.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700">
                            <p className="text-sm text-gray-500">No custom sources added yet.</p>
                        </div>
                    )}

                    {customSources.map((source: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700 group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{source.name}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-[200px] md:max-w-md">{source.url}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemoveSource(source)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove Source"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add Form */}
                <form onSubmit={handleAddSource} className="bg-gray-50 dark:bg-zinc-800/30 p-4 rounded-lg border border-gray-200 dark:border-zinc-800">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add New Source</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <input
                            type="text"
                            placeholder="Version Name (e.g. My Translation)"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                            disabled={isAdding}
                        />
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="url"
                                placeholder="https://example.com/bible.json"
                                value={newItemUrl}
                                onChange={(e) => setNewItemUrl(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                disabled={isAdding}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs mb-3 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isAdding || !newItemName || !newItemUrl}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add Source
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
