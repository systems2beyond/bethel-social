'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailComposerProps {
    isOpen: boolean;
    onClose: () => void;
    defaultSubject?: string;
    defaultBody?: string;
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
    isOpen,
    onClose,
    defaultSubject = '',
    defaultBody = ''
}) => {
    const { user, googleAccessToken, signInWithGoogle } = useAuth();
    const [subject, setSubject] = useState(defaultSubject);
    const [body, setBody] = useState(defaultBody);
    const [recipient, setRecipient] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSending(true);

        try {
            let token = googleAccessToken;

            if (!token) {
                // Try to sign in again to get the token
                // Note: This might not work seamlessly inside the modal flow without state management updates
                // For now, we'll show an error if no token is present
                setError("Please sign in with Google again to enable email sending.");
                setSending(false);
                return;
            }

            // Construct the email
            const emailContent = [
                `To: ${recipient}`,
                `Subject: ${subject}`,
                '',
                body
            ].join('\n');

            const base64EncodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    raw: base64EncodedEmail
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to send email');
            }

            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setRecipient('');
            }, 2000);

        } catch (err: any) {
            console.error('Email send error:', err);
            setError(err.message || 'Failed to send email. Please try again.');
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-zinc-800"
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Compose Email</h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                        {success ? (
                            <div className="flex flex-col items-center justify-center py-8 text-green-500">
                                <Send className="w-12 h-12 mb-2" />
                                <p className="font-medium">Email Sent Successfully!</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSend} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">To</label>
                                    <input
                                        type="email"
                                        required
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="recipient@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject</label>
                                    <input
                                        type="text"
                                        required
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Message</label>
                                    <textarea
                                        required
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        rows={6}
                                        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    />
                                </div>

                                {error && (
                                    <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                        {error}
                                    </div>
                                )}

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {sending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Send Email
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
