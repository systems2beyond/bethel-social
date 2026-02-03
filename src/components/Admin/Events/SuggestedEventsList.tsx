'use client';

import React, { useEffect, useState } from 'react';
import { EventsService } from '@/lib/services/EventsService';
import { SuggestedEvent } from '@/types';
import { Loader2, Calendar, MapPin, Check, X, Sparkles, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function SuggestedEventsList() {
    const { userData, loading: authLoading } = useAuth();
    const [suggestions, setSuggestions] = useState<SuggestedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && userData?.churchId) {
            loadSuggestions();
        }
    }, [authLoading, userData]);

    const loadSuggestions = async () => {
        try {
            setLoading(true);
            const data = await EventsService.getSuggestedEvents(userData?.churchId);
            setSuggestions(data);
        } catch (error) {
            console.error('Failed to load suggestions', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (suggestion: SuggestedEvent) => {
        try {
            setProcessingId(suggestion.id);
            const eventId = await EventsService.approveSuggestion(suggestion, userData?.churchId);
            router.push(`/admin/events/${eventId}`);
        } catch (error) {
            console.error('Failed to approve suggestion', error);
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        try {
            setProcessingId(id);
            await EventsService.rejectSuggestion(id);
            setSuggestions(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error('Failed to reject suggestion', error);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No new suggestions</h3>
                <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
                    AI automatically scans new social media posts for events. When one is found, it will appear here for review.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6">
            {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col md:flex-row">
                    {/* Image Section */}
                    {suggestion.imageUrl && (
                        <div className="w-full md:w-64 h-48 md:h-auto bg-gray-100 flex-shrink-0 relative">
                            <img
                                src={suggestion.imageUrl}
                                alt={suggestion.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-purple-600/90 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                                <Sparkles className="w-3 h-3" />
                                AI SUGGESTION
                            </div>
                        </div>
                    )}

                    {/* Content Section */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{suggestion.title || 'Untitled Event'}</h3>
                                {suggestion.sourcePostId && (
                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                        Source: Post ID {suggestion.sourcePostId.slice(0, 8)}...
                                    </span>
                                )}
                            </div>

                            <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                                {suggestion.description}
                            </p>

                            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-purple-500" />
                                    <span>
                                        {suggestion.date?.toDate ? suggestion.date.toDate().toLocaleDateString(undefined, {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        }) : 'Date unavailable'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-purple-500" />
                                    <span>{suggestion.location || 'Location pending'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => handleApprove(suggestion)}
                                disabled={processingId === suggestion.id}
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {processingId === suggestion.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Approve & Create Draft
                            </button>

                            <button
                                onClick={() => handleReject(suggestion.id)}
                                disabled={processingId === suggestion.id}
                                className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
