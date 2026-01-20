import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Calendar, MapPin, Ticket as TicketIcon } from 'lucide-react';

export interface TicketConfig {
    id?: string;
    name: string;
    price: number;
    color: string;
    backgroundColor: string;
    backgroundImageUrl?: string;
    logoUrl?: string;
    textColor: string;
    showQrCode: boolean;
    layout: 'standard' | 'minimal';
}

interface TicketPreviewProps {
    config: TicketConfig;
    eventName: string;
    eventDate: any; // Timestamp or Date
    eventLocation?: string;
    className?: string;
    eventId: string;
}

export const TicketPreview: React.FC<TicketPreviewProps> = ({
    config,
    eventName,
    eventDate,
    eventLocation = 'Main Sanctuary',
    className = '',
    eventId
}) => {
    // Helper to format date safely
    const formattedDate = React.useMemo(() => {
        try {
            if (!eventDate) return 'Date TBA';
            const date = eventDate instanceof Timestamp ? eventDate.toDate() : new Date(eventDate);
            return format(date, 'MMM d, yyyy • h:mm a');
        } catch (e) {
            return 'Invalid Date';
        }
    }, [eventDate]);

    // Derived styles
    const containerStyle = {
        backgroundColor: config.backgroundColor,
        color: config.textColor,
        backgroundImage: config.backgroundImageUrl ? `url(${config.backgroundImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };

    const accentStyle = {
        borderColor: config.color,
        color: config.color,
    };

    const bgAccentStyle = {
        backgroundColor: config.color,
    };


    return (
        <div className={`relative flex flex-col md:flex-row print:flex-row shadow-xl print:shadow-none rounded-2xl print:rounded-xl overflow-hidden print:overflow-visible max-w-[800px] w-full print:w-full min-h-[320px] h-auto mx-auto ${className}`} style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>

            {/* Main Ticket Body */}
            <div className="flex-grow p-6 md:p-8 relative flex flex-col justify-between" style={containerStyle}>
                {/* Overlay for readability if bg image exists */}
                {config.backgroundImageUrl && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
                )}

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 bg-white/20 backdrop-blur-md border border-white/20">
                                {config.name}
                            </div>
                            <h2 className="text-xl md:text-3xl font-black leading-tight mb-2 tracking-tight">
                                {eventName}
                            </h2>
                            <div className="flex items-center space-x-4 text-sm md:text-base opacity-90 font-medium">
                                <div className="flex items-center">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    {formattedDate}
                                </div>
                                <div className="flex items-center">
                                    <MapPin className="w-4 h-4 mr-2" />
                                    {eventLocation}
                                </div>
                            </div>
                        </div>
                        {config.logoUrl && (
                            <img src={config.logoUrl} alt="Logo" className="w-12 h-12 md:w-16 md:h-16 object-contain drop-shadow-lg" />
                        )}
                    </div>

                    <div className="flex items-end justify-between mt-auto pt-8">
                        <div>
                            <p className="text-xs uppercase tracking-widest opacity-60 mb-1">Price</p>
                            <p className="text-2xl font-bold">{config.price === 0 ? 'FREE' : `$${config.price}`}</p>
                        </div>
                        {config.showQrCode && (
                            <div className="bg-white p-2 rounded-lg shadow-sm">
                                <QRCodeSVG
                                    value={typeof window !== 'undefined' ? `${window.location.origin}/events/${eventId}` : `https://bethel-metro-social.netlify.app/events/${eventId}`}
                                    size={80}
                                    level="M"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Decorative Circles (Punch holes) */}
                <div className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-white z-20" />
            </div>

            {/* Perforated Line */}
            <div className="w-[2px] relative z-20 flex flex-col justify-between py-2" style={{ backgroundColor: config.backgroundColor }}>
                <div className="absolute inset-0 border-l-[2px] border-dashed border-white/30" />
            </div>

            {/* Stub (Right Side) */}
            <div className="w-[140px] md:w-[200px] p-6 relative flex flex-col justify-center items-center text-center border-l border-white/10" style={containerStyle}>
                {config.backgroundImageUrl && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />
                )}

                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <TicketIcon className="w-8 h-8 opacity-90" />
                    </div>
                    <h3 className="font-bold text-lg leading-tight mb-2">{config.name}</h3>
                    <p className="text-xs opacity-70 mb-4">{formattedDate}</p>

                    <div className="mt-auto pt-4 border-t border-white/20 w-full">
                        <p className="text-xl font-black">{config.price === 0 ? 'FREE' : `$${config.price}`}</p>
                    </div>
                </div>

                {/* Decorative Circles (Punch holes) */}
                <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-white z-20" />
            </div>
        </div>
    );
};
