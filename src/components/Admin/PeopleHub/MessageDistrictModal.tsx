"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Mail,
    MessageSquare,
    Send,
    X,
    Minimize2,
    AlertCircle,
    CheckCircle2,
    Users,
    ChevronDown,
    Search,
    Paperclip,
    Image as ImageIcon,
    StickyNote,
    Plus,
    BookOpen,
    Video,
    File
} from "lucide-react";
import { FirestoreUser, Post } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createPortal } from 'react-dom';
import { uploadMedia } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface MessageDistrictModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    recipients: FirestoreUser[];
    districtName?: string;
    onSuccess?: () => void;
}

interface SendingProgress {
    total: number;
    sent: number;
    failed: number;
    current: string;
    isComplete: boolean;
    errors: string[];
}

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

export const MessageDistrictModal: React.FC<MessageDistrictModalProps> = ({
    open,
    onOpenChange,
    recipients,
    districtName,
    onSuccess
}) => {
    // Helper to strip HTML tags for preview
    const stripHtml = (html: string) => {
        if (!html) return '';
        // Create a temporary element to decode entities as well
        if (typeof window !== 'undefined') {
            const tmp = document.createElement("DIV");
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || "";
        }
        // Fallback for SSR
        return html.replace(/<[^>]*>/g, '').trim();
    };

    const { user, userData, googleAccessToken, signInWithGoogle } = useAuth();
    const [isEmail, setIsEmail] = useState(false); // Default to DM for CRM
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState<SendingProgress | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [recipientsExpanded, setRecipientsExpanded] = useState(false);
    const [recipientSearch, setRecipientSearch] = useState('');

    // Media and Files
    const [mediaAttachments, setMediaAttachments] = useState<{ url: string; name: string; type: string }[]>([]); // Images/videos - both modes
    const [fileAttachments, setFileAttachments] = useState<{ url: string; name: string; type: string }[]>([]); // Documents - email only
    const [uploading, setUploading] = useState(false);
    const [selectedNote, setSelectedNote] = useState<any | null>(null);
    const [noteSearch, setNoteSearch] = useState('');
    const [notes, setNotes] = useState<any[]>([]);
    const [showNoteSearch, setShowNoteSearch] = useState(false);

    // Filter to valid recipients based on message type
    const validRecipients = isEmail
        ? recipients.filter(r => r.email)
        : recipients;

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setSubject('');
            setMessage('');
            setProgress(null);
            setIsMinimized(false);
            setRecipientsExpanded(false);
            setRecipientSearch('');
            setMediaAttachments([]);
            setFileAttachments([]);
            setSelectedNote(null);
        }
    }, [open]);

    // Fetch User Notes
    const fetchNotes = async (searchTerm: string) => {
        if (!user?.uid) return;
        try {
            const notesRef = collection(db, `users/${user.uid}/notes`);
            const q = query(
                notesRef,
                orderBy('updatedAt', 'desc'),
                limit(20)
            );
            const snapshot = await getDocs(q);
            const fetchedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (searchTerm) {
                setNotes(fetchedNotes.filter((n: any) =>
                    n.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    n.title?.toLowerCase().includes(searchTerm.toLowerCase())
                ));
            } else {
                setNotes(fetchedNotes);
            }
        } catch (error) {
            console.error("Error fetching notes:", error);
        }
    };

    useEffect(() => {
        if (showNoteSearch) {
            fetchNotes(noteSearch);
        }
    }, [showNoteSearch, noteSearch]);

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if it's a media file (image or video)
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            toast.error('Please upload an image or video');
            return;
        }

        setUploading(true);
        try {
            const url = await uploadMedia(file, 'district_messages');
            setMediaAttachments(prev => [...prev, { url, name: file.name, type: file.type }]);
            toast.success('Media uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload media');
        } finally {
            setUploading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadMedia(file, 'district_messages');
            setFileAttachments(prev => [...prev, { url, name: file.name, type: file.type }]);
            toast.success('File uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const removeMediaAttachment = (index: number) => {
        setMediaAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const removeFileAttachment = (index: number) => {
        setFileAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const sendEmail = async (recipient: FirestoreUser, token: string): Promise<boolean> => {
        if (!recipient.email) return false;

        try {
            // Include attachments and note content in email
            let finalMessage = message;
            if (selectedNote) {
                finalMessage += `\n\n--- Attached Note: ${selectedNote.title || 'Untitled'} ---\n${selectedNote.content}`;
            }
            if (mediaAttachments.length > 0) {
                finalMessage += `\n\nMedia:\n` + mediaAttachments.map(a => `- ${a.name}: ${a.url}`).join('\n');
            }
            if (fileAttachments.length > 0) {
                finalMessage += `\n\nAttached Files:\n` + fileAttachments.map(a => `- ${a.name}: ${a.url}`).join('\n');
            }

            const emailContent = [
                `To: ${recipient.email}`,
                `Subject: ${subject}`,
                'Content-Type: text/plain; charset=utf-8',
                '',
                finalMessage
            ].join('\r\n');

            const base64EncodedEmail = Buffer.from(emailContent)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ raw: base64EncodedEmail })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to send');
            }

            return true;
        } catch (error) {
            console.error(`Failed to send email to ${recipient.email}:`, error);
            return false;
        }
    };

    const sendDirectMessage = async (recipient: FirestoreUser): Promise<boolean> => {
        if (!user || !recipient.uid) return false;

        try {
            // Find or create conversation
            let conversationId: string;

            const q = query(
                collection(db, 'direct_messages'),
                where('participants', 'array-contains', user.uid)
            );
            const snapshot = await getDocs(q);
            const existingConv = snapshot.docs.find(doc => {
                const data = doc.data();
                return data.participants.includes(recipient.uid);
            });

            if (existingConv) {
                conversationId = existingConv.id;
            } else {
                const newConv = await addDoc(collection(db, 'direct_messages'), {
                    participants: [user.uid, recipient.uid],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastMessageTimestamp: serverTimestamp(),
                    lastMessageAuthorId: user.uid,
                    lastMessage: 'Started a conversation'
                });
                conversationId = newConv.id;
            }

            // Prepare extra metadata for message (media, linked scroll)
            const extraData: any = {};
            if (mediaAttachments.length > 0) {
                extraData.attachments = mediaAttachments;
                if (mediaAttachments[0].type.startsWith('image/')) {
                    extraData.mediaUrl = mediaAttachments[0].url;
                }
            }
            if (selectedNote) {
                // Append note content directly to the message for DMs too, or send as structured data if preferred.
                // For now, let's append it to ensuring visibility.
                const noteContent = `\n\n**Attached Note: ${selectedNote.title || 'Untitled'}**\n${selectedNote.content}`;

                // We'll append to the valid message limit if needed, but Firestore handles large strings well enough for notes.
                // We can also add it as metadata if the frontend supports rendering it specially.
                extraData.attachedNoteId = selectedNote.id;
                extraData.attachedNoteTitle = selectedNote.title;
                extraData.attachedNoteContent = selectedNote.content; // Redundant but safe
            }

            // Add message
            await addDoc(collection(db, 'direct_messages', conversationId, 'messages'), {
                conversationId,
                author: {
                    id: user.uid,
                    name: userData?.displayName || user.displayName || 'Admin',
                    avatarUrl: user.photoURL
                },
                content: message,
                type: mediaAttachments.length > 0 ? (mediaAttachments[0].type.startsWith('image/') ? 'image' : 'video') : 'text',
                timestamp: Date.now(),
                ...extraData
            });

            // Create invitation for the note so it appears in "Scrolls"
            if (selectedNote) {
                try {
                    await addDoc(collection(db, 'invitations'), {
                        type: 'note',
                        title: selectedNote.title || 'Untitled Note',
                        previewContent: stripHtml(selectedNote.content || '').substring(0, 150),
                        content: selectedNote.content,
                        resourceId: selectedNote.id,
                        fromUser: {
                            uid: user.uid,
                            displayName: userData?.displayName || user.displayName || 'Admin',
                            photoURL: user.photoURL
                        },
                        toUserId: recipient.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        message: message
                    });
                } catch (inviteError) {
                    console.error("Failed to create invitation for note:", inviteError);
                }
            }

            // Update conversation meta
            await updateDoc(doc(db, 'direct_messages', conversationId), {
                lastMessage: message.substring(0, 100) || (mediaAttachments.length > 0 ? 'Sent media' : (selectedNote ? 'Shared a note' : 'Sent a message')),
                lastMessageTimestamp: Date.now(),
                lastMessageAuthorId: user.uid,
                updatedAt: serverTimestamp(),
                readBy: [user.uid]
            });

            return true;
        } catch (error) {
            console.error(`Failed to send DM to ${recipient.displayName}:`, error);
            return false;
        }
    };

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleSend = async () => {
        const hasContent = message.trim() || mediaAttachments.length > 0 || fileAttachments.length > 0 || selectedNote;
        if (!hasContent) {
            toast.error('Please enter a message or add content');
            return;
        }

        if (isEmail && !subject.trim()) {
            toast.error('Please enter a subject for the email');
            return;
        }

        if (isEmail && !googleAccessToken) {
            toast.error('Please sign in with Google to send emails');
            return;
        }

        if (validRecipients.length === 0) {
            toast.error(isEmail ? 'No recipients have email addresses' : 'No recipients selected');
            return;
        }

        setSending(true);
        const progressState: SendingProgress = {
            total: validRecipients.length,
            sent: 0,
            failed: 0,
            current: '',
            isComplete: false,
            errors: []
        };
        setProgress(progressState);

        // Process in batches
        for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
            const batch = validRecipients.slice(i, i + BATCH_SIZE);

            for (const recipient of batch) {
                progressState.current = recipient.displayName || recipient.email || 'Unknown';
                setProgress({ ...progressState });

                let success: boolean;
                if (isEmail) {
                    success = await sendEmail(recipient, googleAccessToken!);
                } else {
                    success = await sendDirectMessage(recipient);
                }

                if (success) {
                    progressState.sent++;
                } else {
                    progressState.failed++;
                    progressState.errors.push(recipient.displayName || recipient.email || 'Unknown');
                }
                setProgress({ ...progressState });
            }

            if (i + BATCH_SIZE < validRecipients.length) {
                await sleep(BATCH_DELAY_MS);
            }
        }

        progressState.isComplete = true;
        progressState.current = '';
        setProgress({ ...progressState });
        setSending(false);

        if (progressState.failed === 0) {
            toast.success(`Successfully sent ${progressState.sent} ${isEmail ? 'emails' : 'messages'}`);
            onSuccess?.();
        } else {
            toast.warning(`Sent ${progressState.sent}, failed ${progressState.failed}`);
        }
    };

    const handleClose = () => {
        if (sending) {
            setIsMinimized(true);
        } else {
            onOpenChange(false);
        }
    };

    const progressPercent = progress ? Math.round((progress.sent + progress.failed) / progress.total * 100) : 0;

    const FloatingProgress = () => {
        if (!isMinimized || !progress) return null;

        return createPortal(
            <div className="fixed bottom-4 right-4 z-[9999] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-gray-200/50 dark:border-zinc-700/50 p-4 w-80">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        {isEmail ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                        <span className="font-medium text-sm">
                            {progress.isComplete ? 'Complete' : 'Sending...'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setIsMinimized(false)}
                        >
                            <Minimize2 className="h-3 w-3 rotate-180" />
                        </Button>
                        {progress.isComplete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                    setIsMinimized(false);
                                    onOpenChange(false);
                                }}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>
                <Progress value={progressPercent} className="h-2 mb-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {progress.sent} sent
                    </span>
                    {progress.failed > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                            <AlertCircle className="h-3 w-3" />
                            {progress.failed} failed
                        </span>
                    )}
                    <span>{progress.total} total</span>
                </div>
                {progress.current && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                        Sending to: {progress.current}
                    </p>
                )}
            </div>,
            document.body
        );
    };

    if (isMinimized) {
        return <FloatingProgress />;
    }

    return (
        <>
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                    <DialogHeader className="p-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="flex items-center gap-3 text-xl">
                                    <div className={`p-2 rounded-xl ${isEmail ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                                        {isEmail ? <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
                                    </div>
                                    Message {districtName || 'District'}
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground mt-1">
                                    Compose a message to {recipients.length} members
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {progress ? (
                            <div className="py-8 space-y-6">
                                <div className="flex flex-col items-center gap-4 text-center">
                                    {progress.isComplete ? (
                                        <>
                                            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                                                <CheckCircle2 className="h-10 w-10 text-green-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="font-semibold text-lg">Broadcast Complete</h4>
                                                <p className="text-sm text-muted-foreground">The message has been sent to all reachable members.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold">{progressPercent}%</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="font-semibold">Broadcasting Message</h4>
                                                <p className="text-sm text-muted-foreground">Processing recipients in batches...</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Progress value={progressPercent} className="h-2 rounded-full" />
                                    <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        <span className="text-green-500">{progress.sent} Sent</span>
                                        {progress.failed > 0 && <span className="text-red-500">{progress.failed} Failed</span>}
                                        <span>{progress.sent + progress.failed} / {progress.total}</span>
                                    </div>
                                </div>

                                {progress.current && !progress.isComplete && (
                                    <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg flex items-center gap-3 animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <Users className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground">Current recipient:</p>
                                            <p className="text-sm font-medium truncate">{progress.current}</p>
                                        </div>
                                    </div>
                                )}

                                {progress.isComplete && (
                                    <Button className="w-full" onClick={() => onOpenChange(false)}>
                                        Finish
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Type Switcher */}
                                <div className="flex p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl mb-2">
                                    <button
                                        onClick={() => setIsEmail(false)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
                                            !isEmail ? "bg-white dark:bg-zinc-700 shadow-sm text-orange-600 dark:text-orange-400" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                        Direct Message
                                    </button>
                                    <button
                                        onClick={() => setIsEmail(true)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
                                            isEmail ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Mail className="h-4 w-4" />
                                        Email
                                    </button>
                                </div>

                                {/* Recipients info */}
                                <div className="flex items-center justify-between px-1">
                                    <Badge variant="secondary" className="px-2 py-1 rounded-lg flex items-center gap-1.5">
                                        <Users className="h-3 w-3" />
                                        {recipients.length} Recipients
                                    </Badge>
                                    <button
                                        onClick={() => setRecipientsExpanded(!recipientsExpanded)}
                                        className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                                    >
                                        {recipientsExpanded ? 'Hide names' : 'Reveal list'}
                                        <ChevronDown className={cn("h-3 w-3 transition-transform", recipientsExpanded && "rotate-180")} />
                                    </button>
                                </div>

                                {recipientsExpanded && (
                                    <div className="max-h-32 overflow-y-auto p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800 text-xs grid grid-cols-2 gap-2">
                                        {recipients.map(r => (
                                            <div key={r.uid} className="truncate flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                {r.displayName || 'Unnamed'}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Subject */}
                                {isEmail && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2">
                                        <Label htmlFor="subject" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Email Subject</Label>
                                        <Input
                                            id="subject"
                                            placeholder="Enter compelling subject..."
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            className="h-11 rounded-xl"
                                        />
                                    </div>
                                )}

                                {/* Message Content */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="message" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Message Text</Label>
                                        <span className="text-[10px] text-muted-foreground">{message.length} chars</span>
                                    </div>
                                    <Textarea
                                        id="message"
                                        placeholder={isEmail ? "Hi everyone, I wanted to share..." : "Type your broadcast message here..."}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="min-h-[140px] rounded-xl resize-none focus-visible:ring-orange-500"
                                    />
                                </div>

                                {/* Attachments Grid - 2 columns */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Left Column: Media (DM) or Media & Files (Email) */}
                                    <div className="space-y-3">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
                                            {isEmail ? (
                                                <>
                                                    <Paperclip className="h-3 w-3" />
                                                    Media & Files
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon className="h-3 w-3" />
                                                    Media
                                                </>
                                            )}
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {/* Media Attachments */}
                                            {mediaAttachments.map((file, i) => (
                                                <div key={`media-${i}`} className="group relative w-16 h-16 rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center">
                                                    {file.type.startsWith('image/') ? (
                                                        <img src={file.url} alt="upload" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Video className="h-6 w-6 text-purple-400" />
                                                    )}
                                                    <button
                                                        onClick={() => removeMediaAttachment(i)}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {/* File Attachments - Email only */}
                                            {isEmail && fileAttachments.map((file, i) => (
                                                <div key={`file-${i}`} className="group relative w-16 h-16 rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col items-center justify-center">
                                                    <File className="h-5 w-5 text-gray-400" />
                                                    <span className="text-[8px] mt-1 text-muted-foreground truncate w-14 text-center">{file.name}</span>
                                                    <button
                                                        onClick={() => removeFileAttachment(i)}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {/* Upload Button - Media only for DM, any file for Email */}
                                            <label className={cn(
                                                "w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer transition-all",
                                                isEmail
                                                    ? "hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                                                    : "hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/20",
                                                uploading && "opacity-50 pointer-events-none"
                                            )}>
                                                {isEmail ? (
                                                    // Email: Accept any file type
                                                    <input type="file" className="hidden" onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        // Route to appropriate handler based on file type
                                                        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                                                            handleMediaUpload(e);
                                                        } else {
                                                            handleFileUpload(e);
                                                        }
                                                    }} />
                                                ) : (
                                                    // DM: Only accept images and videos
                                                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
                                                )}
                                                {uploading ? (
                                                    <Loader2 className={cn("h-4 w-4 animate-spin", isEmail ? "text-blue-500" : "text-orange-500")} />
                                                ) : (
                                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="text-[8px] mt-1 text-muted-foreground uppercase font-bold">
                                                    {uploading ? 'Busy' : 'Add'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Right Column: Note Selector */}
                                    <div className="space-y-3">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
                                            <StickyNote className="h-3 w-3" />
                                            Attach Note
                                        </Label>

                                        {selectedNote ? (
                                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 relative group animate-in zoom-in-95">
                                                <div className="flex items-start gap-2">
                                                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                                                        <BookOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-100 truncate">
                                                            {selectedNote.title || 'Untitled Note'}
                                                        </p>
                                                        <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 truncate">
                                                            {stripHtml(selectedNote.content).substring(0, 60)}...
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedNote(null)}
                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-white dark:bg-zinc-800 shadow-sm transition-all"
                                                >
                                                    <X className="h-3 w-3 text-red-500" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowNoteSearch(!showNoteSearch)}
                                                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/80 rounded-xl border border-gray-100 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-700 transition-colors text-left"
                                                >
                                                    <span className="text-xs text-muted-foreground italic">Attach a personal note...</span>
                                                    <Plus className="h-3 w-3 text-muted-foreground" />
                                                </button>

                                                {showNoteSearch && (
                                                    <div className="absolute bottom-full mb-2 left-0 w-full z-50 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden">
                                                        <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
                                                            <div className="relative">
                                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                                <Input
                                                                    placeholder="Search notes..."
                                                                    autoFocus
                                                                    className="h-8 pl-7 text-xs rounded-lg"
                                                                    value={noteSearch}
                                                                    onChange={(e) => setNoteSearch(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="max-h-40 overflow-y-auto">
                                                            {notes.length > 0 ? notes.map(note => (
                                                                <button
                                                                    key={note.id}
                                                                    onClick={() => {
                                                                        setSelectedNote(note);
                                                                        setShowNoteSearch(false);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-xs border-b border-gray-100 dark:border-zinc-800 last:border-0"
                                                                >
                                                                    <p className="font-bold truncate">{note.title || 'Untitled'}</p>
                                                                    <p className="text-[10px] text-muted-foreground truncate opacity-70">{stripHtml(note.content).substring(0, 80)}</p>
                                                                </button>
                                                            )) : (
                                                                <p className="text-[10px] text-muted-foreground p-3 text-center">No notes found</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {!progress && (
                        <DialogFooter className="p-6 pt-2 border-t border-gray-100 dark:border-zinc-800 flex sm:justify-between items-center gap-3">
                            <div className="hidden sm:block text-xs text-muted-foreground font-medium">
                                Targeting <span className="text-foreground font-bold">{validRecipients.length}</span> members
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <Button variant="ghost" className="rounded-xl flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSend}
                                    disabled={sending || uploading || (!message.trim() && !mediaAttachments.length && !fileAttachments.length && !selectedNote) || (isEmail && !subject.trim()) || (isEmail && !googleAccessToken)}
                                    className={cn(
                                        "flex-1 sm:flex-none rounded-xl shadow-lg transition-all active:scale-95",
                                        isEmail
                                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                            : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                                    )}
                                >
                                    {sending ? (
                                        <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                                    ) : (
                                        <Send className="h-4 w-4 sm:mr-2" />
                                    )}
                                    <span className="hidden sm:inline">{sending ? 'Sending...' : 'Send Broadcast'}</span>
                                    <span className="sm:hidden">{sending ? 'Sending...' : 'Send'}</span>
                                </Button>
                            </div>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
            <FloatingProgress />
        </>
    );
};
