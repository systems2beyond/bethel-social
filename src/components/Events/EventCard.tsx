'use client';

import React from 'react';
import { Calendar, MapPin, Clock, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLightbox } from '@/context/LightboxContext';
import { useFeed } from '@/context/FeedContext';

import { Event } from '@/types';
import { formatTextWithLinks } from '@/lib/utils';

export const EventCard = ({ event }: { event: Event }) => {
    const { openLightbox } = useLightbox();

    const eventDate = event.startDate.toDate();
    const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Use extracted time string if available (to avoid timezone shifts), otherwise fallback to timestamp
    const timeStr = event.extractedData?.time || eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Helper to get a valid image URL (handling YouTube links)
    const getImageUrl = (url?: string) => {
        if (!url) return null;
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = '';

            if (url.includes('embed/')) {
                videoId = url.split('embed/')[1]?.split('?')[0];
            } else if (url.includes('v=')) {
                videoId = url.split('v=')[1]?.split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1]?.split('?')[0];
            } else {
                // Fallback for other formats, stripping query params
                videoId = url.split('/').pop()?.split('?')[0] || '';
            }

            if (videoId) {
                // Use hqdefault as it's more reliable than maxresdefault
                return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            }
        }
        return url;
    };

    const displayImageUrl = getImageUrl(event.imageUrl);

    const { registerPost, unregisterPost, reportVisibility } = useFeed();
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Register event with FeedContext so it can be used as AI context
    React.useEffect(() => {
        registerPost(event.id, {
            content: `${event.title} - ${event.description} at ${event.location} on ${dateStr} ${timeStr}`,
            mediaUrl: displayImageUrl || undefined,
            type: displayImageUrl ? 'image' : 'text'
        });
        return () => unregisterPost(event.id);
    }, [event, registerPost, unregisterPost, displayImageUrl, dateStr, timeStr]);

    // Track visibility
    React.useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    reportVisibility(event.id, entry.intersectionRatio, entry.boundingClientRect);
                });
            },
            { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [event.id, reportVisibility]);

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow duration-300"
        >
            {/* Image Section */}
            <div className="md:w-1/3 relative h-48 md:h-auto bg-gray-100 dark:bg-zinc-800">
                {displayImageUrl ? (
                    <div
                        className="relative w-full h-full cursor-pointer group"
                        onClick={() => event.imageUrl && openLightbox(event.imageUrl, event.imageUrl.includes('youtu') ? 'video' : 'image')}
                    >
                        <Image
                            src={displayImageUrl}
                            alt={event.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">Expand</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Calendar className="w-12 h-12 opacity-20" />
                    </div>
                )}

                {/* Date Badge (Mobile Overlay) */}
                <div className="absolute top-4 left-4 md:hidden bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-lg px-3 py-1 text-center shadow-sm border border-gray-200 dark:border-zinc-700">
                    <div className="text-xs font-bold text-red-500 uppercase">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{eventDate.getDate()}</div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6 md:w-2/3 flex flex-col justify-between">
                <div>
                    <div className="hidden md:flex items-center space-x-2 text-sm font-bold text-red-500 mb-2 uppercase tracking-wide">
                        <span>{eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                        <span>•</span>
                        <span>{timeStr}</span>
                    </div>

                    <Link href={`/events/${event.id}`} className="hover:text-blue-600 transition-colors">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">{event.title}</h3>
                    </Link>

                    <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-4">
                        <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                        <span className="line-clamp-1">{event.location}</span>
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-4 leading-relaxed">
                        {formatTextWithLinks(event.description)}
                    </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-zinc-800 mt-auto">
                    <div className="md:hidden flex items-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-1.5" />
                        {timeStr}
                    </div>

                    <div className="flex space-x-3 ml-auto">
                        <Link href={`/events/${event.id}`} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                            View Details <ExternalLink className="w-4 h-4 ml-1" />
                        </Link>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
