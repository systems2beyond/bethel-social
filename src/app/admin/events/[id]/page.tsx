'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { EventsService } from '@/lib/services/EventsService';
import { Event, FeaturedGuest, TicketTier, LandingPageBlock } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { ArrowLeft, Save, Plus, Trash2, Upload, Calendar, MapPin, Loader2, Image as ImageIcon, Crop, LayoutTemplate, Eye } from 'lucide-react';
import ImageCropper from '@/components/Shared/ImageCropper';
import LocationSearchInput from '@/components/Shared/LocationSearchInput';
import LandingPageBuilder from '@/components/Admin/LandingPageBuilder';
import { uploadMedia } from '@/lib/storage';

export default function EventEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const isNew = id === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [geo, setGeo] = useState<{ lat: number; lng: number; placeId: string } | undefined>();
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [featuredGuests, setFeaturedGuests] = useState<FeaturedGuest[]>([]);
    const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
    const [status, setStatus] = useState<'draft' | 'published'>('draft');
    const [mediaUrl, setMediaUrl] = useState('');

    // New Fields
    const [category, setCategory] = useState<'General' | 'Meeting' | 'Bible Study' | 'Sunday School'>('General');
    const [landingPageEnabled, setLandingPageEnabled] = useState(false);
    const [landingPageBlocks, setLandingPageBlocks] = useState<LandingPageBlock[]>([]);

    // UI State
    const [activeTab, setActiveTab] = useState<'details' | 'landing_page'>('details');

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!isNew) {
            loadEvent(id);
        }
    }, [id, isNew]);

    const loadEvent = async (eventId: string) => {
        try {
            const event = await EventsService.getEvent(eventId);
            if (event) {
                setTitle(event.title);
                setDescription(event.description);
                setLocation(event.location);
                if (event.geo) setGeo(event.geo);

                // Date handling
                const start = event.startDate.toDate();
                setStartDate(start.toISOString().split('T')[0]);
                setStartTime(start.toTimeString().slice(0, 5));
                if (event.endDate) {
                    setEndDate(event.endDate.toDate().toISOString().split('T')[0]);
                }

                setFeaturedGuests(event.featuredGuests || []);
                setTicketTiers(event.ticketConfig?.tiers || []);
                setStatus(event.status === 'past' ? 'published' : event.status);
                if (event.media?.[0]) setMediaUrl(event.media[0].url);
            }
        } catch (error) {
            console.error('Error loading event:', error);
            alert('Failed to load event');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setSelectedImageSrc(reader.result?.toString() || null);
                setShowCropper(true);
            });
            reader.readAsDataURL(file);
            // Reset input so same file can be selected again if needed
            e.target.value = '';
        }
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setShowCropper(false);
        setUploading(true);
        try {
            const file = new File([croppedBlob], `event-image-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const url = await uploadMedia(file, 'events');
            setMediaUrl(url);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload image');
        } finally {
            setUploading(false);
            setSelectedImageSrc(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        if (!title || !startDate || !startTime) {
            alert('Please fill in all required fields (Title, Date, Time)');
            setSaving(false);
            return;
        }

        try {
            // Combine Date and Time
            const startDateTime = new Date(`${startDate}T${startTime}`);
            if (isNaN(startDateTime.getTime())) {
                throw new Error('Invalid date or time value');
            }

            const endDateTime = endDate ? new Date(endDate) : undefined;
            if (endDateTime && isNaN(endDateTime.getTime())) {
                throw new Error('Invalid end date value');
            }

            const eventData: any = {
                title,
                description,
                location,
                geo,
                startDate: Timestamp.fromDate(startDateTime),
                endDate: endDateTime ? Timestamp.fromDate(endDateTime) : null,
                featuredGuests,
                media: mediaUrl ? [{ url: mediaUrl, type: 'image' }] : [],
                ticketConfig: {
                    tiers: ticketTiers,
                    currency: 'USD'
                },
                status,
                // New Fields
                category,
                landingPage: {
                    enabled: landingPageEnabled,
                    blocks: landingPageBlocks
                }
            };

            if (isNew) {
                await EventsService.createEvent(eventData);
            } else {
                await EventsService.updateEvent(id, eventData);
            }

            router.push('/admin/events');
        } catch (error: any) {
            console.error('Error saving event:', error);
            const errorMessage = error.message || '';
            const isAdBlocker =
                errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
                errorMessage.includes('client is offline') ||
                errorMessage.includes('Failed to get document');

            if (isAdBlocker) {
                alert('CRITICAL ERROR: Ad-Blocker Detected.\n\nYour browser is blocking the database connection. Please DISABLE your ad-blocker for this site and try again.');
            } else {
                alert(`Failed to save event: ${errorMessage}`);
            }
        } finally {
            setSaving(false);
        }
    };

    // Sub-component helpers
    const addGuest = () => setFeaturedGuests([...featuredGuests, { name: '', role: '', imageUrl: '' }]);
    const updateGuest = (index: number, field: keyof FeaturedGuest, value: string) => {
        const newGuests = [...featuredGuests];
        newGuests[index] = { ...newGuests[index], [field]: value };
        setFeaturedGuests(newGuests);
    };
    const removeGuest = (index: number) => setFeaturedGuests(featuredGuests.filter((_, i) => i !== index));

    const addTier = () => setTicketTiers([...ticketTiers, { name: '', price: 0, quantity: 100, type: 'individual' }]);
    const updateTier = (index: number, field: keyof TicketTier, value: any) => {
        const newTiers = [...ticketTiers];
        newTiers[index] = { ...newTiers[index], [field]: value };
        setTicketTiers(newTiers);
    };
    const removeTier = (index: number) => setTicketTiers(ticketTiers.filter((_, i) => i !== index));

    if (loading) return <div className="p-10">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold">{isNew ? 'Create Event' : 'Edit Event'}</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Event
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    Event Details
                </button>
                <button
                    onClick={() => setActiveTab('landing_page')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'landing_page'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    <LayoutTemplate className="w-4 h-4" />
                    Landing Page Builder
                </button>
            </div>

            {/* Main Form */}
            {activeTab === 'details' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* ... Existing Details Content ... */}

                    {/* Left Column: Basic Info */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4">
                            <h2 className="text-lg font-semibold mb-4">Event Details</h2>

                            <div>
                                <label className="block text-sm font-medium mb-1">Event Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="e.g., Annual Charity Gala"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="Describe the event..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Time</label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Location</label>
                                <div className="relative">
                                    <LocationSearchInput
                                        onLocationSelect={(loc) => {
                                            setLocation(loc.address);
                                            setGeo({ lat: loc.lat, lng: loc.lng, placeId: loc.placeId });
                                        }}
                                        defaultValue={location}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as any)}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="General">General Event</option>
                                <option value="Meeting">Meeting</option>
                                <option value="Bible Study">Bible Study</option>
                                <option value="Sunday School">Sunday School</option>
                            </select>
                        </div>

                        {/* Featured Guests Section */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold">Featured Guests</h2>
                                <button onClick={addGuest} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Add Guest
                                </button>
                            </div>

                            <div className="space-y-4">
                                {featuredGuests.map((guest, index) => (
                                    <div key={index} className="flex gap-4 items-start p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex-1 space-y-2">
                                            <input
                                                placeholder="Name"
                                                value={guest.name}
                                                onChange={(e) => updateGuest(index, 'name', e.target.value)}
                                                className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <input
                                                placeholder="Role (e.g., Speaker)"
                                                value={guest.role}
                                                onChange={(e) => updateGuest(index, 'role', e.target.value)}
                                                className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                            />
                                        </div>
                                        <button onClick={() => removeGuest(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {featuredGuests.length === 0 && <p className="text-gray-400 text-sm italic">No guests added.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Tickets & Media */}
                    <div className="space-y-6">
                        {/* Media Upload */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Event Image</h2>

                            {/* Hidden Input */}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="event-image-upload"
                            />

                            <div
                                className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer
                                ${mediaUrl ? 'border-gray-300 dark:border-gray-700' : 'border-blue-300 bg-blue-50 dark:bg-blue-900/10'}
                            `}
                            >
                                {mediaUrl ? (
                                    <div className="relative group">
                                        <img src={mediaUrl} alt="Event" className="w-full aspect-video object-cover rounded-md" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-md">
                                            <label htmlFor="event-image-upload" className="p-2 bg-white text-gray-900 rounded-full cursor-pointer hover:bg-gray-100">
                                                <Crop className="w-4 h-4" />
                                            </label>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setMediaUrl(''); }}
                                                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label htmlFor="event-image-upload" className="cursor-pointer block space-y-2">
                                        {uploading ? (
                                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                                        ) : (
                                            <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                                        )}
                                        <p className="text-sm text-gray-500">
                                            {uploading ? 'Uploading...' : 'Click to Upload Image'}
                                        </p>
                                        <p className="text-xs text-gray-400">JPG, PNG (max 5MB)</p>
                                    </label>
                                )}
                            </div>
                            <div className="mt-4">
                                {!mediaUrl && (
                                    <>
                                        <label className="text-xs text-gray-500 mb-1 block">Or enter URL</label>
                                        <input
                                            type="text"
                                            placeholder="https://..."
                                            value={mediaUrl}
                                            onChange={(e) => setMediaUrl(e.target.value)}
                                            className="w-full p-2 text-xs border rounded bg-transparent"
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Ticket Tiers */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold">Tickets</h2>
                                <button onClick={addTier} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Add Tier
                                </button>
                            </div>

                            <div className="space-y-4">
                                {ticketTiers.map((tier, index) => (
                                    <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                                        <div className="flex justify-between">
                                            <input
                                                placeholder="Tier Name (e.g. VIP)"
                                                value={tier.name}
                                                onChange={(e) => updateTier(index, 'name', e.target.value)}
                                                className="font-medium bg-transparent border-b border-gray-200 dark:border-gray-700 w-full focus:outline-none"
                                            />
                                            <button onClick={() => removeTier(index)} className="text-red-400 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <div>
                                                <label className="text-[10px] uppercase text-gray-400">Price ($)</label>
                                                <input
                                                    type="number"
                                                    value={tier.price}
                                                    onChange={(e) => updateTier(index, 'price', parseFloat(e.target.value))}
                                                    className="w-full p-1 text-sm border rounded"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase text-gray-400">Qty</label>
                                                <input
                                                    type="number"
                                                    value={tier.quantity}
                                                    onChange={(e) => updateTier(index, 'quantity', parseInt(e.target.value))}
                                                    className="w-full p-1 text-sm border rounded"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase text-gray-400">Type</label>
                                            <select
                                                value={tier.type}
                                                onChange={(e) => updateTier(index, 'type', e.target.value)}
                                                className="w-full p-1 text-sm border rounded bg-white dark:bg-gray-700"
                                            >
                                                <option value="individual">Individual Seat</option>
                                                <option value="table">Table</option>
                                            </select>
                                        </div>
                                        {tier.type === 'table' && (
                                            <div>
                                                <label className="text-[10px] uppercase text-gray-400">Seats per Table</label>
                                                <input
                                                    type="number"
                                                    value={tier.seatsPerTable || 8}
                                                    onChange={(e) => updateTier(index, 'seatsPerTable', parseInt(e.target.value))}
                                                    className="w-full p-1 text-sm border rounded"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Status */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <label className="block text-sm font-medium mb-2">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700"
                            >
                                <option value="draft">Draft (Hidden)</option>
                                <option value="published">Published (Visible)</option>
                            </select>
                        </div>

                    </div>

                </div >
            ) : (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Landing Page Builder</h2>
                                <p className="text-sm text-gray-500">Design a custom page for this event.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={landingPageEnabled}
                                            onChange={(e) => setLandingPageEnabled(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Enable Page
                                    </span>
                                </label>
                            </div>
                        </div>

                        {landingPageEnabled ? (
                            <LandingPageBuilder
                                blocks={landingPageBlocks}
                                onChange={setLandingPageBlocks}
                            />
                        ) : (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed text-gray-500">
                                <LayoutTemplate className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                <p>Enable the landing page to start adding content.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Image Cropper Modal */}
            {showCropper && selectedImageSrc && (
                <ImageCropper
                    imageSrc={selectedImageSrc}
                    onCropComplete={handleCropComplete}
                    onCancel={() => { setShowCropper(false); setSelectedImageSrc(null); }}
                    aspectRatio={16 / 9}
                />
            )}
        </div>
    );
}
