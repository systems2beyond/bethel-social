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
    Users
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

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setSubject('');
            setMessage('');
            setProgress(null);
            setIsMinimized(false);
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

        if (recipients.length === 0) {
            toast.error('No recipients selected');
            return;
        }

        setSending(true);
        const progressState: SendingProgress = {
            total: recipients.length,
            sent: 0,
            failed: 0,
            current: '',
            isComplete: false,
            errors: []
        };
        setProgress(progressState);

        // Process in batches
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const batch = recipients.slice(i, i + BATCH_SIZE);

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
            if (i + BATCH_SIZE < recipients.length) {
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
            <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 p-4 w-80">
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
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {isEmail ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                            Send Bulk {isEmail ? 'Email' : 'Message'}
                        </DialogTitle>
                        <DialogDescription>
                            Send to {recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'}
                        </DialogDescription>
                    </DialogHeader>

                    {progress ? (
                        <div className="py-6 space-y-4">
                            <div className="flex items-center justify-center mb-4">
                                {progress.isComplete ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                                        <span className="font-medium">
                                            {progress.failed === 0 ? 'All messages sent!' : 'Sending complete'}
                                        </span>
                                    </div>
                                ) : (
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                )}
                            </div>

                            <Progress value={progressPercent} className="h-3" />

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
                        <div className="space-y-4 py-4">
                            {/* Message Type Toggle */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className={`h-4 w-4 ${!isEmail ? 'text-blue-500' : 'text-muted-foreground'}`} />
                                    <span className={!isEmail ? 'font-medium' : 'text-muted-foreground'}>
                                        In-App Message
                                    </span>
                                </div>
                                <Switch
                                    checked={isEmail}
                                    onCheckedChange={setIsEmail}
                                />
                                <div className="flex items-center gap-2">
                                    <span className={isEmail ? 'font-medium' : 'text-muted-foreground'}>
                                        Email
                                    </span>
                                    <Mail className={`h-4 w-4 ${isEmail ? 'text-blue-500' : 'text-muted-foreground'}`} />
                                </div>
                            </div>

                            {/* Recipients Preview */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Recipients ({recipients.length})
                                </Label>
                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                    {recipients.slice(0, 10).map(r => (
                                        <Badge key={r.uid} variant="secondary" className="text-xs">
                                            {r.displayName || r.email}
                                        </Badge>
                                    ))}
                                    {recipients.length > 10 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{recipients.length - 10} more
                                        </Badge>
                                    )}
                                </div>
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
                                    Send to {recipients.length} {recipients.length === 1 ? 'person' : 'people'}
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
