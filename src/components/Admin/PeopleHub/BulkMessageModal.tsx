"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
    ChevronUp,
    Search
} from "lucide-react";
import { FirestoreUser } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createPortal } from 'react-dom';

interface BulkMessageModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    recipients: FirestoreUser[];
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

// Gmail rate limits: ~100 emails/day for regular accounts, ~500 for Google Workspace
// We'll batch at 10 emails per batch with 2 second delays to be safe
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

export const BulkMessageModal: React.FC<BulkMessageModalProps> = ({
    open,
    onOpenChange,
    recipients,
    onSuccess
}) => {
    const { user, userData, googleAccessToken, signInWithGoogle } = useAuth();
    const [isEmail, setIsEmail] = useState(true);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState<SendingProgress | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [recipientsExpanded, setRecipientsExpanded] = useState(false);
    const [recipientSearch, setRecipientSearch] = useState('');

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setSubject('');
            setMessage('');
            setProgress(null);
            setIsMinimized(false);
            setRecipientsExpanded(false);
            setRecipientSearch('');
        }
    }, [open]);

    const sendEmail = async (recipient: FirestoreUser, token: string): Promise<boolean> => {
        if (!recipient.email) return false;

        try {
            const emailContent = [
                `To: ${recipient.email}`,
                `Subject: ${subject}`,
                'Content-Type: text/plain; charset=utf-8',
                '',
                message
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

            // Add message
            await addDoc(collection(db, 'direct_messages', conversationId, 'messages'), {
                conversationId,
                author: {
                    id: user.uid,
                    name: userData?.displayName || user.displayName || 'Admin',
                    avatarUrl: user.photoURL
                },
                content: message,
                type: 'text',
                timestamp: Date.now()
            });

            // Update conversation meta
            await updateDoc(doc(db, 'direct_messages', conversationId), {
                lastMessage: message.substring(0, 100),
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
        if (!message.trim()) {
            toast.error('Please enter a message');
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

        // Filter to valid recipients based on message type
        const validRecipients = isEmail
            ? recipients.filter(r => r.email)
            : recipients;

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

            // Delay between batches (not after the last batch)
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

    // Floating progress indicator when minimized
    const FloatingProgress = () => {
        if (!isMinimized || !progress) return null;

        return createPortal(
            <div className="fixed bottom-4 right-4 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-gray-200/50 dark:border-zinc-700/50 p-4 w-80">
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
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                    <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className={`p-2 rounded-xl ${isEmail ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                {isEmail ? <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />}
                            </div>
                            Send Bulk {isEmail ? 'Email' : 'Message'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Send to {recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'}
                        </DialogDescription>
                    </DialogHeader>

                    {progress ? (
                        <div className="py-8 space-y-6">
                            <div className="flex items-center justify-center mb-6">
                                {progress.isComplete ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                                        </div>
                                        <span className="font-semibold text-lg">
                                            {progress.failed === 0 ? 'All messages sent!' : 'Sending complete'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                    </div>
                                )}
                            </div>

                            <Progress value={progressPercent} className="h-3 rounded-full" />

                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {progress.sent} sent
                                </span>
                                {progress.failed > 0 && (
                                    <span className="flex items-center gap-1 text-red-600">
                                        <AlertCircle className="h-4 w-4" />
                                        {progress.failed} failed
                                    </span>
                                )}
                                <span className="text-muted-foreground">
                                    {progress.sent + progress.failed} / {progress.total}
                                </span>
                            </div>

                            {progress.current && (
                                <p className="text-sm text-muted-foreground text-center">
                                    Currently sending to: {progress.current}
                                </p>
                            )}

                            {progress.errors.length > 0 && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                                        Failed to send to:
                                    </p>
                                    <div className="text-xs text-red-600 dark:text-red-300 max-h-20 overflow-y-auto">
                                        {progress.errors.join(', ')}
                                    </div>
                                </div>
                            )}

                            {sending && (
                                <div className="flex justify-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsMinimized(true)}
                                    >
                                        <Minimize2 className="h-4 w-4 mr-2" />
                                        Minimize
                                    </Button>
                                </div>
                            )}

                            {progress.isComplete && (
                                <DialogFooter>
                                    <Button onClick={() => onOpenChange(false)}>
                                        Close
                                    </Button>
                                </DialogFooter>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5 py-4">
                            {/* Message Type Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-zinc-800/80 dark:to-zinc-800/50 rounded-xl border border-gray-200/50 dark:border-zinc-700/50">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg transition-colors duration-200 ${!isEmail ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200/50 dark:bg-zinc-700/50'}`}>
                                        <MessageSquare className={`h-4 w-4 transition-colors duration-200 ${!isEmail ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                                    </div>
                                    <span className={`text-sm transition-colors duration-200 ${!isEmail ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                        In-App Message
                                    </span>
                                </div>
                                <Switch
                                    checked={isEmail}
                                    onCheckedChange={setIsEmail}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm transition-colors duration-200 ${isEmail ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                        Email
                                    </span>
                                    <div className={`p-1.5 rounded-lg transition-colors duration-200 ${isEmail ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-200/50 dark:bg-zinc-700/50'}`}>
                                        <Mail className={`h-4 w-4 transition-colors duration-200 ${isEmail ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Recipients Preview - Collapsible Smart Summary */}
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setRecipientsExpanded(!recipientsExpanded)}
                                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-zinc-800/80 dark:to-zinc-800/50 rounded-xl border border-gray-200/50 dark:border-zinc-700/50 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all duration-200"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-sm">
                                                {recipients.length} {recipients.length === 1 ? 'Recipient' : 'Recipients'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {isEmail ? (
                                                    <>
                                                        {recipients.filter(r => r.email).length} with email
                                                        {recipients.filter(r => !r.email).length > 0 && (
                                                            <span className="text-amber-600 dark:text-amber-400 ml-1">
                                                                • {recipients.filter(r => !r.email).length} missing email
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    'In-app direct messages'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                            {recipientsExpanded ? 'Hide' : 'View'}
                                        </span>
                                        {recipientsExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {/* Expanded Recipients List */}
                                {recipientsExpanded && (
                                    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                        {/* Search */}
                                        <div className="p-2 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search recipients..."
                                                    value={recipientSearch}
                                                    onChange={(e) => setRecipientSearch(e.target.value)}
                                                    className="pl-8 h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                        {/* List */}
                                        <div className="max-h-48 overflow-y-auto">
                                            {recipients
                                                .filter(r => {
                                                    if (!recipientSearch) return true;
                                                    const search = recipientSearch.toLowerCase();
                                                    return (
                                                        r.displayName?.toLowerCase().includes(search) ||
                                                        r.email?.toLowerCase().includes(search)
                                                    );
                                                })
                                                .map(r => (
                                                    <div
                                                        key={r.uid}
                                                        className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0 text-sm"
                                                    >
                                                        <span className="truncate">
                                                            {r.displayName || 'No name'}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground truncate ml-2">
                                                            {isEmail ? (
                                                                r.email || <span className="text-amber-600">No email</span>
                                                            ) : null}
                                                        </span>
                                                    </div>
                                                ))}
                                            {recipients.filter(r => {
                                                if (!recipientSearch) return true;
                                                const search = recipientSearch.toLowerCase();
                                                return (
                                                    r.displayName?.toLowerCase().includes(search) ||
                                                    r.email?.toLowerCase().includes(search)
                                                );
                                            }).length === 0 && (
                                                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                                    No recipients match your search
                                                </div>
                                            )}
                                        </div>
                                        {/* Footer stats */}
                                        <div className="px-3 py-2 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs text-muted-foreground flex justify-between">
                                            <span>Total: {recipients.length}</span>
                                            {isEmail && recipients.filter(r => !r.email).length > 0 && (
                                                <span className="text-amber-600 dark:text-amber-400">
                                                    {recipients.filter(r => !r.email).length} will be skipped (no email)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Email Subject (only for email) */}
                            {isEmail && (
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="Enter email subject..."
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Message */}
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder={isEmail ? "Enter your email message..." : "Enter your message..."}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="min-h-[150px]"
                                />
                            </div>

                            {/* Gmail Warning */}
                            {isEmail && !googleAccessToken && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                                        <div className="text-sm">
                                            <p className="font-medium text-amber-700 dark:text-amber-400">
                                                Gmail access required
                                            </p>
                                            <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                                                Sign in with Google to send emails via Gmail API.
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-2"
                                                onClick={() => signInWithGoogle()}
                                            >
                                                Sign in with Google
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rate Limit Info */}
                            {isEmail && recipients.length > 10 && (
                                <p className="text-xs text-muted-foreground">
                                    Emails will be sent in batches of {BATCH_SIZE} with delays to respect Gmail rate limits.
                                </p>
                            )}

                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSend}
                                    disabled={!message.trim() || (isEmail && !subject.trim()) || (isEmail && !googleAccessToken)}
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send to {isEmail ? recipients.filter(r => r.email).length : recipients.length} {(isEmail ? recipients.filter(r => r.email).length : recipients.length) === 1 ? 'person' : 'people'}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <FloatingProgress />
        </>
    );
};
