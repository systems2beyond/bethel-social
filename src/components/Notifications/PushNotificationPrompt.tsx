'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PushNotificationService } from '@/lib/services/PushNotificationService';
import { Bell, BellOff, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PushNotificationPromptProps {
    variant?: 'banner' | 'modal' | 'inline';
    onClose?: () => void;
    showAfterDelay?: number; // Delay in ms before showing
}

export function PushNotificationPrompt({
    variant = 'banner',
    onClose,
    showAfterDelay = 5000
}: PushNotificationPromptProps) {
    const { user } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'denied'>('idle');
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');

    useEffect(() => {
        // Check if notifications are supported and get current status
        const checkStatus = () => {
            const status = PushNotificationService.getPermissionStatus();
            setPermissionStatus(status);

            // Don't show if already granted, denied, or unsupported
            if (status === 'granted' || status === 'denied' || status === 'unsupported') {
                return;
            }

            // Check if user has dismissed this before (store in localStorage)
            const dismissed = localStorage.getItem('pushNotificationPromptDismissed');
            if (dismissed) {
                const dismissedAt = parseInt(dismissed, 10);
                // Show again after 7 days
                if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
                    return;
                }
            }

            // Show prompt after delay
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, showAfterDelay);

            return () => clearTimeout(timer);
        };

        if (user) {
            checkStatus();
        }
    }, [user, showAfterDelay]);

    const handleEnable = async () => {
        if (!user) return;

        setIsLoading(true);
        try {
            const result = await PushNotificationService.setupForUser(user.uid);

            if (result.success) {
                setStatus('success');
                setTimeout(() => {
                    handleClose();
                }, 2000);
            } else if (!result.permissionGranted) {
                setStatus('denied');
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('[PushNotificationPrompt] Error enabling notifications:', error);
            setStatus('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('pushNotificationPromptDismissed', Date.now().toString());
        onClose?.();
    };

    const handleNotNow = () => {
        handleClose();
    };

    if (!isVisible || permissionStatus === 'unsupported') {
        return null;
    }

    if (variant === 'banner') {
        return (
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: -100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -100 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
                    >
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                            {/* Gradient header */}
                            <div className="h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500" />

                            <div className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex-shrink-0">
                                        <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        {status === 'idle' && (
                                            <>
                                                <h3 className="font-bold text-foreground mb-1">
                                                    Enable Push Notifications
                                                </h3>
                                                <p className="text-sm text-muted-foreground mb-3">
                                                    Get notified about new messages, tasks, and updates from your church family.
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        onClick={handleEnable}
                                                        disabled={isLoading}
                                                        size="sm"
                                                        className="bg-orange-600 hover:bg-orange-700 rounded-xl"
                                                    >
                                                        {isLoading ? 'Enabling...' : 'Enable'}
                                                    </Button>
                                                    <Button
                                                        onClick={handleNotNow}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground"
                                                    >
                                                        Not Now
                                                    </Button>
                                                </div>
                                            </>
                                        )}

                                        {status === 'success' && (
                                            <div className="flex items-center gap-2 text-emerald-600">
                                                <CheckCircle className="w-5 h-5" />
                                                <span className="font-medium">Notifications enabled!</span>
                                            </div>
                                        )}

                                        {status === 'denied' && (
                                            <div className="flex items-center gap-2 text-amber-600">
                                                <AlertCircle className="w-5 h-5" />
                                                <span className="text-sm">
                                                    Permission denied. Enable in browser settings to receive notifications.
                                                </span>
                                            </div>
                                        )}

                                        {status === 'error' && (
                                            <div className="flex items-center gap-2 text-red-600">
                                                <AlertCircle className="w-5 h-5" />
                                                <span className="text-sm">
                                                    Something went wrong. Please try again later.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleClose}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
                                    >
                                        <X className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    // Inline variant for settings pages
    if (variant === 'inline') {
        return (
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                        <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">Push Notifications</p>
                        <p className="text-xs text-muted-foreground">
                            {permissionStatus === 'granted'
                                ? 'Enabled - You will receive push notifications'
                                : 'Get notified about messages and tasks'}
                        </p>
                    </div>
                </div>

                {permissionStatus === 'granted' ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Enabled</span>
                    </div>
                ) : (
                    <Button
                        onClick={handleEnable}
                        disabled={isLoading}
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                    >
                        {isLoading ? 'Enabling...' : 'Enable'}
                    </Button>
                )}
            </div>
        );
    }

    return null;
}

// Hook for using push notifications
export function usePushNotifications() {
    const { user } = useAuth();
    const [isSupported, setIsSupported] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        setIsSupported(PushNotificationService.isSupported());
        setIsEnabled(PushNotificationService.getPermissionStatus() === 'granted');
    }, []);

    const enable = async () => {
        if (!user) return { success: false };

        const result = await PushNotificationService.setupForUser(user.uid);
        setIsEnabled(result.success);
        setToken(result.token);
        return result;
    };

    const disable = async () => {
        if (!user) return;
        await PushNotificationService.disableForUser(user.uid);
        setIsEnabled(false);
        setToken(null);
    };

    return {
        isSupported,
        isEnabled,
        token,
        enable,
        disable,
        permissionStatus: PushNotificationService.getPermissionStatus()
    };
}
