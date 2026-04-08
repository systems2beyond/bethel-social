'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useChurch } from '@/context/ChurchContext';
import {
    Shield,
    LayoutDashboard,
    Building2,
    Plus,
    Settings,
    Loader2,
    Menu,
    X,
    ArrowLeft,
} from 'lucide-react';

const navItems = [
    { label: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
    { label: 'Churches', href: '/super-admin', icon: Building2 },
    { label: 'Onboard New Church', href: '/super-admin/onboard', icon: Plus },
    { label: 'System Logs', href: '#', icon: Settings, disabled: true },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const { user, userData, loading: authLoading } = useAuth();
    const { church, isSwitched, resetChurch } = useChurch();
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Loading state
    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-950">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    // Access denied
    if (!user || userData?.role !== 'super_admin') {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-gray-950 px-4">
                <Shield className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">403 - Access Denied</h1>
                <p className="text-gray-400 mb-6 text-center">
                    You do not have permission to access the Super Admin area.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Go Home
                </Link>
            </div>
        );
    }

    const handleResetChurch = () => {
        resetChurch();
        router.push('/super-admin');
    };

    return (
        <div className="flex h-screen bg-gray-950">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800
                    transform transition-transform duration-200 ease-in-out
                    lg:relative lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {/* Sidebar header */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-indigo-400" />
                        <span className="text-lg font-semibold text-white">Super Admin</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1 rounded text-gray-400 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex flex-col gap-1 p-3">
                    {navItems.map((item) => {
                        const isActive =
                            item.href === '/super-admin'
                                ? pathname === '/super-admin'
                                : pathname.startsWith(item.href) && item.href !== '/super-admin';
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.label}
                                href={item.disabled ? '#' : item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                                    ${item.disabled
                                        ? 'text-gray-600 cursor-not-allowed'
                                        : isActive
                                            ? 'bg-indigo-600/20 text-indigo-400'
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }
                                `}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                                {item.disabled && (
                                    <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                                        Soon
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User info at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
                    <div className="text-sm text-gray-400 truncate">{userData?.email}</div>
                    <div className="text-xs text-gray-600 mt-0.5">Super Administrator</div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar with hamburger (mobile) and church switch banner */}
                <header className="flex-shrink-0">
                    {/* Mobile header */}
                    <div className="flex items-center h-14 px-4 border-b border-gray-800 lg:hidden bg-gray-900">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="ml-3 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-indigo-400" />
                            <span className="text-sm font-medium text-white">Super Admin</span>
                        </div>
                    </div>

                    {/* Church switch banner */}
                    {isSwitched && church && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-600/20 border-b border-amber-600/30">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-amber-400" />
                                <span className="text-sm font-medium text-amber-300">
                                    Managing: {church.name}
                                </span>
                            </div>
                            <button
                                onClick={handleResetChurch}
                                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600/30 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-600/50 transition-colors"
                            >
                                <ArrowLeft className="h-3 w-3" />
                                Back to Super Admin
                            </button>
                        </div>
                    )}
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
