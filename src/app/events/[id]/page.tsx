'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { EventsService } from '@/lib/services/EventsService';
import { Event, LandingPageBlock } from '@/types';
import { Loader2, Calendar, MapPin, Share2, Download, ExternalLink, Play, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatTextWithLinks } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadEvent = async () => {
            try {
                // If it's a meeting (starts with meeting-?), we might need different logic
                // But current EventsService only fetches 'events' collection.
                // If ID matches an event, it returns it.
                const data = await EventsService.getEvent(id);
                if (data) {
                    setEvent(data as Event);
                } else {
                    // Handle not found
                    console.log('Event not found');
                }
            } catch (error) {
                console.error('Error loading event:', error);
            } finally {
                setLoading(false);
            }
        };
        loadEvent();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <h1 className="text-2xl font-bold">Event not found</h1>
                <Link href="/events" className="text-blue-500 hover:underline">
                    Back to Events
                </Link>
            </div>
        );
    }

    const { landingPage } = event;
    const isCustomPage = landingPage?.enabled && landingPage.blocks.length > 0;

    // Helper text renderer
    const renderContent = (content: string) => (
        <p className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
            {formatTextWithLinks(content)}
        </p>
    );

    // --- RENDER BLOCKS ---
    const renderBlock = (block: LandingPageBlock) => {
        switch (block.type) {
            case 'text':
                return (
                    <div key={block.id} className="max-w-3xl mx-auto py-6 px-4">
                        {block.title && <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{block.title}</h2>}
                        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                            {renderContent(block.content)}
                        </div>
                    </div>
                );
            case 'image':
                return (
                    <div key={block.id} className="w-full py-6">
                        <div className="max-w-4xl mx-auto px-4">
                            <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-lg">
                                <Image
                                    src={block.url}
                                    alt={block.caption || 'Event Image'}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            {block.caption && (
                                <p className="text-center text-sm text-gray-500 mt-2 italic">{block.caption}</p>
                            )}
                        </div>
                    </div>
                );
            case 'video':
                // Simple embed or video tag
                const isYouTube = block.url.includes('youtube') || block.url.includes('youtu.be');
                let embedUrl = block.url;
                if (isYouTube) {
                    if (block.url.includes('watch?v=')) {
                        embedUrl = block.url.replace('watch?v=', 'embed/');
                    } else if (block.url.includes('youtu.be/')) {
                        embedUrl = block.url.replace('youtu.be/', 'youtube.com/embed/');
                    }
                }

                return (
                    <div key={block.id} className="w-full py-6 bg-gray-50 dark:bg-zinc-900/50">
                        <div className="max-w-4xl mx-auto px-4">
                            {block.title && <h3 className="text-xl font-bold mb-4 text-center">{block.title}</h3>}
                            <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-lg bg-black">
                                {isYouTube ? (
                                    <iframe
                                        src={embedUrl}
                                        className="absolute inset-0 w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <video src={block.url} controls className="w-full h-full" />
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'file':
                return (
                    <div key={block.id} className="max-w-2xl mx-auto py-4 px-4">
                        <a
                            href={block.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:shadow-md transition-shadow group"
                        >
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                                <Download className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                    {block.name}
                                </h4>
                                {block.size && (
                                    <p className="text-xs text-gray-500">{(block.size / 1024 / 1024).toFixed(2)} MB</p>
                                )}
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                    </div>
                );
            case 'button':
                return (
                    <div key={block.id} className="flex justify-center py-6 px-4">
                        <a
                            href={block.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-8 py-3 rounded-full font-medium transition-transform hover:scale-105 shadow-lg ${block.style === 'secondary'
                                    ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {block.label}
                        </a>
                    </div>
                );
            default:
                return null;
        }
    };

    // --- STANDARD LAYOUT ---
    const StandardLayout = () => {
        const imageUrl = event.media?.[0]?.url || event.imageUrl; // Fallback
        const eventDate = event.startDate.toDate();

        return (
            <div className="max-w-4xl mx-auto pb-12">
                {/* Hero / Cover */}
                <div className="relative h-[40vh] min-h-[300px] w-full bg-gray-900">
                    {imageUrl ? (
                        <Image
                            src={imageUrl}
                            alt={event.title}
                            fill
                            className="object-cover opacity-60"
                            priority
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-900 opacity-80" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />

                    <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
                        <Link href="/events" className="inline-flex items-center text-white/80 hover:text-white mb-6 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
                        </Link>

                        <div className="flex flex-wrap gap-4 mb-4">
                            {event.category && (
                                <span className="bg-blue-500/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                                    {event.category}
                                </span>
                            )}
                            <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {eventDate.toLocaleDateString()}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 shadow-sm">
                            {event.title}
                        </h1>

                        <div className="flex flex-col md:flex-row md:items-center gap-4 text-white/90">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-red-400" />
                                {event.location}
                            </div>
                            <div className="hidden md:block w-1.5 h-1.5 bg-white/40 rounded-full" />
                            {/* You could add guest info here */}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid md:grid-cols-3 gap-8 p-6 md:p-12 -mt-8 relative z-10">
                    {/* Left: Description */}
                    <div className="md:col-span-2 space-y-8 bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-xl">
                        <div>
                            <h3 className="text-xl font-bold mb-4">About this Event</h3>
                            <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
                                {renderContent(event.description)}
                            </div>
                        </div>

                        {/* Featured Guests */}
                        {event.featuredGuests && event.featuredGuests.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold mb-4">Featured Guests</h3>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {event.featuredGuests.map((guest, i) => (
                                        <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-zinc-700/50 rounded-lg">
                                            {guest.imageUrl && (
                                                <div className="relative w-12 h-12 rounded-full overflow-hidden">
                                                    <Image src={guest.imageUrl} alt={guest.name} fill className="object-cover" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold">{guest.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{guest.role}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Actions / Ticket Info */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-700 sticky top-24">
                            <h3 className="font-bold text-lg mb-4">Event Details</h3>
                            <div className="space-y-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
                                    <div>
                                        <p className="font-medium">Date & Time</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                            <br />
                                            {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                                    <div>
                                        <p className="font-medium">Location</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{event.location}</p>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                                {event.ticketConfig?.tiers?.length ? 'Get Tickets' : 'Register Now'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // If custom page is enabled, render blocks. Otherwise standard.
    if (!isCustomPage) {
        return <StandardLayout />;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            {/* Custom Page Header - Optional, maybe reuse hero or simpler one */}
            <div className="relative h-[40vh] min-h-[300px] w-full bg-gray-900">
                {/* Reusing Hero Logic for Custom Page too, looks good */}
                {event.media?.[0]?.url || event.imageUrl ? (
                    <Image
                        src={event.media?.[0]?.url || event.imageUrl || ''}
                        alt={event.title}
                        fill
                        className="object-cover opacity-50"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-purple-900" />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 text-center">
                    <Link href="/events" className="inline-flex items-center text-white/70 hover:text-white mb-4 transition-colors absolute top-8 left-8">
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back
                    </Link>

                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 drop-shadow-lg max-w-4xl mx-auto">
                        {event.title}
                    </h1>
                    <div className="flex justify-center flex-wrap gap-4 text-white/90 font-medium">
                        <span className="flex items-center gap-1 bg-black/30 px-3 py-1 rounded-full backdrop-blur-md">
                            <Calendar className="w-4 h-4" />
                            {event.startDate.toDate().toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 bg-black/30 px-3 py-1 rounded-full backdrop-blur-md">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                        </span>
                    </div>
                </div>
            </div>

            {/* Blocks Container */}
            <div className="py-12 bg-white dark:bg-black">
                {landingPage.blocks.map(renderBlock)}
            </div>
        </div>
    );
}
