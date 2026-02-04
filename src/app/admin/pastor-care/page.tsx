'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, Upload, AlertCircle, Loader2, Search, MonitorPlay, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { safeTimestamp } from '@/lib/utils';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import DocumentUploadModal from '@/components/Pulpit/DocumentUploadModal';

interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: any;
}

export default function PastorCarePage() {
    const { userData, user, loading } = useAuth();
    const router = useRouter();
    const [notes, setNotes] = useState<Note[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [notesLoading, setNotesLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'users', user.uid, 'notes'),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Note[];
            setNotes(notesData);
            setNotesLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center p-4">
                <Loader2 className="animate-spin text-gray-500" />
            </div>
        );
    }

    // RBAC: strictly Pastor Admin, Media Admin, or Super Admin
    if (!userData || (userData.role !== 'pastor_admin' && userData.role !== 'media_admin' && userData.role !== 'super_admin' && userData.role !== 'admin')) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">You do not have permission to view the Pastor Care Dashboard.</p>
                <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Return Home
                </Link>
            </div>
        );
    }

    const filteredNotes = notes.filter(note =>
        (note.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header>
                    <Link href="/admin" className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors mb-4 px-3 py-1.5 rounded-lg hover:bg-gray-100 -ml-3">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Pastor Care & Sermon Prep</h1>
                    <p className="text-gray-500 mt-2">Tools for sermon preparation, member care, and pulpit management.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Workspace - Select Note for Pulpit */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                                Select Sermon Note
                            </h2>
                            <p className="text-sm text-gray-500 mb-6">
                                Select a note to launch directly into the Pulpit Teleprompter.
                            </p>

                            {/* Search */}
                            <div className="relative mb-6">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search notes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder:text-gray-500"
                                />
                            </div>

                            {/* Notes List */}
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                {notesLoading ? (
                                    <div className="text-center py-10">
                                        <Loader2 className="animate-spin w-6 h-6 text-indigo-500 mx-auto" />
                                    </div>
                                ) : filteredNotes.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        No notes found. Create one in the <Link href="/notes" className="text-indigo-600 font-medium hover:underline">Notes App</Link>.
                                    </div>
                                ) : (
                                    filteredNotes.map(note => (
                                        <div key={note.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 hover:bg-white rounded-xl border border-transparent hover:border-indigo-100 hover:shadow-md transition-all group">
                                            <div className="mb-3 sm:mb-0">
                                                <h3 className="font-semibold text-gray-900">{note.title || 'Untitled Note'}</h3>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                                    {note.content ? note.content.substring(0, 60).replace(/<[^>]*>?/gm, "") : 'No content'}...
                                                </p>
                                                <span className="text-xs text-gray-500 mt-2 block font-medium">
                                                    Updated: {(() => {
                                                        const d = safeTimestamp(note.updatedAt);
                                                        return d ? d.toLocaleDateString() : 'Recently';
                                                    })()}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => router.push(`/pulpit?noteId=${note.id}`)}
                                                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm active:scale-95 transition-all"
                                            >
                                                <MonitorPlay className="w-4 h-4 mr-2" />
                                                Launch
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar / Quick Actions */}
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
                                <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
                                Quick Links
                            </h2>
                            <div className="space-y-2">
                                <Link
                                    href="/pulpit"
                                    className="flex items-center p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors group"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-blue-200 flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
                                        <FileText className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold">Launch Pulpit View</div>
                                        <div className="text-[11px] opacity-75 font-medium">Start Sunday Service HUD</div>
                                    </div>
                                </Link>
                                <Link
                                    href="/notes"
                                    className="flex items-center p-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors group"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-purple-200 flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
                                        <FileText className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold">Manage Notes</div>
                                        <div className="text-[11px] opacity-75 font-medium">Create & Edit Sermons</div>
                                    </div>
                                </Link>
                                {/* Future links: Visitation Logs, Counseling Notes */}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-2xl shadow-sm text-white">
                            <h3 className="font-bold text-lg mb-2">Need a formatted manuscript?</h3>
                            <p className="text-indigo-100 text-sm mb-4">
                                Upload your existing Word document or PDF to automatically extract text while preserving your bolding and highlights.
                            </p>
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="w-full py-2 bg-white/20 rounded-lg text-sm font-medium border border-white/40 flex items-center justify-center hover:bg-white/30 transition-all font-bold"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Document
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <DocumentUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSuccess={() => {
                    // onSnapshot automatically updates the list
                }}
            />
        </div>
    );
}
