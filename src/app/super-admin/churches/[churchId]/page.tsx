'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useChurch } from '@/context/ChurchContext';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Edit3,
    Save,
    Loader2,
    Building2,
    Users,
    ExternalLink,
} from 'lucide-react';

interface ChurchDetail {
    id: string;
    name: string;
    subdomain: string;
    tagline?: string;
    appName?: string;
    description?: string;
    botName?: string;
    botGreeting?: string;
    memberCount?: number;
    createdAt?: string;
    theme?: {
        primaryColor?: string;
        logoUrl?: string;
    };
}

interface FormData {
    name: string;
    subdomain: string;
    tagline: string;
    appName: string;
    description: string;
    botName: string;
    botGreeting: string;
    primaryColor: string;
    logoUrl: string;
}

export default function ChurchDetailPage() {
    const { user } = useAuth();
    const { switchChurch } = useChurch();
    const router = useRouter();
    const params = useParams();
    const churchId = params.churchId as string;

    const [church, setChurch] = useState<ChurchDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<FormData>({
        name: '',
        subdomain: '',
        tagline: '',
        appName: '',
        description: '',
        botName: '',
        botGreeting: '',
        primaryColor: '#3b82f6',
        logoUrl: '',
    });

    useEffect(() => {
        async function fetchChurch() {
            if (!user || !churchId) return;

            try {
                setLoading(true);
                const token = await auth.currentUser?.getIdToken();
                if (!token) throw new Error('No auth token');

                const res = await fetch(`/api/super-admin/churches/${churchId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    throw new Error(`Failed to fetch church: ${res.status}`);
                }

                const data = await res.json();
                const churchData = data.church || data;
                setChurch(churchData);
                setFormData({
                    name: churchData.name || '',
                    subdomain: churchData.subdomain || '',
                    tagline: churchData.tagline || '',
                    appName: churchData.appName || '',
                    description: churchData.description || '',
                    botName: churchData.botName || '',
                    botGreeting: churchData.botGreeting || '',
                    primaryColor: churchData.theme?.primaryColor || '#3b82f6',
                    logoUrl: churchData.theme?.logoUrl || '',
                });
            } catch (err: any) {
                console.error('Failed to fetch church:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchChurch();
    }, [user, churchId]);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Church name is required');
            return;
        }
        if (!formData.subdomain.trim()) {
            toast.error('Subdomain is required');
            return;
        }
        if (!/^[a-z0-9-]+$/.test(formData.subdomain.trim())) {
            toast.error('Subdomain must be lowercase letters, numbers, and hyphens only');
            return;
        }

        try {
            setSaving(true);
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('No auth token');

            const res = await fetch(`/api/super-admin/churches/${churchId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    subdomain: formData.subdomain.trim(),
                    tagline: formData.tagline.trim() || null,
                    appName: formData.appName.trim() || null,
                    description: formData.description.trim() || null,
                    botName: formData.botName.trim() || null,
                    botGreeting: formData.botGreeting.trim() || null,
                    theme: {
                        primaryColor: formData.primaryColor,
                        logoUrl: formData.logoUrl.trim() || null,
                    },
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Save failed: ${res.status}`);
            }

            const updated = await res.json();
            const updatedChurch = updated.church || updated;
            setChurch(updatedChurch);
            setEditing(false);
            toast.success('Church updated successfully');
        } catch (err: any) {
            console.error('Failed to save church:', err);
            toast.error(err.message || 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleManageChurch = () => {
        switchChurch(churchId);
        router.push('/admin');
    };

    const handleCancelEdit = () => {
        if (church) {
            setFormData({
                name: church.name || '',
                subdomain: church.subdomain || '',
                tagline: church.tagline || '',
                appName: church.appName || '',
                description: church.description || '',
                botName: church.botName || '',
                botGreeting: church.botGreeting || '',
                primaryColor: church.theme?.primaryColor || '#3b82f6',
                logoUrl: church.theme?.logoUrl || '',
            });
        }
        setEditing(false);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return 'N/A';
        }
    };

    const updateField = (field: keyof FormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    // Error state
    if (error || !church) {
        return (
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => router.push('/super-admin')}
                    className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Churches
                </button>
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
                    <p className="text-red-400">{error || 'Church not found'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            {/* Back button */}
            <button
                onClick={() => router.push('/super-admin')}
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Churches
            </button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    {church.theme?.primaryColor && (
                        <span
                            className="h-4 w-4 rounded-full ring-2 ring-gray-700"
                            style={{ backgroundColor: church.theme.primaryColor }}
                        />
                    )}
                    <h1 className="text-2xl font-bold text-white">
                        {editing ? 'Edit Church' : church.name}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {!editing ? (
                        <>
                            <button
                                onClick={handleManageChurch}
                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Manage This Church
                            </button>
                            <button
                                onClick={() => setEditing(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                            >
                                <Edit3 className="h-4 w-4" />
                                Edit
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Save Changes
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {editing ? (
                    /* ===== EDIT MODE ===== */
                    <>
                        {/* Basic Info */}
                        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Church Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="Enter church name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Subdomain <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.subdomain}
                                        onChange={(e) =>
                                            updateField('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                                        }
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="my-church"
                                    />
                                    <p className="text-xs text-gray-600 mt-1">
                                        Lowercase letters, numbers, and hyphens only
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Tagline
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.tagline}
                                        onChange={(e) => updateField('tagline', e.target.value)}
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder={`Stay connected with ${formData.name || 'your church'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        App Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.appName}
                                        onChange={(e) => updateField('appName', e.target.value)}
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder={`${formData.name || 'Church'} Social`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => updateField('description', e.target.value)}
                                        rows={3}
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                        placeholder="A brief description of the church"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Bot Settings */}
                        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Bot Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Bot Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.botName}
                                        onChange={(e) => updateField('botName', e.target.value)}
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder={`${formData.name || 'Church'} Assistant`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Bot Greeting
                                    </label>
                                    <textarea
                                        value={formData.botGreeting}
                                        onChange={(e) => updateField('botGreeting', e.target.value)}
                                        rows={3}
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                        placeholder={`Hello! I'm your ${formData.name || 'Church'} Assistant. How can I help you today?`}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Theme */}
                        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Theme</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Primary Color
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={formData.primaryColor}
                                            onChange={(e) => updateField('primaryColor', e.target.value)}
                                            className="h-10 w-14 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={formData.primaryColor}
                                            onChange={(e) => updateField('primaryColor', e.target.value)}
                                            className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            placeholder="#3b82f6"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                        Logo URL
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.logoUrl}
                                        onChange={(e) => updateField('logoUrl', e.target.value)}
                                        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="https://example.com/logo.png"
                                    />
                                    {formData.logoUrl && (
                                        <div className="mt-3 p-3 bg-gray-800 rounded-lg inline-block">
                                            <img
                                                src={formData.logoUrl}
                                                alt="Logo preview"
                                                className="h-12 w-auto object-contain"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </>
                ) : (
                    /* ===== VIEW MODE ===== */
                    <>
                        {/* Overview */}
                        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Overview</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DetailItem label="Church Name" value={church.name} />
                                <DetailItem label="Subdomain" value={church.subdomain} />
                                <DetailItem
                                    label="Tagline"
                                    value={church.tagline}
                                    fallback={`Stay connected with ${church.name}`}
                                />
                                <DetailItem
                                    label="App Name"
                                    value={church.appName}
                                    fallback={`${church.name} Social`}
                                />
                                <div className="sm:col-span-2">
                                    <DetailItem
                                        label="Description"
                                        value={church.description}
                                        fallback="No description"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Bot Settings */}
                        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Bot Settings</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DetailItem
                                    label="Bot Name"
                                    value={church.botName}
                                    fallback={`${church.name} Assistant`}
                                />
                                <div className="sm:col-span-2">
                                    <DetailItem
                                        label="Bot Greeting"
                                        value={church.botGreeting}
                                        fallback={`Hello! I'm your ${church.name} Assistant. How can I help you today?`}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Theme */}
                        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Theme</h2>
                            <div className="flex items-center gap-6">
                                {church.theme?.primaryColor && (
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="h-8 w-8 rounded-lg ring-2 ring-gray-700"
                                            style={{ backgroundColor: church.theme.primaryColor }}
                                        />
                                        <div>
                                            <p className="text-xs text-gray-500">Primary Color</p>
                                            <p className="text-sm text-white font-mono">
                                                {church.theme.primaryColor}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {church.theme?.logoUrl && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1.5">Logo</p>
                                        <div className="p-2 bg-gray-800 rounded-lg inline-block">
                                            <img
                                                src={church.theme.logoUrl}
                                                alt={`${church.name} logo`}
                                                className="h-10 w-auto object-contain"
                                            />
                                        </div>
                                    </div>
                                )}
                                {!church.theme?.primaryColor && !church.theme?.logoUrl && (
                                    <p className="text-sm text-gray-500">No theme customization</p>
                                )}
                            </div>
                        </section>

                        {/* Stats */}
                        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h2 className="text-lg font-semibold text-white mb-4">Stats</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-600/20">
                                        <Users className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Members</p>
                                        <p className="text-lg font-semibold text-white">
                                            {church.memberCount ?? 0}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-indigo-600/20">
                                        <Building2 className="h-4 w-4 text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Created</p>
                                        <p className="text-lg font-semibold text-white">
                                            {formatDate(church.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}

/** Small helper for consistent detail rows in view mode */
function DetailItem({
    label,
    value,
    fallback,
}: {
    label: string;
    value?: string;
    fallback?: string;
}) {
    const display = value || fallback;
    const isFallback = !value && !!fallback;

    return (
        <div>
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-sm ${isFallback ? 'text-gray-600 italic' : 'text-white'}`}>
                {display || 'N/A'}
            </p>
        </div>
    );
}
