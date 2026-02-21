'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoadmapService } from '@/lib/services/RoadmapService';
import { Ministry, MinistryRoadmap } from '@/types';
import { toast } from 'sonner';
import { Map, Loader2, Calendar, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CreateRoadmapModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry: Ministry;
    roadmapToEdit?: MinistryRoadmap;
}

export function CreateRoadmapModal({
    isOpen,
    onClose,
    ministry,
    roadmapToEdit
}: CreateRoadmapModalProps) {
    const { user, userData } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [targetEndDate, setTargetEndDate] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (roadmapToEdit) {
                setTitle(roadmapToEdit.title);
                setDescription(roadmapToEdit.description || '');

                // Safe date extraction
                const extractDate = (val: any): string => {
                    if (!val) return '';
                    let d: Date | null = null;
                    if (val instanceof Date) d = val;
                    else if (val?.toDate) d = val.toDate();
                    else if (val?.seconds) d = new Date(val.seconds * 1000);
                    else if (typeof val === 'string') d = parseISO(val);
                    return d ? format(d, 'yyyy-MM-dd') : '';
                };

                setStartDate(extractDate(roadmapToEdit.startDate));
                setTargetEndDate(extractDate(roadmapToEdit.targetEndDate));
            } else {
                // Reset for new
                setTitle('');
                setDescription('');
                setStartDate(format(new Date(), 'yyyy-MM-dd'));
                setTargetEndDate('');
            }
        }
    }, [isOpen, roadmapToEdit]);

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Please enter a roadmap title');
            return;
        }
        // Use user.uid (Firebase Auth) as primary, fallback to userData.uid
        const userId = user?.uid || userData?.uid;
        const userName = userData?.displayName || user?.displayName || 'Unknown';

        if (!userId) {
            toast.error('You must be logged in');
            return;
        }

        setIsSubmitting(true);
        try {
            const roadmapData = {
                ministryId: ministry.id,
                churchId: ministry.churchId,
                title: title.trim(),
                ...(description.trim() && { description: description.trim() }),
                ...(startDate && { startDate: parseISO(`${startDate}T12:00:00`) }),
                ...(targetEndDate && { targetEndDate: parseISO(`${targetEndDate}T12:00:00`) }),
                status: 'active' as const,
                createdBy: userId,
                createdByName: userName
            };

            if (roadmapToEdit) {
                await RoadmapService.updateRoadmap(roadmapToEdit.id, {
                    title: roadmapData.title,
                    ...(description.trim() && { description: description.trim() }),
                    ...(startDate && { startDate: parseISO(`${startDate}T12:00:00`) }),
                    ...(targetEndDate && { targetEndDate: parseISO(`${targetEndDate}T12:00:00`) }),
                });
                toast.success('Roadmap updated');
            } else {
                await RoadmapService.createRoadmap(roadmapData);
                toast.success('Roadmap created');
            }

            onClose();
        } catch (error) {
            console.error('Error saving roadmap:', error);
            toast.error('Failed to save roadmap');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditing = !!roadmapToEdit;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Map className="w-5 h-5 text-indigo-500" />
                        {isEditing ? 'Edit Roadmap' : 'Create Roadmap'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-5">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 -mt-2">
                        {isEditing
                            ? 'Update your ministry roadmap details.'
                            : 'Create a strategic roadmap to plan and track your ministry goals.'
                        }
                    </p>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Roadmap Title *
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 2026 Ministry Vision"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Description
                        </label>
                        <textarea
                            placeholder="Describe the goals and vision for this roadmap..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-y max-h-48"
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Target End Date
                            </label>
                            <input
                                type="date"
                                value={targetEndDate}
                                onChange={(e) => setTargetEndDate(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Roadmap'}
                    </button>
                </div>
            </div>
        </div>
    );
}
