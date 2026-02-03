'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { EventsService } from '@/lib/services/EventsService';
import { Event, FeaturedGuest, TicketTier, LandingPageBlock, RegistrationField, Campaign } from '@/types';
import { Timestamp, collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { ArrowLeft, Save, Plus, Trash2, Upload, Calendar, MapPin, Loader2, Image as ImageIcon, Crop, LayoutTemplate, Eye, Users, QrCode } from 'lucide-react';
import ImageCropper from '@/components/Shared/ImageCropper';
import LocationSearchInput from '@/components/Shared/LocationSearchInput';
import LandingPageBuilder from '@/components/Admin/LandingPageBuilder';
import { RegistrationBuilder } from '@/components/Admin/RegistrationBuilder';
import { uploadMedia } from '@/lib/storage';
import QRCodeGenerator from '@/components/Admin/Events/QRCodeGenerator';
import { db } from '@/lib/firebase';
import { safeTimestamp } from '@/lib/utils';

export default function EventEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { userData } = useAuth();
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

    // Campaign Linking
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [linkedCampaignId, setLinkedCampaignId] = useState<string>('');

    // Registration State
    const [registrationEnabled, setRegistrationEnabled] = useState(false);
    const [registrationFields, setRegistrationFields] = useState<RegistrationField[]>([]);
    const [isTicketed, setIsTicketed] = useState(false);
    const [ticketPrice, setTicketPrice] = useState<number>(0);
    const [registrationCapacity, setRegistrationCapacity] = useState<number>(0);

    // UI State
    const [activeTab, setActiveTab] = useState<'details' | 'landing_page' | 'registration' | 'promote'>('details');

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

    // Guest Upload State
    const [uploadingGuestIndex, setUploadingGuestIndex] = useState<number | null>(null);

    useEffect(() => {
        if (userData?.churchId) {
            loadCampaigns();
            if (!isNew) {
                loadEvent(id);
            }
        }
    }, [id, isNew, userData]);

    const loadCampaigns = async () => {
        if (!userData?.churchId) return;
        try {
            const q = query(
                collection(db, 'campaigns'),
                orderBy('name', 'asc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Campaign[];

            // Filter for churchId match OR missing churchId (legacy - only for default church)
            const isLegacyVisible = userData.churchId === 'bethel-metro' || userData.role === 'super_admin';
            const filteredData = data.filter(c => c.churchId === userData.churchId || (!c.churchId && isLegacyVisible));
            setCampaigns(filteredData);
        } catch (error) {
            console.error("Error loading campaigns:", error);
        }
    };

    const loadEvent = async (eventId: string) => {
        try {
            const event = await EventsService.getEvent(eventId);
            if (event) {
                setTitle(event.title);
                setDescription(event.description);
                setLocation(event.location);
                if (event.geo) setGeo(event.geo);

                // Date handling
                const start = safeTimestamp(event.startDate) || new Date();
                setStartDate(start.toISOString().split('T')[0]);
                setStartTime(start.toTimeString().slice(0, 5));
                if (event.endDate) {
                    const end = safeTimestamp(event.endDate);
                    if (end) {
                        setEndDate(end.toISOString().split('T')[0]);
                    }
                }

                setFeaturedGuests(event.featuredGuests || []);
                setTicketTiers(event.ticketConfig?.tiers || []);
                setStatus(event.status === 'past' ? 'published' : event.status);
                if (event.media?.[0]) setMediaUrl(event.media[0].url);

                if (event.registrationConfig) {
                    setRegistrationEnabled(event.registrationConfig.enabled);
                    setRegistrationFields(event.registrationConfig.fields || []);
                    const price = event.registrationConfig.ticketPrice || 0;
                    setTicketPrice(price);
                    setIsTicketed(price > 0);
                    setRegistrationCapacity(event.registrationConfig.capacity || 0);
                }

                if (event.linkedCampaignId) {
                    setLinkedCampaignId(event.linkedCampaignId);
                }
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

    const handleGuestImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploadingGuestIndex(index);
            const file = e.target.files[0];
            try {
                const downloadURL = await uploadMedia(file, `events/${id}/guests`);
                updateGuest(index, 'imageUrl', downloadURL);
            } catch (error) {
                console.error("Error uploading guest image", error);
                alert("Failed to upload image");
            } finally {
                setUploadingGuestIndex(null);
            }
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
                linkedCampaignId: linkedCampaignId || null,
                landingPage: {
                    enabled: landingPageEnabled,
                    blocks: landingPageBlocks
                },
                registrationConfig: {
                    enabled: registrationEnabled,
                    fields: registrationFields,
                    ticketPrice: ticketPrice,
                    capacity: registrationCapacity,
                    currency: 'USD'
                },
                churchId: userData?.churchId || 'default_church'
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
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'details'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    Event Details
                </button>
                <button
                    onClick={() => setActiveTab('landing_page')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'landing_page'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    <LayoutTemplate className="w-4 h-4" />
                    Landing Page
                </button>
                <button
                    onClick={() => setActiveTab('registration')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'registration'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    <Users className="w-4 h-4" />
                    Registration
                </button>
                <button
                    onClick={() => setActiveTab('promote')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'promote'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                >
                    <QrCode className="w-4 h-4" />
                    Promote & QR
                </button>
            </div>

            {/* Main Form */}
            {activeTab === 'details' && (
                <div className="space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                        <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                            {/* Guest Image Upload */}
                                            <div className="relative w-16 h-16 flex-shrink-0 group">
                                                <input
                                                    type="file"
                                                    id={`guest-upload-${index}`}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleGuestImageUpload(index, e)}
                                                />
                                                <label
                                                    htmlFor={`guest-upload-${index}`}
                                                    className="block w-full h-full rounded-full overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-500 cursor-pointer bg-white dark:bg-gray-700 relative transition-colors"
                                                >
                                                    {guest.imageUrl ? (
                                                        <>
                                                            <img src={guest.imageUrl} className="w-full h-full object-cover" alt={guest.name} />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Upload className="w-6 h-6 text-white" />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center justify-center w-full h-full text-gray-400 group-hover:text-blue-500">
                                                            {uploadingGuestIndex === index ? (
                                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                            ) : (
                                                                <div className="flex flex-col items-center">
                                                                    <Users className="w-6 h-6 mb-1" />
                                                                    <span className="text-[10px] uppercase font-bold">Add</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </label>
                                            </div>

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

                    </div>
                </div>
            )}

            {activeTab === 'landing_page' && (
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

            {activeTab === 'registration' && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold">Registration Settings</h2>
                                <p className="text-gray-500 text-sm">Configure how attendees register.</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={registrationEnabled}
                                        onChange={(e) => setRegistrationEnabled(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </div>
                                <span className="text-sm font-medium">Enable Registration</span>
                            </label>
                        </div>

                        {registrationEnabled && (
                            <>
                                <div className="space-y-4 mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={isTicketed}
                                                onChange={(e) => {
                                                    setIsTicketed(e.target.checked);
                                                    if (!e.target.checked) setTicketPrice(0);
                                                }}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </div>
                                        <span className="text-sm font-medium">Enable Ticketing (Paid)</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {isTicketed && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Ticket Price ($)</label>
                                            <input
                                                type="number"
                                                value={ticketPrice}
                                                onChange={(e) => setTicketPrice(Number(e.target.value))}
                                                className="w-full p-2 border rounded-lg dark:bg-gray-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    )}
                                    <div className={!isTicketed ? "col-span-2" : ""}>
                                        <label className="block text-sm font-medium mb-1">Capacity Limit</label>
                                        <input
                                            type="number"
                                            value={registrationCapacity}
                                            onChange={(e) => setRegistrationCapacity(Number(e.target.value))}
                                            className="w-full p-2 border rounded-lg dark:bg-gray-700"
                                            placeholder="Unlimited"
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-4 dark:border-gray-700">
                                    <h3 className="font-semibold mb-4">Registration Form Fields</h3>
                                    <RegistrationBuilder fields={registrationFields} onChange={setRegistrationFields} />
                                </div>

                                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <h3 className="font-semibold mb-2">Donation Campaign</h3>
                                    <p className="text-sm text-gray-500 mb-4">
                                        Link this event to a specific donation campaign fund. Any donations made during registration will be attributed to this fund.
                                    </p>
                                    <label className="block text-sm font-medium mb-1">Link to Campaign Fund</label>
                                    <select
                                        value={linkedCampaignId}
                                        onChange={(e) => setLinkedCampaignId(e.target.value)}
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    >
                                        <option value="">-- No specific campaign (General) --</option>
                                        {campaigns.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'promote' && (
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm text-center">
                        <h2 className="text-xl font-bold mb-4">Event QR Code</h2>
                        <p className="text-gray-500 mb-6">Customize and download the QR code for your event.</p>

                        <QRCodeGenerator
                            url={typeof window !== 'undefined' ? `${window.location.origin}/events/${id}` : `https://bethel-metro-social.netlify.app/events/${id}`}
                            eventId={id}
                        />

                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                            <a href={`/events/${id}`} target="_blank" className="text-blue-600 hover:underline text-sm font-medium">Open Public Page</a>
                        </div>
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
