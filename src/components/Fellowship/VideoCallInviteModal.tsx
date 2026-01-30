'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, Video, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

import { useAuth } from '@/context/AuthContext';

interface VideoCallInviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentParticipants: { uid: string; displayName: string; photoURL?: string }[];
    onSendInvite: (participants: string[], meetLink: string) => void;
}

export function VideoCallInviteModal({ isOpen, onClose, currentParticipants, onSendInvite }: VideoCallInviteModalProps) {
    const { googleAccessToken, signInWithGoogle } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isSearching, setIsSearching] = useState(false);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);

    // Initialize with current participants (except self, but caller should handle that)
    useEffect(() => {
        if (isOpen) {
            const initialIds = new Set(currentParticipants.map(p => p.uid));
            setSelectedUserIds(initialIds);
        }
    }, [isOpen, currentParticipants]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const q = query(collection(db, 'users'), limit(10));
                const snap = await getDocs(q);
                let results = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

                const lowerQ = searchQuery.toLowerCase();
                results = results.filter((u: any) =>
                    (u.displayName?.toLowerCase().includes(lowerQ) || u.email?.toLowerCase().includes(lowerQ)) &&
                    !currentParticipants.some(cp => cp.uid === u.uid)
                );

                setSearchResults(results);
            } catch (error) {
                console.error("Search failed", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, currentParticipants]);

    const toggleUser = (uid: string) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    };

    const handleSend = async () => {
        if (!googleAccessToken) {
            return; // Should be handled by UI state, but safety guard
        }

        setIsGeneratingLink(true);
        try {
            // Create an instant meeting event
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour default

            const eventBody = {
                summary: 'Video Call Invitation',
                description: 'Instant video call invite from Bethel Social.',
                start: { dateTime: startTime.toISOString() },
                end: { dateTime: endTime.toISOString() },
                conferenceData: {
                    createRequest: {
                        requestId: Math.random().toString(36).substring(7),
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            };

            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Failed to create meeting:", errorData);
                if (response.status === 401 || response.status === 403) {
                    alert("Google Calendar permission needed. Please re-authorize.");
                    signInWithGoogle();
                } else {
                    alert("Failed to create Google Meet link. Please try again.");
                }
                return;
            }

            const data = await response.json();
            const meetLink = data.hangoutLink;

            if (meetLink) {
                onSendInvite(Array.from(selectedUserIds), meetLink);
                onClose();
            } else {
                alert("Could not generate a Google Meet link.");
            }
        } catch (error) {
            console.error("Error creating meeting:", error);
            alert("An error occurred while creating the meeting.");
        } finally {
            setIsGeneratingLink(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                >
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Video className="w-6 h-6 text-blue-500" />
                                Video Call Invite
                            </h2>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Participants</label>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {currentParticipants.map(u => (
                                        <div key={u.uid} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-900/30">
                                            {u.displayName}
                                        </div>
                                    ))}
                                    {searchResults.filter(u => selectedUserIds.has(u.uid)).map(u => (
                                        <div key={u.uid} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-medium border border-indigo-100 dark:border-indigo-900/30">
                                            {u.displayName}
                                            <button onClick={() => toggleUser(u.uid)}><X className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Add more people..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {isSearching ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="space-y-1">
                                        {searchResults.map(u => (
                                            <button
                                                key={u.uid}
                                                onClick={() => toggleUser(u.uid)}
                                                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all text-left"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden shrink-0">
                                                    {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 text-xs">{u.displayName?.[0]}</div>}
                                                </div>
                                                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{u.displayName}</span>
                                                {selectedUserIds.has(u.uid) ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <UserPlus className="w-4 h-4 text-gray-400" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : searchQuery && !isSearching && (
                                    <p className="text-center py-4 text-sm text-gray-500">No users found</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col gap-3">
                            {!googleAccessToken && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl mb-2">
                                    <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                                        Google Calendar access is required to generate a valid meeting link.
                                    </p>
                                    <button
                                        onClick={() => signInWithGoogle()}
                                        className="w-full py-2 bg-amber-100 dark:bg-amber-800 hover:bg-amber-200 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 text-xs font-bold rounded-lg transition-colors"
                                    >
                                        Authorize Google Calendar
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 rounded-2xl font-bold bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={selectedUserIds.size === 0 || !googleAccessToken || isGeneratingLink}
                                    className="flex-[2] px-4 py-3 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {isGeneratingLink ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating Link...
                                        </>
                                    ) : (
                                        'Start Video Call'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
