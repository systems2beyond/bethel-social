'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '@/context/AuthContext';
import { createPipelineBoard } from '@/lib/pipeline-boards';
import { EventsService } from '@/lib/services/EventsService';
import { Event } from '@/types';
import { X, Loader2, Layout, Calendar, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

interface CreateBoardModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (boardId: string) => void;
}

const BOARD_TYPES = [
    { id: 'sunday_service', label: 'Sunday Service', icon: Layout, description: 'Track weekly visitors and follow-ups.' },
    { id: 'event', label: 'Event', icon: Calendar, description: 'Manage registrations for specific church events.' },
    { id: 'custom', label: 'Custom', icon: Briefcase, description: 'Create a generic pipeline for any purpose.' }
] as const;

export default function CreateBoardModal({ open, onOpenChange, onSuccess }: CreateBoardModalProps) {
    const { user, userData } = useAuth();
    const [name, setName] = useState('');
    const [type, setType] = useState<typeof BOARD_TYPES[number]['id']>('sunday_service');
    const [loading, setLoading] = useState(false);

    // Event Selection State
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [loadingEvents, setLoadingEvents] = useState(false);

    // Fetch events when type is 'event'
    React.useEffect(() => {
        if (type === 'event' && events.length === 0) {
            setLoadingEvents(true);
            // Ensure we fetch events scoped to the current church if available
            // Assuming EventsService handles scoping internally or via argument
            // Based on service definition: getAllEvents(includeDrafts, churchId)
            const churchId = userData?.churchId || 'bethel-metro'; // Fallback to default for now

            EventsService.getAllEvents(true, churchId)
                .then(data => {
                    // Filter for future events only
                    const now = new Date();
                    now.setHours(0, 0, 0, 0); // Include events happening today

                    const activeEvents = data.filter(e => {
                        if (!e.startDate) return false;
                        // Handle Firestore Timestamp
                        const eventDate = (e.startDate as any).seconds
                            ? new Date((e.startDate as any).seconds * 1000)
                            : new Date(e.startDate as any);

                        return eventDate >= now;
                    });
                    setEvents(activeEvents);
                })
                .catch(err => console.error('Failed to load events', err))
                .finally(() => setLoadingEvents(false));
        }
    }, [type, events.length, userData?.churchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;

        setLoading(true);
        try {
            const boardId = await createPipelineBoard(
                name.trim(),
                type,
                undefined, // Use default stages
                user.uid,
                type === 'event' ? selectedEventId : undefined
            );

            toast.success('Board created successfully');
            onSuccess?.(boardId);
            onOpenChange(false);
            setName('');
            setType('sunday_service');
            setSelectedEventId('');
        } catch (error) {
            console.error('Error creating board:', error);
            toast.error('Failed to create board');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
                <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50 w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 p-6 animate-in zoom-in-95 fade-in slide-in-from-bottom-10">
                    <div className="flex justify-between items-center mb-6">
                        <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                            Create New Board
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Configure a new tracking board for your ministry or events.
                    </Dialog.Description>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Type Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Board Type
                            </label>
                            <div className="grid gap-3">
                                {BOARD_TYPES.map((t) => {
                                    const Icon = t.icon;
                                    const isSelected = type === t.id;
                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => setType(t.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                                ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-700'
                                                : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-200' : 'bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-gray-400'
                                                }`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <div className={`text-sm font-medium ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}`}>
                                                    {t.label}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {t.description}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Event Selector (Conditional) */}
                        {type === 'event' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2">
                                <label htmlFor="eventSelect" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Link to Event
                                </label>
                                <select
                                    id="eventSelect"
                                    value={selectedEventId}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setSelectedEventId(id);
                                        const event = events.find(ev => ev.id === id);
                                        if (event) setName(event.title);
                                    }}
                                    required={type === 'event'}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select an event...</option>
                                    {loadingEvents ? (
                                        <option disabled>Loading events...</option>
                                    ) : (
                                        events.map(event => (
                                            <option key={event.id} value={event.id}>
                                                {event.title} ({event.startDate?.seconds ? new Date(event.startDate.seconds * 1000).toLocaleDateString() : 'Date TBD'})
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-500">
                                    RSVPs will automatically populate this board.
                                </p>
                            </div>
                        )}

                        {/* Name Input (Moved Below) */}
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <label htmlFor="boardName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Board Name
                            </label>
                            <input
                                id="boardName"
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Youth Ministry Outreach"
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            </Dialog.Close>
                            <button
                                type="submit"
                                disabled={loading || !name.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Create Board
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root >
    );
}
