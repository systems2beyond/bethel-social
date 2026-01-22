'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, PlayCircle, Edit2, Trash2 } from 'lucide-react';
import DriveFolderSettings from './DriveFolderSettings';
import Link from 'next/link';

interface Sermon {
    id: string;
    title: string;
    date: string;
    source?: 'upload' | 'youtube';
    description?: string;
    videoUrl?: string; // or driveFileId ?
}

export default function SermonManager() {
    const [sermons, setSermons] = useState<Sermon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'sermons'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSermons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sermon)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this sermon?')) return;
        try {
            await deleteDoc(doc(db, 'sermons', id));
        } catch (error) {
            console.error(error);
            alert('Failed to delete sermon');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content: Sermon List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center">
                            <PlayCircle className="w-5 h-5 mr-2 text-gray-500" />
                            Manage Sermons
                        </h2>
                        {/* Maybe add "Create New" link here mapping to /sermons? or keep it on public page? */}
                        <Link href="/sermons" className="text-sm text-blue-600 hover:underline">
                            Go to Sermons Page
                        </Link>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {loading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                        ) : sermons.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No sermons found.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {sermons.map((sermon) => (
                                            <tr key={sermon.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="font-medium text-gray-900">{sermon.title}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {sermon.date}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                                                    {sermon.source || 'youtube'}
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            alert('Edit specific details (Highlights/Overview) - TODO');
                                                        }}
                                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Edit Details"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(sermon.id)}
                                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Settings */}
                <div className="space-y-6">
                    <DriveFolderSettings />
                </div>
            </div>
        </div>
    );
}
