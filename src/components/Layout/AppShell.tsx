'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { BottomBar } from './BottomBar';
import { OnboardingModal } from '@/components/Auth/OnboardingModal';
import { AuthModal } from '@/components/Auth/AuthModal';
import BibleModal from '@/components/Bible/BibleModal';
import BibleStudyModalWrapper from '@/components/Bible/BibleStudyModalWrapper';
import { GlobalLayoutComponents } from './GlobalLayoutComponents';
import { Toaster } from 'sonner';

// Public routes that don't need the full app shell
const PUBLIC_ROUTES = ['/connect'];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

    // For public routes, render children directly without app shell
    if (isPublicRoute) {
        return (
            <>
                {children}
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
