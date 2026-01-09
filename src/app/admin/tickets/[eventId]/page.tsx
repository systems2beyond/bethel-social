'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, collection, addDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EventsService } from '@/lib/services/EventsService';
import { TicketPreview, TicketConfig } from '@/components/Tickets/TicketPreview';
import { Loader2, Save, Printer, ArrowLeft, Image as ImageIcon, RotateCcw, Check } from 'lucide-react';
import Link from 'next/link';

export default function TicketDesignerPage() {
    const { eventId } = useParams();
    const router = useRouter();
    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Default Config
    const defaultConfig: TicketConfig = {
        name: 'General Admission',
        price: 0,
        color: '#3B82F6', // Blue-500
        backgroundColor: '#1E293B', // Slate-800
        textColor: '#FFFFFF',
        showQrCode: true,
        layout: 'standard'
    };

    const [config, setConfig] = useState<TicketConfig>(defaultConfig);

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
    const [activeImageField, setActiveImageField] = useState<'backgroundImageUrl' | 'logoUrl' | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'backgroundImageUrl' | 'logoUrl') => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setSelectedImageSrc(reader.result?.toString() || null);
                setActiveImageField(field);
                setShowCropper(true);
            });
            reader.readAsDataURL(file);
            e.target.value = ''; // Reset
        }
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        if (!activeImageField) return;

        setShowCropper(false);
        setUploading(true); // You might want to show this state in the UI

        try {
            // Needed to import uploadMedia
            const { uploadMedia } = await import('@/lib/storage');
            const file = new File([croppedBlob], `ticket-${activeImageField}-${Date.now()}.png`, { type: 'image/png' });
            const url = await uploadMedia(file, `events/${eventId}/tickets`);

            setConfig(prev => ({ ...prev, [activeImageField]: url }));
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload image');
        } finally {
            setUploading(false);
            setSelectedImageSrc(null);
            setActiveImageField(null);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!eventId) return;
            try {
                // Fetch Event using Service
                const fetchedEvent = await EventsService.getEvent(eventId as string);

                if (fetchedEvent) {
                    setEvent(fetchedEvent);

                    // Fetch existing ticket config
                    const configsRef = collection(db, 'events', eventId as string, 'ticket_configs');
                    const configSnap = await getDocs(configsRef);

                    if (!configSnap.empty) {
                        const data = configSnap.docs[0].data() as TicketConfig;
                        setConfig({ ...data, id: configSnap.docs[0].id });
                    }
                } else {
                    alert('Event not found');
                    // router.push('/admin/events'); // Commented out to debug if needed
                }
            } catch (error) {
                console.error("Error loading data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [eventId, router]);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (config.id) {
                // Update
                const docRef = doc(db, 'events', eventId as string, 'ticket_configs', config.id);
                await updateDoc(docRef, { ...config });
            } else {
                // Create
                const colRef = collection(db, 'events', eventId as string, 'ticket_configs');
                const docRef = await addDoc(colRef, config);
                setConfig(prev => ({ ...prev, id: docRef.id }));
            }
            // Use simple alert for now, toast would be better
            alert('Ticket design saved!');
        } catch (error) {
            console.error("Error saving ticket", error);
            alert('Failed to save ticket design.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrintRequest = () => {
        // Simple print trigger for now
        window.print();
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Link href="/admin/events" className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Ticket Designer</h1>
                        <p className="text-sm text-gray-500">Designing for: <span className="font-semibold text-blue-600">{event?.title}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrintRequest}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>Save Design</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Left Controls Panel */}
                <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto p-6 shrink-0 z-10 no-print">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">Configuration</h3>

                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Name</label>
                                <input
                                    type="text"
                                    value={config.name}
                                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Adult Admission"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                                <input
                                    type="number"
                                    value={config.price}
                                    onChange={(e) => setConfig({ ...config, price: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Colors */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={config.textColor}
                                        onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                    />
                                    <span className="text-xs text-gray-500">{config.textColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={config.backgroundColor}
                                        onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                    />
                                    <span className="text-xs text-gray-500">{config.backgroundColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={config.color}
                                        onChange={(e) => setConfig({ ...config, color: e.target.value })}
                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                    />
                                    <span className="text-xs text-gray-500">{config.color}</span>
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Media */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Background Image</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={config.backgroundImageUrl || ''}
                                        onChange={(e) => setConfig({ ...config, backgroundImageUrl: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                                        placeholder="https://..."
                                    />
                                    <label className="p-2 border border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition text-blue-600">
                                        <ImageIcon className="w-5 h-5" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, 'backgroundImageUrl')}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={config.logoUrl || ''}
                                        onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                                        placeholder="https://..."
                                    />
                                    <label className="p-2 border border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition text-blue-600">
                                        <ImageIcon className="w-5 h-5" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, 'logoUrl')}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.showQrCode}
                                    onChange={(e) => setConfig({ ...config, showQrCode: e.target.checked })}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Show QR Code</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Preview Canvas */}
                <div className="flex-1 bg-gray-100 p-8 flex flex-col items-center justify-center relative overflow-y-auto">
                    <div className="mb-4 text-sm text-gray-400 font-medium uppercase tracking-wider print:hidden">Live Preview</div>

                    {/* The Ticket Itself */}
                    <div className="transform scale-100 md:scale-110 lg:scale-125 transition-transform origin-center print:scale-100 print:transform-none">
                        <TicketPreview
                            config={config}
                            eventName={event?.title || 'Event Title'}
                            eventDate={event?.startDate}
                            eventLocation={event?.location}
                        />
                    </div>

                    <div className="mt-12 max-w-md text-center text-sm text-gray-500 print:hidden">
                        <p>Changes are reflected instantly. Press "Save" to store this design.</p>
                    </div>
                </div>
            </main>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white; }
                    header, aside, .no-print { display: none !important; }
                    main { overflow: visible !important; height: auto !important; }
                    .print-hidden { display: none !important; }
                    /* Center content for print */
                    main > div:last-child { 
                        background: white !important; 
                        padding: 0 !important; 
                        justify-content: flex-start !important;
                        align-items: center !important;
                    }
                    /* Reset transforms for predictability */
                    .transform { transform: none !important; }
                }
            `}</style>

            {/* Image Cropper Modal */}
            {showCropper && selectedImageSrc && (
                <React.Suspense fallback={null}>
                    <ImageCropperWrapper
                        imageSrc={selectedImageSrc}
                        onCropComplete={handleCropComplete}
                        onCancel={() => { setShowCropper(false); setSelectedImageSrc(null); }}
                    />
                </React.Suspense>
            )}
        </div>
    );
}

// Lazy load cropper to avoid heavy initial bundle
const ImageCropperWrapper = React.lazy(() => import('@/components/Shared/ImageCropper').then(mod => ({ default: mod.default })));
