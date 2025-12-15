'use client';

import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { X, Calendar, Loader2, Check, Video, Clock, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTopic?: string;
    initialDate?: string; // ISO string or similar
}

export default function CreateMeetingModal({ isOpen, onClose, initialTopic = '', initialDate }: CreateMeetingModalProps) {
    const [topic, setTopic] = useState(initialTopic);
    const [startTime, setStartTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [successLink, setSuccessLink] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setTopic(initialTopic);
            // Format initialDate to datetime-local friendly string (YYYY-MM-DDThh:mm)
            if (initialDate) {
                try {
                    const d = new Date(initialDate);
                    // Handle offset manually or use simple slice if UTC not confusing
                    // For now simplicity: local time
                    const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    setStartTime(localIso);
                } catch (e) {
                    setStartTime(new Date().toISOString().slice(0, 16));
                }
            } else {
                setStartTime(new Date().toISOString().slice(0, 16));
            }
            setSuccessLink(null);
            setError('');
        }
    }, [isOpen, initialTopic, initialDate]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const createMeetingFn = httpsCallable(functions, 'createMeeting');
            const result: any = await createMeetingFn({
                topic,
                startTime: new Date(startTime).toISOString()
            });

            const { meetLink } = result.data;
            setSuccessLink(meetLink);
        } catch (err: any) {
            console.error('Meeting Create Error:', err);
            setError(err.message || 'Failed to create meeting. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-zinc-800"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Video className="w-5 h-5 text-blue-600" />
                        Schedule Meeting
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6">
                    {successLink ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Meeting Created!</h4>
                            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                                Your Google Meet link is ready.
                            </p>

                            <a
                                href={successLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors mb-3"
                            >
                                Join Meeting Now
                            </a>
                            <button
                                onClick={onClose}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <Type className="w-3.5 h-3.5" /> Topic
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="e.g. Weekly Fellowship"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" /> Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:[color-scheme:dark]"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Scheduling...
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="w-5 h-5" />
                                            Schedule Meeting
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
