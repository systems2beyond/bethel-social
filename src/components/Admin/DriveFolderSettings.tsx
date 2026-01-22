'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Save, HardDrive, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DriveFolderSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [folderId, setFolderId] = useState('');
    const [folderName, setFolderName] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'integrations');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data().drive || {};
                    setEnabled(data.enabled ?? false);
                    setFolderId(data.targetFolderId ?? '');
                    setFolderName(data.targetFolderName ?? '');
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const docRef = doc(db, 'settings', 'integrations');
            await setDoc(docRef, {
                drive: {
                    enabled,
                    targetFolderId: folderId,
                    targetFolderName: folderName,
                    updatedAt: new Date().toISOString()
                }
            }, { merge: true });
            toast.success('Drive settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Google Drive Integration</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Configure where sermon videos are stored and analyzed.</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-medium text-zinc-900 dark:text-white">Enable Integration</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Allow uploading sermons directly to Google Drive.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {enabled && (
                    <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Target Folder ID
                            </label>
                            <input
                                type="text"
                                value={folderId}
                                onChange={(e) => setFolderId(e.target.value)}
                                placeholder="e.g. 1A2B3C..."
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-2">
                                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <span>
                                    Open folder in Drive, copy ID from URL. MUST share with Service Account email.
                                </span>
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                Folder Name (Optional)
                            </label>
                            <input
                                type="text"
                                value={folderName}
                                onChange={(e) => setFolderName(e.target.value)}
                                placeholder="e.g. Sunday Sermons"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3 h-3" />
                                        Save Settings
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
