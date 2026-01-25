'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, Plus, Building, Globe, Palette, Facebook, Youtube, Key, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function OnboardChurchPage() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        subdomain: '',
        primaryColor: '#3b82f6',
        logoUrl: '',
        // Integrations
        fbPageId: '',
        fbAccessToken: '',
        ytApiKey: '',
        ytChannelId: '',
        // Admin Invite
        adminEmail: ''
    });

    // Check permissions
    if (userData?.role !== 'super_admin') {
        // In production, middleware should handle this, but client-side check is good backup
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-red-500">Access Restricted: Super Admin Only</p>
            </div>
        );
    }

    const validateSubdomain = (sub: string) => {
        // Alphanumeric + hyphens, no spaces
        return /^[a-z0-9-]+$/.test(sub);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Validate
            if (!formData.name || !formData.subdomain) {
                toast.error('Name and Subdomain are required');
                setLoading(false);
                return;
            }

            if (!validateSubdomain(formData.subdomain)) {
                toast.error('Subdomain must be lowercase letters, numbers, or hyphens (no spaces).');
                setLoading(false);
                return;
            }

            const churchId = formData.subdomain + '-church'; // ID Convention

            // 2. Check Uniqueness
            const q = query(collection(db, 'churches'), where('subdomain', '==', formData.subdomain));
            const existing = await getDocs(q);
            if (!existing.empty) {
                toast.error('Subdomain is already taken.');
                setLoading(false);
                return;
            }

            // 3. Batch Create
            const batch = writeBatch(db);
            const churchRef = doc(db, 'churches', churchId);

            // A. Core Church Doc
            batch.set(churchRef, {
                name: formData.name,
                subdomain: formData.subdomain,
                theme: {
                    primaryColor: formData.primaryColor,
                    logoUrl: formData.logoUrl || null
                },
                createdAt: serverTimestamp(),
                createdBy: user?.uid
            });

            // B. Settings Doc (Integrations)
            // Even if empty, creating the doc structure is good practice
            const settingsRef = doc(db, 'churches', churchId, 'settings', 'integrations');
            batch.set(settingsRef, {
                facebook: {
                    pageId: formData.fbPageId,
                    accessToken: formData.fbAccessToken,
                    updatedAt: serverTimestamp()
                },
                youtube: {
                    apiKey: formData.ytApiKey,
                    channelId: formData.ytChannelId,
                    updatedAt: serverTimestamp()
                }
            });

            // C. Admin Invite (Optional - Create an invitation doc?)
            if (formData.adminEmail) {
                const inviteRef = doc(collection(db, 'invitations'));
                batch.set(inviteRef, {
                    email: formData.adminEmail,
                    churchId: churchId,
                    role: 'admin',
                    status: 'pending',
                    invitedBy: user?.uid,
                    createdAt: serverTimestamp()
                });
            }

            await batch.commit();

            // 4. Success
            toast.success(`Church "${formData.name}" provisioned with integrations.`);
            // Reset
            setFormData({
                name: '', subdomain: '', primaryColor: '#3b82f6', logoUrl: '',
                fbPageId: '', fbAccessToken: '', ytApiKey: '', ytChannelId: '', adminEmail: ''
            });

        } catch (error) {
            console.error('Error onboarding church:', error);
            toast.error('Failed to create church.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Onboard New Church</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Provision a new tenant environment.
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-8 shadow-sm"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Building className="w-4 h-4" /> Church Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Bethel Metro"
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        {/* Subdomain */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Globe className="w-4 h-4" /> Subdomain
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400">https://</span>
                                <input
                                    type="text"
                                    value={formData.subdomain}
                                    onChange={e => setFormData({ ...formData, subdomain: e.target.value.toLowerCase() })}
                                    placeholder="bethel-metro"
                                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-gray-400">.myapp.com</span>
                            </div>
                            <p className="text-xs text-gray-400">Unique identifier for URL resolution.</p>
                        </div>

                        {/* Theme */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Palette className="w-4 h-4" /> Primary Color
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={formData.primaryColor}
                                        onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="h-10 w-10 rounded border-0 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.primaryColor}
                                        onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="flex-1 px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Integrations Section */}
                        <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Integrations</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Facebook */}
                                <div className="space-y-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                                        <Facebook className="w-4 h-4" /> Facebook
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Page ID"
                                        value={formData.fbPageId}
                                        onChange={e => setFormData({ ...formData, fbPageId: e.target.value })}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Access Token"
                                        value={formData.fbAccessToken}
                                        onChange={e => setFormData({ ...formData, fbAccessToken: e.target.value })}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm"
                                    />
                                </div>

                                {/* YouTube */}
                                <div className="space-y-4 p-4 bg-red-50/50 dark:bg-red-900/10 rounded-lg">
                                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium">
                                        <Youtube className="w-4 h-4" /> YouTube
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Channel ID"
                                        value={formData.ytChannelId}
                                        onChange={e => setFormData({ ...formData, ytChannelId: e.target.value })}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm"
                                    />
                                    <input
                                        type="password"
                                        placeholder="API Key"
                                        value={formData.ytApiKey}
                                        onChange={e => setFormData({ ...formData, ytApiKey: e.target.value })}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Admin Invite */}
                        <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Mail className="w-4 h-4" /> Initial Admin Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.adminEmail}
                                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                    placeholder="admin@church.com"
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-gray-400">We'll create an invitation for this email.</p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                Provision Church
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
