'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Church } from '@/types';
import { Search, MapPin, Check, QrCode } from 'lucide-react';

interface ChurchPickerProps {
    onSelect: (churchId: string) => void;
    selectedId?: string;
}

export function ChurchPicker({ onSelect, selectedId }: ChurchPickerProps) {
    const [churches, setChurches] = useState<Church[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchChurches = async () => {
            try {
                const q = query(collection(db, 'churches'));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        name: data.name || (doc.id === 'default_church' ? 'Bethel Metropolitan' : 'Unnamed Church'),
                        subdomain: data.subdomain || (doc.id === 'default_church' ? 'bethel-metro' : 'unknown')
                    } as Church;
                }).sort((a, b) => a.name.localeCompare(b.name));
                setChurches(list);
            } catch (error) {
                console.error('Error fetching churches:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchChurches();
    }, []);

    const filteredChurches = churches.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by church name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-700">
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
                        ))}
                    </div>
                ) : filteredChurches.length > 0 ? (
                    filteredChurches.map((church) => (
                        <button
                            key={church.id}
                            onClick={() => onSelect(church.id)}
                            className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all text-left group ${selectedId === church.id
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                                : 'border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                                }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                {church.theme?.logoUrl ? (
                                    <img src={church.theme.logoUrl} alt={church.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <MapPin className="w-5 h-5 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                    {church.name}
                                </h4>
                            </div>
                            {selectedId === church.id && (
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                    <Check className="w-4 h-4" />
                                </div>
                            )}
                        </button>
                    ))
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No churches found</p>
                    </div>
                )}
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                <button
                    onClick={() => alert('QR scanner coming soon!')}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 transition-all text-sm font-medium"
                >
                    <QrCode className="w-4 h-4" />
                    Scan Church QR Code
                </button>
            </div>
        </div>
    );
}
