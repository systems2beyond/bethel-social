'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, Facebook, Youtube, Key, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function IntegrationsPage() {
    const { userData, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Facebook State
    const [fbPageId, setFbPageId] = useState('');
    const [fbAccessToken, setFbAccessToken] = useState('');

    // YouTube State
    const [ytApiKey, setYtApiKey] = useState('');
    const [ytChannelId, setYtChannelId] = useState('');

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                if (!userData?.churchId) return;
                const docRef = doc(db, 'churches', userData.churchId, 'settings', 'integrations');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFbPageId(data.facebook?.pageId || '');
                    setFbAccessToken(data.facebook?.accessToken || '');
                    setYtApiKey(data.youtube?.apiKey || '');
                    setYtChannelId(data.youtube?.channelId || '');
                }
            } catch (error) {
                console.error('Error fetching integrations:', error);
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading && (userData?.role === 'admin' || userData?.role === 'super_admin')) {
            fetchConfig();
        }
    }, [authLoading, userData]);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (!userData?.churchId) throw new Error("No church ID found");
            const docRef = doc(db, 'churches', userData.churchId, 'settings', 'integrations');
            await setDoc(docRef, {
                facebook: {
                    pageId: fbPageId,
                    accessToken: fbAccessToken, // In a real app, we might want to encrypt this or use a separate sensitive collection
                    updatedAt: serverTimestamp(),
                },
                youtube: {
                    apiKey: ytApiKey,
                    channelId: ytChannelId,
                    updatedAt: serverTimestamp(),
                }
            }, { merge: true });
            toast.success('Integration settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
        return <div className="p-8 text-center text-gray-500">Access Denied</div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Integrations</h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Connect your social media accounts to automatically sync content.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Facebook Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm"
                >
                    <div className="flex items-center gap-4 border-b border-gray-100 dark:border-zinc-800 pb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Facebook className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Facebook Page</h2>
                            <p className="text-sm text-gray-500">Sync posts and live streams</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Page ID</label>
                            <input
                                type="text"
                                value={fbPageId}
                                onChange={(e) => setFbPageId(e.target.value)}
                                placeholder="e.g. 10423423423"
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Access Token (Long-Lived)</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={fbAccessToken}
                                    onChange={(e) => setFbAccessToken(e.target.value)}
                                    placeholder="EAAG..."
                                    className="w-full px-4 py-2 pl-10 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            </div>
                            <p className="text-xs text-gray-400">
                                Generate this in the Facebook Developer Portal. Ensure it has `pages_read_engagement` scope.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* YouTube Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm"
                >
                    <div className="flex items-center gap-4 border-b border-gray-100 dark:border-zinc-800 pb-4">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <Youtube className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">YouTube Channel</h2>
                            <p className="text-sm text-gray-500">Sync videos and live status</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Channel ID</label>
                            <input
                                type="text"
                                value={ytChannelId}
                                onChange={(e) => setYtChannelId(e.target.value)}
                                placeholder="e.g. UC_x5..."
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={ytApiKey}
                                    onChange={(e) => setYtApiKey(e.target.value)}
                                    placeholder="AIza..."
                                    className="w-full px-4 py-2 pl-10 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                />
                                <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            </div>
                            <p className="text-xs text-gray-400">
                                From Google Cloud Console. Restrictions: YouTube Data API v3.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex justify-end pt-6"
            >
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-gray-900 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gray-200 dark:shadow-none"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Settings
                        </>
                    )}
                </button>
            </motion.div>

            {/* Environment Variable Status Alert */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 dark:text-amber-200">
                    <strong>Environment Variable Priority:</strong> If `FB_ACCESS_TOKEN` or `GOOGLE_API_KEY` are set in the server environment (env vars), they will take precedence over the settings above. This ensures stability for existing deployments.
                </div>
            </div>
        </div>
    );
}
