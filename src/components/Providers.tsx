'use client';

import { ThemeProvider } from 'next-themes';
import React from 'react';
import { ChatProvider } from '@/context/ChatContext';
import { FeedProvider } from '@/context/FeedContext';
import { LightboxProvider } from '@/context/LightboxContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <FeedProvider>
                <LightboxProvider>
                    <ChatProvider>
                        {children}
                    </ChatProvider>
                </LightboxProvider>
            </FeedProvider>
        </ThemeProvider>
    );
}
