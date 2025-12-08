'use client';

import { ThemeProvider } from 'next-themes';
import React from 'react';
import { ChatProvider } from '@/context/ChatContext';
import { FeedProvider } from '@/context/FeedContext';
import { LightboxProvider } from '@/context/LightboxContext';
import { AuthProvider } from '@/context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
                <FeedProvider>
                    <LightboxProvider>
                        <ChatProvider>
                            {children}
                        </ChatProvider>
                    </LightboxProvider>
                </FeedProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
