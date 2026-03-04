'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, Upload, AlertCircle, Loader2, Search, MonitorPlay, ArrowLeft, BookMarked, Check, Heart } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { safeTimestamp } from '@/lib/utils';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import DocumentUploadModal from '@/components/Pulpit/DocumentUploadModal';
import { LifeEventsCard } from '@/components/Admin/PeopleHub/LifeEventsCard';
import { LifeEvent } from '@/types';
import {
    ServiceVersesService,
    SessionKey,
    ServiceVersesData,
    SERVICE_VERSE_LABELS,
    SERVICE_VERSE_COLORS,
    DEFAULT_SERVICE_VERSES_DATA,
} from '@/lib/services/ServiceVersesService';

interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: any;
}

const SESSION_KEYS: SessionKey[] = ['sundayService', 'sermon', 'bibleStudy', 'sundaySchool'];

export default function PastorCarePage() {
    const { userData, user, loading } = useAuth();
    const router = useRouter();
    const [notes, setNotes] = useState<Note[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [notesLoading, setNotesLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    // Life Events
    const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);
    const [lifeEventsLoading, setLifeEventsLoading] = useState(true);

    // Service Verses
    const [serviceVerses, setServiceVerses] = useState<ServiceVersesData>(DEFAULT_SERVICE_VERSES_DATA);
    const [versesTab, setVersesTab] = useState<SessionKey>('sundayService');
    const [verseInput, setVerseInput] = useState<Record<SessionKey, string>>({
        sundayService: '',
        sermon: '',
        bibleStudy: '',
        sundaySchool: '',
    });
    const [versesSaving, setVersesSaving] = useState(false);
    const [versesSaved, setVersesSaved] = useState(false);

    // Notes subscription
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

    // Life Events subscription — mirrors the Life Events page (no compound query, filter client-side)
    useEffect(() => {
        if (!userData?.churchId) return;
        const unsub = onSnapshot(collection(db, 'lifeEvents'), (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as LifeEvent));
            setLifeEvents(all.filter(e => e.isActive));
            setLifeEventsLoading(false);
        }, (err) => {
            console.error('[PastorCare] Life events error:', err);
            setLifeEventsLoading(false);
        });
        return () => unsub();
    }, [userData?.churchId]);

    // Service Verses — load existing on mount
    useEffect(() => {
        if (!userData?.churchId) return;
        ServiceVersesService.get(userData.churchId).then((data) => {
            setServiceVerses(data);
            setVerseInput({
                sundayService: data.sundayService.verses.join('\n'),
                sermon: data.sermon.verses.join('\n'),
                bibleStudy: data.bibleStudy.verses.join('\n'),
                sundaySchool: data.sundaySchool.verses.join('\n'),
            });
        });
    }, [userData?.churchId]);

    const handleSaveVerses = async () => {
        if (!userData?.churchId || !user) return;
        setVersesSaving(true);

        const parseVerses = (raw: string) =>
            raw.split('\n').map(v => v.trim()).filter(Boolean);

        const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

        const updated: ServiceVersesData = {
            sundayService: {
                enabled: serviceVerses.sundayService.enabled,
                verses: parseVerses(verseInput.sundayService),
                expiresAt,
            },
            sermon: {
                enabled: serviceVerses.sermon.enabled,
                verses: parseVerses(verseInput.sermon),
                expiresAt,
            },
            bibleStudy: {
                enabled: serviceVerses.bibleStudy.enabled,
                verses: parseVerses(verseInput.bibleStudy),
                expiresAt,
            },
            sundaySchool: {
                enabled: serviceVerses.sundaySchool.enabled,
                verses: parseVerses(verseInput.sundaySchool),
                expiresAt,
            },
        };

        await ServiceVersesService.save(userData.churchId, user.uid, updated);
        setServiceVerses(updated);
        setVersesSaving(false);
        setVersesSaved(true);
        setTimeout(() => setVersesSaved(false), 2000);
    };

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
                    {/* Main Workspace */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Select Sermon Note */}
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

                        {/* Service Verses */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center">
                                <BookMarked className="w-5 h-5 mr-2 text-indigo-600" />
                                Service Verses
                            </h2>
                            <p className="text-sm text-gray-500 mb-5">
                                Enter verses for today's service. They'll appear as tab groups in every member's Bible — active for 24 hours after saving.
                            </p>

                            {/* Session tabs */}
                            <div className="flex gap-1 mb-5 border border-gray-200 rounded-lg p-1 bg-gray-50">
                                {SESSION_KEYS.map((key) => (
                                    <button
                                        key={key}
                                        onClick={() => setVersesTab(key)}
                                        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                            versesTab === key
                                                ? 'bg-white shadow-sm text-gray-900'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {SERVICE_VERSE_LABELS[key]}
                                    </button>
                                ))}
                            </div>

                            {/* Active session panel */}
                            {SESSION_KEYS.map((key) => (
                                <div key={key} className={versesTab === key ? 'block' : 'hidden'}>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-medium text-gray-700">
                                            Verses
                                        </label>
                                        {/* Enabled toggle */}
                                        <button
                                            onClick={() =>
                                                setServiceVerses(prev => ({
                                                    ...prev,
                                                    [key]: { ...prev[key], enabled: !prev[key].enabled },
                                                }))
                                            }
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                serviceVerses[key].enabled ? 'bg-indigo-600' : 'bg-gray-200'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                                    serviceVerses[key].enabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                    <textarea
                                        rows={5}
                                        placeholder={"e.g.\nJohn 3:16\nRomans 8:28-29\n1 Corinthians 13"}
                                        value={verseInput[key]}
                                        onChange={(e) =>
                                            setVerseInput(prev => ({ ...prev, [key]: e.target.value }))
                                        }
                                        disabled={!serviceVerses[key].enabled}
                                        className={`w-full px-3 py-2 text-sm border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none ${
                                            serviceVerses[key].enabled
                                                ? 'bg-white border-gray-200 text-gray-900'
                                                : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                    />
                                    <p className="text-xs text-gray-400 mt-1.5">
                                        One reference per line · e.g. John 3:16 &nbsp;·&nbsp; Romans 8:28-29 &nbsp;·&nbsp; 1 Corinthians 13
                                    </p>
                                </div>
                            ))}

                            {/* Save button */}
                            <div className="mt-5 flex justify-end">
                                <button
                                    onClick={handleSaveVerses}
                                    disabled={versesSaving}
                                    className={`flex items-center px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95 ${
                                        versesSaved
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                    }`}
                                >
                                    {versesSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : versesSaved ? (
                                        <Check className="w-4 h-4 mr-2" />
                                    ) : (
                                        <BookMarked className="w-4 h-4 mr-2" />
                                    )}
                                    {versesSaved ? 'Saved!' : versesSaving ? 'Saving…' : 'Save Verses'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar / Quick Actions */}
                    <div className="space-y-6">
                        {/* Life Events */}
                        <LifeEventsCard events={lifeEvents} loading={lifeEventsLoading} />

                        {/* Quick Links */}
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
