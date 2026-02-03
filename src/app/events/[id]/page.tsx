'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { EventsService } from '@/lib/services/EventsService';
import { Event, LandingPageBlock } from '@/types';
import { Loader2, Calendar, MapPin, Share2, Download, ExternalLink, Play, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatTextWithLinks, safeTimestamp } from '@/lib/utils';
import { motion } from 'framer-motion';
import { RegistrationModal } from '@/components/Events/RegistrationModal';
import DonationWidget from '@/components/Giving/DonationForm';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Heart } from 'lucide-react';

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    const [isDonationOpen, setIsDonationOpen] = useState(false);

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
    const ticketPrice = event.registrationConfig?.ticketPrice;
    const currency = event.registrationConfig?.currency || 'USD';
    const formattedPrice = ticketPrice
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(ticketPrice)
        : 'Free';


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
                    // Regex to extract video ID from various YouTube URL formats
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = block.url.match(regExp);
                    if (match && match[2].length === 11) {
                        embedUrl = `https://www.youtube.com/embed/${match[2]}`;
                    } else if (block.url.includes('watch?v=')) {
                        // Fallback to simple replace if regex fails but it looks like a standard watch URL
                        embedUrl = block.url.replace('watch?v=', 'embed/');
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
                            href={block.url.startsWith('http') ? block.url : `https://${block.url}`}
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
        const imageUrl = event.media?.find(m => m.type === 'image' || m.type === 'video')?.url || event.imageUrl; // Priority to media
        const eventDate = safeTimestamp(event.startDate) || new Date();

        return (
            <div className="max-w-4xl mx-auto pb-12">
                {/* Hero / Cover */}
                <div className="relative h-[40vh] min-h-[300px] w-full bg-gray-900 rounded-b-3xl md:rounded-b-[3rem] overflow-hidden shadow-2xl">
                    {/* Back Button - Moved to top for better UX */}
                    <div className="absolute top-4 left-4 z-20">
                        <Link
                            href="/events"
                            className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/10 transition-all font-medium text-sm"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Back to Events</span>
                            <span className="sm:hidden">Back</span>
                        </Link>
                    </div>

                    {imageUrl ? (
                        <Image
                            src={imageUrl.includes('youtu') ? `https://img.youtube.com/vi/${imageUrl.split('v=')[1]?.split('&')[0]}/hqdefault.jpg` : imageUrl}
                            alt={event.title}
                            fill
                            className="object-cover opacity-60"
                            priority
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-900 opacity-80" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />

                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 pb-12 md:pb-16">
                        <div className="flex flex-wrap gap-3 mb-3 md:mb-4">
                            {event.category && (
                                <span className="bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs md:text-sm font-semibold shadow-sm">
                                    {event.category}
                                </span>
                            )}
                            <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5 border border-white/10">
                                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                {eventDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-3 md:mb-4 leading-tight shadow-sm tracking-tight">
                            {event.title}
                        </h1>

                        <div className="flex flex-col md:flex-row md:items-center gap-3 text-white/90 text-sm md:text-base font-medium">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <span className="line-clamp-1">{event.location && event.location.trim().length > 0 ? event.location : 'Location TBD'}</span>
                            </div>
                            <div className="hidden md:block w-1.5 h-1.5 bg-white/40 rounded-full" />
                            {/* Optional: Add time or other meta here */}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid md:grid-cols-3 gap-8 px-4 md:px-12 mt-6 md:-mt-12 relative z-10">
                    {/* Left: Description */}
                    <div className="md:col-span-2 space-y-8 bg-white dark:bg-zinc-800 p-5 md:p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700/50">
                        <div>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                About this Event
                            </h3>
                            <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 leading-relaxed text-sm md:text-base">
                                {renderContent(event.description)}
                            </div>
                        </div>

                        {/* Media Gallery */}
                        {event.media && event.media.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold mb-4">Gallery & Media</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {event.media.map((item, i) => (
                                        <div key={i} className="rounded-xl overflow-hidden shadow-sm bg-gray-100 dark:bg-zinc-900 aspect-video relative group">
                                            {item.type === 'video' || item.url.includes('youtube') ? (
                                                <iframe
                                                    src={item.url.includes('embedding') ? item.url : (item.url.includes('youtu.be') ? item.url.replace('youtu.be/', 'youtube.com/embed/') : item.url.replace('watch?v=', 'embed/'))}
                                                    className="w-full h-full"
                                                    allowFullScreen
                                                />
                                            ) : (
                                                <Image
                                                    src={item.url}
                                                    alt={`Media ${i + 1}`}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Featured Guests */}
                        {event.featuredGuests && event.featuredGuests.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold mb-4">Featured Guests</h3>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {event.featuredGuests.map((guest, i) => (
                                        <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-zinc-700/50 rounded-lg border border-gray-100 dark:border-zinc-700">
                                            {guest.imageUrl ? (
                                                <div className="relative w-14 h-14 rounded-full overflow-hidden shadow-md flex-shrink-0">
                                                    <Image src={guest.imageUrl} alt={guest.name} fill className="object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl flex-shrink-0">
                                                    {guest.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-lg leading-tight">{guest.name}</p>
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
                        <div className="bg-white dark:bg-zinc-800 p-5 md:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-700 sticky top-24">
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
                                {event.location && event.location.trim().length > 0 && (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                                        <div>
                                            <p className="font-medium">Location</p>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm text-blue-500 hover:underline dark:text-blue-400"
                                            >
                                                {event.location}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {event.registrationConfig?.enabled && (
                                <button
                                    onClick={() => setIsRegistrationOpen(true)}
                                    className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm"
                                >
                                    {event.ticketConfig?.tiers?.length ? 'Get Tickets' : (formattedPrice === 'Free' ? 'RSVP Now' : 'Register Now')}
                                </button>
                            )}

                            {event.linkedCampaignId && (
                                <button
                                    onClick={() => setIsDonationOpen(true)}
                                    className="w-full mt-3 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                                >
                                    <Heart className="w-4 h-4 fill-current" />
                                    Make a Donation
                                </button>
                            )}

                            {event.linkedGroupId && (
                                <Link
                                    href={`/groups/${event.linkedGroupId}`}
                                    className="block mt-3 w-full py-3 bg-white border-2 border-blue-600 text-blue-600 dark:bg-zinc-800 dark:text-blue-400 dark:border-blue-400 rounded-lg font-bold hover:bg-blue-50 dark:hover:bg-zinc-700 transition-colors text-center"
                                >
                                    View Community Group
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // If custom page is enabled, render blocks. Otherwise standard.
    if (!isCustomPage) {
        return (
            <>
                <StandardLayout />
                <RegistrationModal
                    isOpen={isRegistrationOpen}
                    onClose={() => setIsRegistrationOpen(false)}
                    event={event}
                />

                <Dialog open={isDonationOpen} onOpenChange={setIsDonationOpen}>
                    <DialogContent className="max-w-md p-0 bg-transparent border-none shadow-none [&>button]:hidden">
                        <DialogTitle className="sr-only">Make a Donation</DialogTitle>
                        <DonationWidget initialCampaignId={event.linkedCampaignId || undefined} compact={true} onClose={() => setIsDonationOpen(false)} />
                    </DialogContent>
                </Dialog>
            </>
        );
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
                    <div className="flex justify-center flex-wrap gap-4 text-white/90 font-medium mb-6">
                        <span className="flex items-center gap-1 bg-black/30 px-3 py-1 rounded-full backdrop-blur-md">
                            <Calendar className="w-4 h-4" />
                            {(() => {
                                const d = safeTimestamp(event.startDate);
                                return d ? d.toLocaleDateString() : 'Date TBD';
                            })()}
                        </span>
                        {event.location && event.location.trim().length > 0 && (
                            <span className="flex items-center gap-1 bg-black/30 px-3 py-1 rounded-full backdrop-blur-md">
                                <MapPin className="w-4 h-4" />
                                {event.location}
                            </span>
                        )}
                    </div>

                    {event.registrationConfig?.enabled && (
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => setIsRegistrationOpen(true)}
                                className="px-8 py-3 bg-white text-black text-lg rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg"
                            >
                                {event.ticketConfig?.tiers?.length ? 'Get Tickets' : (formattedPrice === 'Free' ? 'RSVP Now' : 'Register Now')}
                            </button>

                            {event.linkedCampaignId && (
                                <button
                                    onClick={() => setIsDonationOpen(true)}
                                    className="px-8 py-3 bg-green-600 text-white text-lg rounded-full font-bold hover:bg-green-700 transition-colors shadow-lg flex items-center gap-2"
                                >
                                    <Heart className="w-5 h-5 fill-current" />
                                    Donate
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Blocks Container */}
            <div className="py-12 bg-white dark:bg-black">
                {landingPage.blocks.map(renderBlock)}
            </div>

            <RegistrationModal
                isOpen={isRegistrationOpen}
                onClose={() => setIsRegistrationOpen(false)}
                event={event}
            />

            <Dialog open={isDonationOpen} onOpenChange={setIsDonationOpen}>
                <DialogContent className="max-w-md p-0 bg-transparent border-none shadow-none [&>button]:hidden">
                    <DialogTitle className="sr-only">Make a Donation</DialogTitle>
                    <DonationWidget initialCampaignId={event.linkedCampaignId || undefined} compact={true} onClose={() => setIsDonationOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
