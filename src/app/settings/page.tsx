'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Settings as SettingsIcon, BookOpen, User, Shield, LogOut, Bell } from 'lucide-react';
import BibleSettings from '@/components/Settings/BibleSettings';
import ProfileSettings from '@/components/Settings/ProfileSettings';
import NotificationSettings from '@/components/Settings/NotificationSettings';

export default function SettingsPage() {
    const { user, userData, loading, signOut } = useAuth();
    const router = useRouter();
    const isAdmin = userData?.role === 'admin';

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
                    {/* Admin Settings */}
                    {isAdmin && (
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-5 h-5 text-gray-400" />
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Administration</h2>
                            </div>
                            <div
                                onClick={() => router.push('/admin')}
                                className="cursor-pointer bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 hover:border-purple-500/50 hover:shadow-lg transition-all group"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                            Open Admin Dashboard
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Manage reported content, pinned posts, and third-party integrations.
                                        </p>
                                    </div>
                                    <Shield className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Profile Settings */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <User className="w-5 h-5 text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>
                        </div>
                        <ProfileSettings />
                    </section>

                    {/* Notification Settings */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Bell className="w-5 h-5 text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Notifications</h2>
                        </div>
                        <NotificationSettings />
                    </section>

                    {/* Bible Settings */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="w-5 h-5 text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bible Integration</h2>
                        </div>
                        <BibleSettings />
                    </section>

                    {/* Sign Out */}
                    <section className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <button
                            onClick={signOut}
                            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all font-medium"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Sign Out</span>
                        </button>
                    </section>

                    {/* Debug Section */}
                    {isAdmin && (
                        <section className="pt-8 border-t-2 border-dashed border-red-200 dark:border-red-900/30">
                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
                                <h3 className="text-red-800 dark:text-red-400 font-bold mb-2 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Theme Debugger
                                </h3>
                                <ThemeDebugSection />
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
}

function ThemeDebugSection() {
    const { theme, setTheme, resolvedTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    return (
        <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-white dark:bg-black rounded border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 block">Theme</span>
                    <span className="font-bold text-gray-900 dark:text-white">{theme}</span>
                </div>
                <div className="p-2 bg-white dark:bg-black rounded border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 block">Resolved</span>
                    <span className="font-bold text-gray-900 dark:text-white">{resolvedTheme}</span>
                </div>
                <div className="p-2 bg-white dark:bg-black rounded border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 block">System</span>
                    <span className="font-bold text-gray-900 dark:text-white">{systemTheme}</span>
                </div>
                <div className="p-2 bg-white dark:bg-black rounded border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 block">HTML Class</span>
                    <span className="font-bold text-gray-900 dark:text-white">{document.documentElement.className}</span>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setTheme('light')}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                >
                    Force Light
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                >
                    Force Dark
                </button>
                <button
                    onClick={() => {
                        localStorage.removeItem('theme');
                        window.location.reload();
                    }}
                    className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                >
                    Reset Storage
                </button>
            </div>
        </div>
    );
}

