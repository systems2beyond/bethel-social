'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Search, Scroll, Loader2, Check } from 'lucide-react';

interface Resource {
    id: string;
    title: string;
    type: 'scroll' | 'sermon';
    updatedAt?: any;
}

interface ResourcePickerProps {
    onSelect: (resource: Resource) => void;
    onCancel: () => void;
}

export default function ResourcePicker({ onSelect, onCancel }: ResourcePickerProps) {
    const { user } = useAuth();
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchResources = async () => {
            if (!user) return;
            try {
                // Fetch Notes (Scrolls)
                const notesRef = collection(db, 'users', user.uid, 'notes');
                const q = query(notesRef, orderBy('updatedAt', 'desc'));
                const snapshot = await getDocs(q);

                const items: Resource[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    title: doc.data().title || 'Untitled Scroll',
                    type: 'scroll',
                    updatedAt: doc.data().updatedAt
                }));

                setResources(items);
            } catch (error) {
                console.error("Error fetching resources:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResources();
    }, [user]);

    const filtered = resources.filter(r =>
        (r.title || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search your scrolls..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                    autoFocus
                />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">No scrolls found.</p>
                    </div>
                ) : (
                    filtered.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item)}
                            className="w-full flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 hover:bg-blue-50 dark:hover:bg-blue-900/10 border border-gray-100 dark:border-zinc-800 rounded-xl transition-colors text-left group"
                        >
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                                <Scroll className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {item.title}
                                </h4>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                    Last updated: {item.updatedAt?.toDate ? item.updatedAt.toDate().toLocaleDateString() : 'Recently'}
                                </p>
                            </div>
                            <Check className="w-4 h-4 text-transparent group-hover:text-blue-500 transition-colors" />
                        </button>
                    ))
                )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-zinc-800">
                <button
                    onClick={onCancel}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
