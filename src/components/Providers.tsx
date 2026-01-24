'use client';

import { ThemeProvider } from 'next-themes';
import React from 'react';
import { ChatProvider } from '@/context/ChatContext';
import { FeedProvider } from '@/context/FeedContext';
import { LightboxProvider } from '@/context/LightboxContext';
import { AuthProvider } from '@/context/AuthContext';
import { ActivityProvider } from '@/context/ActivityContext';
import { BibleProvider } from '@/context/BibleContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            themes={['light', 'dark']}
            value={{
                light: 'light',
                dark: 'dark'
            }}
            disableTransitionOnChange
            storageKey="church-theme-preference-v10"
        >
            <AuthProvider>
                <ActivityProvider>
                    <FeedProvider>
                        <LightboxProvider>
                            <BibleProvider>
                                <ChatProvider>
                                    {children}
                                </ChatProvider>
                            </BibleProvider>
                        </LightboxProvider>
                    </FeedProvider>
                </ActivityProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
