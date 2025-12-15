'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Video, FileText, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db, functions } from '@/lib/firebase'; // Assuming functions is accessible
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Meeting } from '@/types';

interface MeetingSchedulerProps {
    onClose: () => void;
    onScheduled: (meeting: Meeting) => void;
}

export default function MeetingScheduler({ onClose, onScheduled }: MeetingSchedulerProps) {
    const { user, userData } = useAuth();
    const [topic, setTopic] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState('60');
    const [type, setType] = useState<Meeting['type']>('general');
    const [isLoading, setIsLoading] = useState(false);

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isLoading) return;

        setIsLoading(true);
        try {
            // calculated start time
            const startDateTime = new Date(`${date}T${time}`);
            const timestamp = startDateTime.getTime();

            // 1. Create Google Meet Link (via Backend Function)
            // we will implement the actual meet link generation in the cloud function later
            // for now, we'll placeholder it or call a 'createMeeting' function
            const createMeetingFn = httpsCallable(functions, 'createMeeting');
            const result = await createMeetingFn({
                topic,
                startTime: startDateTime.toISOString(),
                requestId: Math.random().toString(36).substring(7) // Idempotency
            }) as any;

            const meetLink = result.data?.meetLink || '';

            // 2. Save to Firestore
            const meetingData: Omit<Meeting, 'id'> = {
                hostId: user.uid,
                hostName: userData?.displayName || user.displayName || 'Host',
                topic,
                description,
                type,
                startTime: timestamp,
                durationMinutes: parseInt(duration),
                meetLink, // From Google API
                participants: [user.uid],
                files: [],
                createdAt: Date.now() // client-side approx
            };

            const docRef = await addDoc(collection(db, 'meetings'), {
                ...meetingData,
                createdAt: serverTimestamp()
            });

            onScheduled({ id: docRef.id, ...meetingData } as Meeting);
            onClose();

        } catch (error) {
            console.error('Error scheduling meeting:', error);
            alert('Failed to schedule meeting. See console.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-zinc-800">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Video className="w-5 h-5" />
                        <h2 className="font-semibold">Schedule Meeting</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSchedule} className="p-6 space-y-4">

                    {/* Topic */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Topic</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Bible Study: Romans 8"
                            className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Meeting Type</label>
                        <div className="flex gap-2">
                            {(['bible-study', 'fellowship', 'prayer', 'general'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${type === t
                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                        }`}
                                >
                                    {t.replace('-', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Time</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Duration (minutes)</label>
                        <select
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="15">15 mins</option>
                            <option value="30">30 mins</option>
                            <option value="60">1 hour</option>
                            <option value="90">1.5 hours</option>
                            <option value="120">2 hours</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add details about the meeting..."
                            rows={3}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Action */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Scheduling...
                            </>
                        ) : (
                            <>
                                <Video className="w-4 h-4" />
                                Schedule with Google Meet
                            </>
                        )}
                    </button>

                </form>
            </div>
        </div>
    );
}
