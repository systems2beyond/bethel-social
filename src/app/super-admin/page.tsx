'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useChurch } from '@/context/ChurchContext';
import { auth } from '@/lib/firebase';
import { Building2, Users, Plus, Loader2 } from 'lucide-react';

interface ChurchData {
    id: string;
    name: string;
    subdomain: string;
    memberCount?: number;
    createdAt?: string;
    theme?: {
        primaryColor?: string;
        logoUrl?: string;
    };
}

export default function SuperAdminDashboard() {
    const { user } = useAuth();
    const { switchChurch } = useChurch();
    const router = useRouter();

    const [churches, setChurches] = useState<ChurchData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchChurches() {
            if (!user) return;

            try {
                setLoading(true);
                const token = await auth.currentUser?.getIdToken(true);
                if (!token) throw new Error('No auth token');

                const res = await fetch('/api/super-admin/churches', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    throw new Error(`Failed to fetch churches: ${res.status}`);
                }

                const data = await res.json();
                setChurches(data.churches || data || []);
            } catch (err: any) {
                console.error('Failed to fetch churches:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchChurches();
    }, [user]);

    const totalChurches = churches.length;
    const totalMembers = churches.reduce((sum, c) => sum + (c.memberCount || 0), 0);

    const handleChurchClick = (churchId: string) => {
        switchChurch(churchId);
        router.push('/admin');
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return 'N/A';
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">All Churches</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Manage and monitor all churches on the platform
                    </p>
                </div>
                <Link
                    href="/super-admin/onboard"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors w-fit"
                >
                    <Plus className="h-4 w-4" />
                    Onboard New Church
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-indigo-600/20">
                            <Building2 className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total Churches</p>
                            <p className="text-2xl font-bold text-white">
                                {loading ? '...' : totalChurches}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-600/20">
                            <Users className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total Members</p>
                            <p className="text-2xl font-bold text-white">
                                {loading ? '...' : totalMembers.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse"
                        >
                            <div className="h-5 w-40 bg-gray-800 rounded mb-3" />
                            <div className="h-3 w-28 bg-gray-800 rounded mb-4" />
                            <div className="flex items-center justify-between">
                                <div className="h-3 w-20 bg-gray-800 rounded" />
                                <div className="h-3 w-24 bg-gray-800 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && churches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Building2 className="h-12 w-12 text-gray-700 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-1">No churches yet</h3>
                    <p className="text-gray-400 text-sm mb-6">
                        Get started by onboarding your first church.
                    </p>
                    <Link
                        href="/super-admin/onboard"
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Onboard New Church
                    </Link>
                </div>
            )}

            {/* Church cards */}
            {!loading && !error && churches.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {churches.map((church) => (
                        <button
                            key={church.id}
                            onClick={() => handleChurchClick(church.id)}
                            className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-left hover:border-gray-700 hover:bg-gray-900/80 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-semibold text-white truncate group-hover:text-indigo-400 transition-colors">
                                        {church.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 truncate mt-0.5">
                                        {church.subdomain}
                                    </p>
                                </div>
                                {church.theme?.primaryColor && (
                                    <span
                                        className="flex-shrink-0 h-3 w-3 rounded-full ring-2 ring-gray-800 ml-2 mt-1"
                                        style={{ backgroundColor: church.theme.primaryColor }}
                                    />
                                )}
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />
                                    <span>{church.memberCount ?? 0} members</span>
                                </div>
                                <span>{formatDate(church.createdAt)}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
