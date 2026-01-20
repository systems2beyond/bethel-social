'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { EventsService } from '@/lib/services/EventsService';
import { Event, EventRegistration } from '@/types';
import { ArrowLeft, Download, Search, Mail, Ticket, Calendar, User, Clock, Send, AlertCircle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import EventAnalytics from '@/components/Admin/Events/EventAnalytics';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

export default function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRegistration, setSelectedRegistration] = useState<EventRegistration | null>(null);

    // Email State
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const [eventData, registrationsData] = await Promise.all([
                EventsService.getEvent(id),
                EventsService.getEventRegistrations(id)
            ]);
            setEvent(eventData);
            setRegistrations(registrationsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredRegistrations = registrations.filter(reg =>
        (reg.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (reg.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const exportToCSV = () => {
        if (!registrations.length) return;

        // Collect all unique custom field keys
        const customFieldKeys = Array.from(new Set(
            registrations.flatMap(r => Object.keys(r.responses || {}))
        ));

        // Create Header Row
        const headers = ['Name', 'Email', 'Date Registered', 'Ticket Count', 'Status', ...customFieldKeys];

        // Create Data Rows
        const rows = registrations.map(reg => [
            reg.userName,
            reg.userEmail,
            reg.createdAt.toDate().toLocaleDateString(),
            reg.ticketCount || 1,
            reg.status,
            ...customFieldKeys.map(key => {
                const val = reg.responses?.[key];
                return typeof val === 'object' ? JSON.stringify(val) : val || '';
            }) // Map custom fields
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${event?.title || 'event'}_registrations.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendBroadcast = async (testMode = false) => {
        if (!emailSubject || !emailBody) {
            toast.error('Please fill in both subject and message.');
            return;
        }

        setIsSending(true);
        try {
            const sendBroadcast = httpsCallable(functions, 'sendEventBroadcast');
            const result: any = await sendBroadcast({
                eventId: id,
                subject: emailSubject,
                message: emailBody,
                testMode
            });

            if (result.data.success) {
                toast.success(testMode ? 'Test email sent to you!' : `Broadcast sent to ${result.data.count} attendees!`);
                if (!testMode) {
                    setIsEmailDialogOpen(false);
                    setEmailSubject('');
                    setEmailBody('');
                }
            } else {
                toast.error('Failed to send broadcast.');
            }
        } catch (error: any) {
            console.error('Broadcast failed:', error);
            toast.error(error.message || 'Failed to send broadcast.');
        } finally {
            setIsSending(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    if (!event) return <div className="p-10">Event not found</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">{event.title}</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={exportToCSV}
                        disabled={registrations.length === 0}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => setIsEmailDialogOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        Email Attendees
                    </button>
                </div>
            </div>

            {/* Analytics Section */}
            <div className="space-y-6">
                <EventAnalytics event={event} registrations={registrations} />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

            {/* Attendees Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Attendees List ({registrations.length})
                    </h2>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {/* List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Registration Date</th>
                                    <th className="px-6 py-4">Ticket Count</th>
                                    <th className="px-6 py-4 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredRegistrations.length > 0 ? (
                                    filteredRegistrations.map((reg) => (
                                        <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{reg.userName}</td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <Mail className="w-3 h-3" />
                                                {reg.userEmail}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                {format(reg.createdAt.toDate(), 'PP p')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {reg.ticketCount || 1} Ticket{reg.ticketCount !== 1 && 's'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {/* Details Button Placeholder - Could open a modal for custom answers */}
                                                {reg.responses && Object.keys(reg.responses).length > 0 && (
                                                    <button className="text-blue-600 hover:underline text-xs" onClick={() => setSelectedRegistration(reg)}>
                                                        View Responses
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No registrations found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Dialog open={!!selectedRegistration} onOpenChange={(open) => !open && setSelectedRegistration(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registration Details</DialogTitle>
                        <DialogDescription>
                            Responses for {selectedRegistration?.userName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
                        {selectedRegistration?.responses && Object.entries(selectedRegistration.responses).map(([key, value]) => {
                            // Find the label for this field ID
                            const fieldLabel = event?.registrationConfig?.fields?.find(f => f.id === key)?.label || key;
                            return (
                                <div key={key} className="space-y-1">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        {fieldLabel}
                                    </p>
                                    <p className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Email Broadcast Dialog */}
            <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Email Attendees</DialogTitle>
                        <DialogDescription>
                            Send a message to all {registrations.length} registered attendees.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subject</label>
                            <input
                                type="text"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                                placeholder="e.g. Important Event Update"
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Message</label>
                            <textarea
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                                placeholder="Type your message here..."
                                rows={6}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 resize-y"
                            />
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md flex gap-2 items-start text-sm text-yellow-700 dark:text-yellow-400">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <p>
                                Emails are sent via the configured backend service.
                                Please double-check your message before broadcasting.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <button
                            onClick={() => handleSendBroadcast(true)}
                            disabled={isSending}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                        >
                            Send Test (To Me)
                        </button>
                        <button
                            onClick={() => handleSendBroadcast(false)}
                            disabled={isSending}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
                        >
                            {isSending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Broadcast
                                </>
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
