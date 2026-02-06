'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { BottomBar } from './BottomBar';
import { OnboardingModal } from '@/components/Auth/OnboardingModal';
import { AuthModal } from '@/components/Auth/AuthModal';
import BibleModal from '@/components/Bible/BibleModal';
import BibleStudyModalWrapper from '@/components/Bible/BibleStudyModalWrapper';
import { GlobalLayoutComponents } from './GlobalLayoutComponents';
import { Toaster, toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { PulpitService } from '@/lib/services/PulpitService';

// Public routes that don't need the full app shell
const PUBLIC_ROUTES = ['/connect', '/connect-form', '/pulpit', '/register'];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { userData } = useAuth();
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));
    const lastAlertIdRef = useRef<string | null>(null);
    const isInitialLoadRef = useRef(true);

    // Subscribe to urgent alerts for admin users - show toast notifications
    useEffect(() => {
        // Only subscribe for admin roles
        const adminRoles = ['admin', 'super_admin', 'pastor_admin', 'media_admin'];
        if (!userData?.churchId || !adminRoles.includes(userData?.role || '')) {
            return;
        }

        const unsubscribe = PulpitService.streamAlerts(userData.churchId, (alerts) => {
            // Filter to urgent/critical only
            const urgentAlerts = alerts.filter(a =>
                a.type === 'urgent' || a.priority === 'critical'
            );

            if (urgentAlerts.length > 0) {
                const latestAlert = urgentAlerts[0];

                // Skip showing toast on initial load
                if (isInitialLoadRef.current) {
                    isInitialLoadRef.current = false;
                    lastAlertIdRef.current = latestAlert.id;
                    return;
                }

                // Show toast only for NEW alerts
                if (latestAlert.id !== lastAlertIdRef.current) {
                    lastAlertIdRef.current = latestAlert.id;
                    toast.error(latestAlert.message, {
                        description: `Urgent alert from ${latestAlert.fromName || 'Staff'}`,
                        duration: 10000, // 10 seconds for urgent messages
                    });
                }
            }
        });

        return () => {
            unsubscribe();
            isInitialLoadRef.current = true;
        };
    }, [userData?.churchId, userData?.role]);

    // For public routes, render children directly without app shell
    // But still include BibleModal for routes that need it (like /pulpit)
    if (isPublicRoute) {
        const needsBibleModal = pathname?.startsWith('/pulpit');
        return (
            <>
                {children}
                {needsBibleModal && <BibleModal />}
                <Toaster />
            </>
        );
    }

    // For authenticated routes, render full app shell
    return (
        <>
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar - Responsive */}
                <Sidebar />

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col relative min-w-0 transition-colors duration-300">
                    {/* Scrollable Feed Area */}
                    <div className="flex-1 overflow-y-auto scroll-smooth pb-24">
                        <div className="max-w-4xl mx-auto w-full">
                            {children}
                        </div>
                    </div>

                    {/* Fixed Bottom Input Bar */}
                    <BottomBar />
                </main>
            </div>
            <OnboardingModal />
            <AuthModal />
            <BibleModal />
            <BibleStudyModalWrapper />
            <GlobalLayoutComponents />
            <Toaster />
        </>
    );
}
