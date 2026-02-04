'use client';

import React from 'react';
import { MinistryProvider } from '@/context/MinistryContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <MinistryProvider>
            {children}
        </MinistryProvider>
    );
}
