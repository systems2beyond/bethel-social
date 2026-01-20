'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Loader2, Calendar, MapPin, CheckCircle2, Users } from 'lucide-react';
import { Event, RegistrationField } from '@/types';
import { EventsService } from '@/lib/services/EventsService';
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar';
import { Timestamp } from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import { GroupNavigationTutorial } from '@/components/Groups/GroupNavigationTutorial';
import EventPaymentModal from './EventPaymentModal';

interface RegistrationModalProps {
    event: Event;
    isOpen: boolean;
    onClose: () => void;
}

export const RegistrationModal = ({ event, isOpen, onClose }: RegistrationModalProps) => {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);

    // Default fields: Name and Email are always required
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    const [showPayment, setShowPayment] = useState(false);

    const config = event.registrationConfig;

    if (!config || !config.enabled) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate required custom fields
            for (const field of config.fields) {
                if (field.required && !formData[field.id]) {
                    throw new Error(`${field.label} is required`);
                }
            }

            // If ticket price exists, show payment modal instead of registering immediately
            if (config.ticketPrice && config.ticketPrice > 0) {
                setShowPayment(true);
                setLoading(false);
                return;
            }

            const registrationData = {
                eventId: event.id,
                userEmail: email,
                userName: name,
                responses: formData,
                status: 'confirmed' as const,
                ticketCount: 1, // Default to 1 for generic RSVP
                userId: user?.uid,
                createdAt: Timestamp.now()
            };

            await EventsService.registerForEvent(registrationData);
            setSuccess(true);
        } catch (err: any) {
            console.error('Registration failed:', err);
            setError(err.message || 'Failed to register. Please try again.');
        } finally {
            if (!config.ticketPrice || config.ticketPrice <= 0) {
                setLoading(false);
            }
        }
    };

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [fieldId]: value
        }));
    };

    const resetForm = () => {
        setSuccess(false);
        setFormData({});
        setShowPayment(false);
        setName('');
        setEmail('');
        setError(null);
        onClose();
    };

    const handlePaymentSuccess = () => {
        setSuccess(true);
        setShowPayment(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && resetForm()}>
            <DialogContent className={`sm:max-w-[500px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-gray-100 max-h-[90vh] overflow-y-auto ${showPayment && config.ticketPrice ? 'p-0 gap-0' : 'p-6'}`}>
                {showPayment && config.ticketPrice ? (
                    <EventPaymentModal
                        eventId={event.id}
                        eventTitle={event.title}
                        ticketType="General Admission"
                        ticketPrice={config.ticketPrice}
                        quantity={1}
                        dateLabel={event.startDate.toDate().toLocaleDateString()}
                        registrationData={{
                            name,
                            email,
                            answers: formData,
                            userId: user?.uid,
                        }}
                        onSuccess={handlePaymentSuccess}
                        onBack={() => setShowPayment(false)}
                    />
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold flex flex-col gap-1 items-start">
                                {success ? 'Registration Confirmed!' : `Register for ${event.title}`}
                            </DialogTitle>
                            {!success && (
                                <DialogDescription className="text-gray-500 dark:text-gray-400">
                                    Fill out the details below to secure your spot.
                                </DialogDescription>
                            )}
                        </DialogHeader>

                        {success ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-500" />
                                </div>
                                <h3 className="text-xl font-semibold text-center">You're all set, {name.split(' ')[0]}!</h3>
                                <p className="text-center text-gray-500 max-w-xs">
                                    We've sent a confirmation email to <strong>{email}</strong>. We look forward to seeing you there!
                                </p>

                                <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg w-full mt-4 space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                        <Calendar className="w-4 h-4" />

                                        <span>{event.startDate && typeof event.startDate.toDate === 'function' ? event.startDate.toDate().toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }) : 'Date TBD'}</span>
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                    >
                                        <MapPin className="w-4 h-4" />
                                        <span>{event.location}</span>
                                    </a>
                                </div>

                                {/* Group Navigation Tutorial */}
                                <div className="w-full mt-6 space-y-3">
                                    <div className="text-center space-y-1">
                                        <h4 className="font-semibold text-gray-900 dark:text-white">Join the Conversation</h4>
                                        <p className="text-sm text-gray-500">You've been added to the event group!</p>
                                    </div>

                                    <GroupNavigationTutorial />

                                    {event.linkedGroupId && (
                                        <Button
                                            onClick={() => {
                                                onClose();
                                                router.push(`/groups?id=${event.linkedGroupId}`);
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20"
                                        >
                                            <Users className="w-4 h-4 mr-2" />
                                            Go to Group Now
                                        </Button>
                                    )}
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full mt-4">
                                            <Calendar className="w-4 h-4 mr-2" />
                                            Add to Calendar
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700">
                                        <DropdownMenuItem onClick={() => window.open(generateGoogleCalendarUrl(event), '_blank')}>
                                            Google Calendar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => downloadIcsFile(event)}>
                                            Apple Calendar / Outlook (.ics)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button onClick={resetForm} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white">
                                    Close
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                                <div className="space-y-4">
                                    {/* Standard Fields */}
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="bg-white dark:bg-zinc-800"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="bg-white dark:bg-zinc-800"
                                            required
                                        />
                                    </div>

                                    {/* Custom Fields */}
                                    {config.fields.map((field) => (
                                        <div key={field.id} className="space-y-2">
                                            <Label htmlFor={field.id}>
                                                {field.label}
                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </Label>

                                            {field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'number' ? (
                                                <Input
                                                    id={field.id}
                                                    type={field.type}
                                                    placeholder={field.placeholder}
                                                    required={field.required}
                                                    value={formData[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    className="bg-white dark:bg-zinc-800"
                                                />
                                            ) : field.type === 'select' ? (
                                                <Select
                                                    onValueChange={(val) => handleFieldChange(field.id, val)}
                                                    required={field.required}
                                                >
                                                    <SelectTrigger className="bg-white dark:bg-zinc-800">
                                                        <SelectValue placeholder={field.placeholder || "Select an option"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {field.options?.map((opt) => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={field.id}
                                                        checked={formData[field.id] || false}
                                                        onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
                                                        required={field.required}
                                                    />
                                                    <label
                                                        htmlFor={field.id}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                    >
                                                        {field.placeholder || "Yes"}
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {error && (
                                    <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/10 p-3 rounded-md">
                                        {error}
                                    </div>
                                )}

                                {/* Ticket Price Summary */}
                                {config.ticketPrice && config.ticketPrice > 0 && (
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg flex justify-between items-center border border-blue-100 dark:border-blue-800">
                                        <div>
                                            <p className="font-semibold text-blue-900 dark:text-blue-200">Ticket Price</p>
                                            <p className="text-xs text-blue-600 dark:text-blue-300">Payment collected on next step</p>
                                        </div>
                                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: config.currency || 'USD' }).format(config.ticketPrice)}
                                        </div>
                                    </div>
                                )}

                                <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] gap-2" disabled={loading}>
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        {loading ? 'Processing...' : (config.ticketPrice && config.ticketPrice > 0 ? 'Proceed to Payment' : 'Complete Registration')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
