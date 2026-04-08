'use client';

import React from 'react';
import DonationWidget from '@/components/Giving/DonationForm';
import { useChurch } from '@/context/ChurchContext';

export default function GivingPage() {
    const { church } = useChurch();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center p-4 transition-colors duration-300">
            <div className="w-full max-w-md">
                <DonationWidget />

                <div className="mt-8 text-center text-sm text-gray-400">
                    <p>&copy; {new Date().getFullYear()} {church?.name || 'Church'}. All rights reserved.</p>
                    <p className="mt-1">501(c)(3) Non-Profit Organization.</p>
                </div>
            </div>
        </div>
    );
}
