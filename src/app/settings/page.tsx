'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, BookOpen } from 'lucide-react';
import BibleSettings from '@/components/Settings/BibleSettings';

export default function SettingsPage() {
    const { user, userData, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
                <SettingsIcon className="w-12 h-12 text-gray-300 mb-4" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
                <p className="text-gray-500">Please sign in to manage your settings.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-20 md:pl-64 pt-16 md:pt-0">
            <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <SettingsIcon className="w-7 h-7 text-purple-600" />
                        Settings
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Manage your preferences and connected services.
                    </p>
                </div>

                {/* Sections */}
                <div className="space-y-6">
                    {/* Bible Settings */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="w-5 h-5 text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bible Integration</h2>
                        </div>
                        <BibleSettings />
                    </section>
                </div>
            </main>
        </div>
    );
}
