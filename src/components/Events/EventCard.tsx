'use client';

import React, { useState } from 'react';
import { Calendar, MapPin, Clock, Ticket, ArrowRight, Video, CalendarPlus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLightbox } from '@/context/LightboxContext';
import { useFeed } from '@/context/FeedContext';
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn, safeTimestamp, formatTextWithLinks } from '@/lib/utils';
import { Event } from '@/types';
import { RegistrationModal } from './RegistrationModal';

export const EventCard = ({ event }: { event: Event }) => {
    const { openLightbox } = useLightbox();
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);

    const eventDate = safeTimestamp(event.startDate) || new Date();
    // Format date parts separately for the "Date Tile"
    const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = eventDate.getDate();

    // Format full string for accessibility/context
    const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = event.extractedData?.time || eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Location Map Link
    const mapLink = event.geo?.placeId
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}&query_place_id=${event.geo.placeId}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;


    // Helper to get a valid image URL
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

    const displayImageUrl = getImageUrl(event.media?.find(m => m.type === 'image' || m.type === 'video')?.url) || getImageUrl(event.imageUrl);

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

    const hasRegistration = event.registrationConfig?.enabled;
    const ticketPrice = event.registrationConfig?.ticketPrice;
    const currency = event.registrationConfig?.currency || 'USD';
    const formattedPrice = ticketPrice
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(ticketPrice)
        : 'Free';

    return (
        <>
            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col hover:shadow-xl hover:border-gray-200 dark:hover:border-zinc-700 transition-all duration-300 relative"
            >
                {/* Image Header with Date Tile Overlay */}
                <div className="relative h-48 sm:h-56 w-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                    {displayImageUrl ? (
                        <div
                            className="relative w-full h-full cursor-pointer"
                            onClick={() => event.imageUrl && openLightbox(event.imageUrl, event.imageUrl.includes('youtu') ? 'video' : 'image')}
                        >
                            <Image
                                src={displayImageUrl}
                                alt={event.title}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            {(event.imageUrl?.includes('youtu') || event.media?.some(m => m.type === 'video')) && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:scale-110 transition-transform">
                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50">
                                        <Video className="w-5 h-5 text-white fill-white" />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
                            <Calendar className="w-12 h-12 text-blue-200 dark:text-zinc-700" />
                        </div>
                    )}

                    {/* Date Tile - Floating */}
                    <div className="absolute top-4 left-4 bg-white dark:bg-black/80 backdrop-blur-md rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 z-10 text-center leading-none overflow-hidden">
                        <div className="w-full bg-red-500 text-[10px] sm:text-xs font-bold text-white py-1 uppercase tracking-wider">
                            {month}
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">{day}</span>
                        </div>
                    </div>

                    {/* Status Badge / Ticket Info */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                        {hasRegistration && (
                            <div className="bg-blue-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-1">
                                <Ticket className="w-3 h-3" />
                                {formattedPrice === 'Free' ? 'RSVP' : formattedPrice}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-5 sm:p-6 flex flex-col flex-grow">
                    {/* Meta Row: Time & Category & Calendar */}
                    <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{timeStr}</span>
                            </div>
                            {event.category && (
                                <span className="bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md text-gray-600 dark:text-gray-300">
                                    {event.category}
                                </span>
                            )}
                        </div>

                        {/* Calendar Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                    <CalendarPlus className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
                                <DropdownMenuItem onClick={() => window.open(generateGoogleCalendarUrl(event), '_blank')}>
                                    Google Calendar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadIcsFile(event)}>
                                    Download .ics (Outlook/Apple)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Title */}
                    <Link href={`/events/${event.id}`} className="block group-hover:text-blue-600 transition-colors duration-200">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight mb-3 line-clamp-2">
                            {event.title}
                        </h3>
                    </Link>

                    {/* Location with Google Maps Link */}
                    {/* Location with Google Maps Link */}
                    {event.location && event.location.trim().length > 0 && (
                        <a
                            href={mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 mb-4 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group/loc"
                        >
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400 group-hover/loc:text-blue-500 transition-colors" />
                            <span className="line-clamp-2">{event.location}</span>
                        </a>
                    )}

                    {/* Description Excerpt */}
                    <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed mb-6">
                        {formatTextWithLinks(event.description)}
                    </p>

                    {/* Action Footer */}
                    <div className="mt-auto pt-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
                        {hasRegistration ? (
                            <>
                                <Button
                                    onClick={() => setIsRegistrationOpen(true)}
                                    className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 font-semibold shadow-sm"
                                >
                                    {formattedPrice === 'Free' ? 'Register' : 'Tickets'}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300"
                                    asChild
                                >
                                    <Link href={`/events/${event.id}`}>
                                        Details
                                    </Link>
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="outline"
                                className="flex-1 width-full border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                asChild
                            >
                                <Link href={`/events/${event.id}`}>
                                    View Details
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>
            <RegistrationModal
                isOpen={isRegistrationOpen}
                onClose={() => setIsRegistrationOpen(false)}
                event={event}
            />
        </>
    );
};
