'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { X, Calendar, Loader2, Check, Video, Clock, Type, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserInvitationGrid, { PublicUser } from './UserInvitationGrid';
import ResourcePicker from './ResourcePicker';
import { Scroll } from 'lucide-react';

interface CreateMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTopic?: string;
    initialDate?: string; // ISO string or similar
    initialDescription?: string;
}

import { useBible } from '@/context/BibleContext';

export default function CreateMeetingModal({ isOpen, onClose, initialTopic = '', initialDate, initialDescription = '' }: CreateMeetingModalProps) {
    const { googleAccessToken, user, signInWithGoogle, clearGmailToken } = useAuth();
    const { openCollaboration } = useBible();
    const [topic, setTopic] = useState(initialTopic);
    const [startTime, setStartTime] = useState('');
    const [description, setDescription] = useState(initialDescription); // Added state
    const [selectedUsers, setSelectedUsers] = useState<PublicUser[]>([]); // Refactored to hold User Objects
    const [attendeesText, setAttendeesText] = useState(''); // Fallback for external emails
    const [loading, setLoading] = useState(false);
    const [successLink, setSuccessLink] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [linkedResource, setLinkedResource] = useState<{ id: string, title: string, type: 'scroll' | 'sermon' } | null>(null);
    const [isPickingResource, setIsPickingResource] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTopic(initialTopic);
            setDescription(initialDescription || ''); // Reset description
            setAttendeesText('');
            setSelectedUsers([]);
            // Format initialDate to datetime-local friendly string (YYYY-MM-DDThh:mm)
            if (initialDate) {
                try {
                    const d = new Date(initialDate);
                    // Handle offset manually or use simple slice if UTC not confusing
                    // For now simplicity: local time
                    const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    setStartTime(localIso);
                } catch (e) {
                    setStartTime(new Date().toISOString().slice(0, 16));
                }
            } else {
                setStartTime(new Date().toISOString().slice(0, 16));
            }
            setSuccessLink(null);
            setError('');
            setLinkedResource(null);
            setIsPickingResource(false);
        }
    }, [isOpen, initialTopic, initialDate]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Parse attendees
        // Parse manual attendees
        const manualAttendees = attendeesText
            .split(/[,\n;]/)
            .map(email => email.trim())
            .filter(email => email.length > 0 && email.includes('@'));

        // Merge without duplicates (Emails)
        // selectedUsers are objects now, so map to email
        const selectedUserEmails = selectedUsers.map(u => u.email).filter((e): e is string => !!e);
        const attendees = Array.from(new Set([...selectedUserEmails, ...manualAttendees]));

        // Extract UIDs for Push Notifications
        const attendeeUids = selectedUsers.map(u => u.uid);

        let generatedMeetLink = '';
        let externalEventId = '';

        // --- CLIENT-SIDE GOOGLE MEET GENERATION ---
        // We create the event on the User's calendar to generate a valid Meet link.
        if (googleAccessToken) {
            try {
                const eventBody = {
                    summary: topic || 'New Meeting',
                    description: description || '', // Use state
                    start: { dateTime: new Date(startTime).toISOString() },
                    end: { dateTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString() }, // 1h default
                    conferenceData: {
                        createRequest: {
                            requestId: Math.random().toString(36).substring(7),
                            conferenceSolutionKey: { type: 'hangoutsMeet' }
                        }
                    }
                    // NOTE: We do not add attendees here to avoid Google sending automatic invites.
                    // We handle invites via our custom Gmail API call below.
                };

                const gcalResp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${googleAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(eventBody)
                });

                if (gcalResp.ok) {
                    const gcalData = await gcalResp.json();
                    generatedMeetLink = gcalData.hangoutLink || '';
                    externalEventId = gcalData.id || '';
                    console.log('Client-side GCal Success. Link:', generatedMeetLink);
                } else {
                    const errText = await gcalResp.text();
                    console.error('Client-side GCal Failed:', errText);

                    if (gcalResp.status === 403 || gcalResp.status === 401) {
                        alert("We need permission to create Google Calendar events. Please click 'Authorize' to grant access.");
                        clearGmailToken();
                        setLoading(false);
                        return;
                    }
                }
            } catch (gcalErr) {
                console.error('Client-side GCal Exception:', gcalErr);
            }
        }

        try {
            const createMeetingFn = httpsCallable(functions, 'createMeeting');
            const result: any = await createMeetingFn({
                topic,
                startTime: new Date(startTime).toISOString(),
                attendees, // List of emails for record keeping
                attendeeUids, // List of UIDs for Push Notifications
                description: description, // Use state
                linkedResourceId: linkedResource?.id,
                linkedResourceType: linkedResource?.type,
                meetLink: generatedMeetLink, // Pass the client-generated link
                externalEventId // Pass the GCal ID
            });

            const { meetLink, meetingId } = result.data;
            setSuccessLink(meetLink || 'manual');

            // AUTO-JOIN COLLABORATION SESSION
            // This ensures the host is immediately in the correct context to share the meeting ID
            if (meetingId) {
                console.log('[CreateMeetingModal] SUCCESS: Meeting Created with ID:', meetingId);
                console.log('[CreateMeetingModal] Auto-joining meeting session now...');
                // We use a slight delay or immediate call? Immediate is fine as long as modal doesn't unmount context.
                // The modal is inside the layout which has the provider, so it should be fine.
                openCollaboration(`meeting-${meetingId}-notes`, topic || 'Meeting Notes');
                console.log('[CreateMeetingModal] openCollaboration called with:', `meeting-${meetingId}-notes`);
            } else {
                console.error('[CreateMeetingModal] WARNING: meetingId missing in result!', result.data);
            }

            // --- CLIENT-SIDE GMAIL SENDING ---
            // Backend invite often fails due to service limits.
            // We use the user's Gmail scope (already granted) to send the invite directly.
            if (googleAccessToken && attendees.length > 0) {
                try {
                    console.log("Attempting to send invites via Gmail API...");

                    const subject = `Invitation: ${topic}`;
                    const body = `You are invited to a meeting.\n\nTopic: ${topic}\nTime: ${new Date(startTime).toLocaleString()}\nLink: ${meetLink}\n\nNotes/Description:\n${description || 'No additional notes.'}`;

                    // Construct MIME message
                    const emailLines = [];
                    emailLines.push(`From: "Bethel Social" <${user?.email}>`);
                    emailLines.push(`To: ${attendees.join(', ')}`);
                    emailLines.push(`Subject: ${subject}`);
                    emailLines.push("Content-Type: text/plain; charset=utf-8");
                    emailLines.push("MIME-Version: 1.0");
                    emailLines.push("");
                    emailLines.push(body);

                    const raw = btoa(emailLines.join("\r\n")).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${googleAccessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ raw })
                    });

                    if (!resp.ok) {
                        const errSort = await resp.json();
                        console.error("Gmail API Error:", errSort);

                        // Handle Token Expiry
                        // Handle Token Expiry
                        if (resp.status === 401) {
                            alert("Your Gmail session has expired. Please click 'Authorize Gmail' again to send usage invites.");
                            clearGmailToken(); // Reset token to show Authorize button
                            // Don't return, allow the modal to show success state (link created)
                        } else {
                            alert(`Failed to send email invite: ${errSort.error?.message || 'Unknown error'}`);
                        }
                    } else {
                        console.log("Invites sent successfully via Gmail API!");
                        alert(`Done! Invitations sent to ${attendees.length} people via your Gmail.`);
                    }
                } catch (emailErr: any) {
                    console.error("Failed to send Gmail invites client-side:", emailErr);
                    alert(`Invitation Error: ${emailErr.message}`);
                }
            } else if (attendees.length > 0 && !googleAccessToken) {
                alert("Note: Email invitations could not be sent because you are not signed in with Google, or permission was denied. The meeting was created, but please share the link manually.");
            }
        } catch (err: any) {
            console.error('Meeting Create Error:', err);
            setError(err.message || 'Failed to create meeting. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.classList.add('modal-open');
        }
        return () => {
            document.body.classList.remove('modal-open');
            setMounted(false);
        };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="relative z-[50000]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop - Independent fixed layer */}
            <div
                className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
                aria-hidden="true"
                onClick={onClose}
            />

            {/* Scroll Container - Independent fixed layer sitting on top */}
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 text-left shadow-xl transition-all sm:my-8 w-full max-w-md border border-gray-100 dark:border-zinc-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Video className="w-5 h-5 text-blue-600" />
                                Schedule Meeting <span className="text-[10px] bg-red-500 text-white px-1 rounded">v2</span>
                            </h3>
                            <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            {successLink ? (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Meeting Created!</h4>
                                    {successLink === 'manual' ? (
                                        <>
                                            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                                                Meeting created, but we couldn't generate a link automatically. Please create one manually.
                                            </p>
                                            <a
                                                href="https://meet.google.com/new"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors mb-3"
                                            >
                                                Create Manual Google Meet
                                            </a>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                                                Your meeting is scheduled. Go to the lobby to start it when you're ready.
                                            </p>
                                            <a
                                                href={successLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors mb-3"
                                            >
                                                Go to Meeting Lobby
                                            </a>
                                        </>
                                    )}
                                    <button
                                        onClick={onClose}
                                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Type className="w-3.5 h-3.5" /> Topic
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="e.g. Weekly Fellowship"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" /> Date & Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:[color-scheme:dark]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Type className="w-3.5 h-3.5" /> Description / Notes
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-sm"
                                            placeholder="Add an agenda or personal note for the invitees..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Type className="w-3.5 h-3.5" /> Attendees ({selectedUsers.length} selected)
                                        </label>

                                        {/* Visual Grid */}
                                        <UserInvitationGrid
                                            selectedUsers={selectedUsers}
                                            onSelectionChange={setSelectedUsers}
                                        />

                                        {/* Manual Input */}
                                        <div className="mt-3">
                                            <input
                                                type="text"
                                                value={attendeesText}
                                                onChange={(e) => setAttendeesText(e.target.value)}
                                                placeholder="Add external emails (comma separated)..."
                                                className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
                                                Selected: {selectedUsers.length} users • Manual: {attendeesText ? 'Active' : 'Empty'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Resource Linking */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Scroll className="w-3.5 h-3.5" /> Attached Resource (Optional)
                                        </label>

                                        {isPickingResource ? (
                                            <div className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-200 dark:border-zinc-700">
                                                <ResourcePicker
                                                    onSelect={(r) => {
                                                        setLinkedResource(r);
                                                        setIsPickingResource(false);
                                                    }}
                                                    onCancel={() => setIsPickingResource(false)}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {linkedResource ? (
                                                    <div className="flex-1 flex items-center justify-between p-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg shrink-0">
                                                                <Scroll className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                            </div>
                                                            <span className="text-sm font-medium text-purple-900 dark:text-purple-100 truncate">
                                                                {linkedResource.title}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setLinkedResource(null)}
                                                            className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-lg text-purple-600 dark:text-purple-400"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsPickingResource(true)}
                                                        className="w-full py-2.5 px-3 border border-dashed border-gray-300 dark:border-zinc-700 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-400 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Scroll className="w-4 h-4" />
                                                        Attach a Scroll or Bible Study
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {error && (
                                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
                                            <X className="w-4 h-4 shrink-0" />
                                            {error}
                                        </div>
                                    )}

                                    {/* Auth Warning for Invites */}
                                    {!googleAccessToken && (selectedUsers.length > 0 || attendeesText.length > 0) && (
                                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                                            <div className="flex items-start gap-2">
                                                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-full shrink-0">
                                                    <Mail className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-100">Permission Needed</h4>
                                                    <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                                                        To send email invitations, you need to grant Gmail permission again.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => signInWithGoogle()}
                                                        className="mt-2 w-full py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 text-xs font-medium rounded-lg transition-colors"
                                                    >
                                                        Authorize Gmail
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleCreate}
                                        disabled={loading}
                                        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Scheduling...
                                            </>
                                        ) : (
                                            <>
                                                <Calendar className="w-4 h-4" />
                                                Schedule Meeting
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
