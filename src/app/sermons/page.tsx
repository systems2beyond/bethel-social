'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Sermon } from '@/types';
import Link from 'next/link';
import { Calendar, PlayCircle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

import { AnimatePresence } from 'framer-motion';
import SermonModal from '@/components/Sermons/SermonModal';
import { useAuth } from '@/context/AuthContext';

export default function SermonsPage() {
    const { userData } = useAuth();
    const [sermons, setSermons] = useState<Sermon[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSermon, setSelectedSermon] = useState<Sermon | null>(null);
    const [modalMode, setModalMode] = useState<'watch' | 'ai'>('watch');

    useEffect(() => {
        const fetchSermons = async () => {
            try {
                const q = query(collection(db, 'sermons'), orderBy('date', 'desc'));
                const snapshot = await getDocs(q);
                const fetchedSermons = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Sermon[];
                setSermons(fetchedSermons);
            } catch (error) {
                console.error('Error fetching sermons:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSermons();
    }, []);

    const openSermon = (sermon: Sermon, mode: 'watch' | 'ai') => {
        setSelectedSermon(sermon);
        setModalMode(mode);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sermons</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sermons.map((sermon) => {
                    // Extract Bible References from outline
                    const bibleRefs = sermon.outline?.flatMap(point => {
                        const matches = point.match(/([1-9]?[A-Za-z]+\s\d+:\d+(-\d+)?)/g);
                        return matches || [];
                    }).slice(0, 2) || []; // Limit to 2 refs for card

                    // Get Highlights (first 2 points)
                    const highlights = sermon.outline?.slice(0, 2) || [];

                    return (
                        <div key={sermon.id} className="group bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:shadow-md border border-gray-100 dark:border-zinc-800 overflow-hidden transition-all duration-200 h-full flex flex-col">
                            <div onClick={() => openSermon(sermon, 'watch')} className="block relative aspect-video bg-gray-200 dark:bg-zinc-800 cursor-pointer">
                                {sermon.thumbnailUrl ? (
                                    <img
                                        src={sermon.thumbnailUrl}
                                        alt={sermon.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                                        <PlayCircle className="w-12 h-12 text-white opacity-80" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                    <PlayCircle className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                                {/* Date Badge */}
                                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {sermon.date ? (
                                        typeof sermon.date === 'string'
                                            ? format(new Date(sermon.date), 'MMM d, yyyy')
                                            : format(new Date(sermon.date.seconds * 1000), 'MMM d, yyyy')
                                    ) : 'Unknown'}
                                </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col">
                                <div onClick={() => openSermon(sermon, 'watch')} className="block cursor-pointer">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {sermon.title}
                                    </h3>
                                </div>

                                {/* Bible Refs Badges */}
                                {bibleRefs.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {bibleRefs.map((ref, i) => (
                                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                {ref}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {sermon.summary && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
                                        {sermon.summary}
                                    </p>
                                )}

                                {/* Highlights / Takeaways */}
                                {highlights.length > 0 && (
                                    <div className="mb-4 space-y-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Highlights</p>
                                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                            {highlights.map((point, i) => (
                                                <li key={i} className="line-clamp-1 flex items-start">
                                                    <span className="mr-1.5 text-blue-500">•</span>
                                                    {point.replace(/^\d+\.\s*/, '')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="mt-auto pt-3 border-t border-gray-100 dark:border-zinc-800 flex gap-2">
                                    <button
                                        onClick={() => openSermon(sermon, 'watch')}
                                        className="w-full py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-md border border-blue-500/20 dark:border-blue-500/30 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 rounded-lg transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 group-hover:border-blue-500/40"
                                    >
                                        <PlayCircle className="w-4 h-4" />
                                        <span>Watch & Study</span>
                                        <Sparkles className="w-3.5 h-3.5 opacity-70" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {sermons.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No sermons found.
                </div>
            )}

            <AnimatePresence>
                {selectedSermon && (
                    <SermonModal
                        sermon={selectedSermon}
                        initialMode={modalMode}
                        onClose={() => setSelectedSermon(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
