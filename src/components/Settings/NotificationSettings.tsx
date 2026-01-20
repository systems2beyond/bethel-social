'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Bell, Mail, Video, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationSettings() {
    const { user, userData } = useAuth();
    const [settings, setSettings] = useState({
        posts: true,
        messages: true,
        sermons: true
    });

    // Track local changes to debounce or simply trust optimistic update

    useEffect(() => {
        if (userData?.notificationSettings) {
            setSettings({
                posts: userData.notificationSettings.posts ?? true,
                messages: userData.notificationSettings.messages ?? true,
                sermons: userData.notificationSettings.sermons ?? true
            });
        }
    }, [userData]);

    const toggleSetting = async (key: keyof typeof settings) => {
        if (!user) return;

        const newValue = !settings[key];
        // Optimistic update
        setSettings(prev => ({ ...prev, [key]: newValue }));

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                [`notificationSettings.${key}`]: newValue
            });
        } catch (err) {
            console.error('Error updating notification settings:', err);
            toast.error('Failed to update setting');
            // Revert
            setSettings(prev => ({ ...prev, [key]: !newValue }));
        }
    };

    const SettingRow = ({
        icon: Icon,
        title,
        description,
        isOn,
        onToggle
    }: {
        icon: any,
        title: string,
        description: string,
        isOn: boolean,
        onToggle: () => void
    }) => (
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-start gap-4">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400 mt-1">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                </div>
            </div>

            <button
                onClick={onToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${isOn ? 'bg-purple-600' : 'bg-gray-200 dark:bg-zinc-700'
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );

    return (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            <SettingRow
                icon={Bell}
                title="New Posts"
                description="Get notified when there are new posts in the feed."
                isOn={settings.posts}
                onToggle={() => toggleSetting('posts')}
            />
            <SettingRow
                icon={MessageSquare}
                title="Direct Messages"
                description="Receive emails when someone sends you a message."
                isOn={settings.messages}
                onToggle={() => toggleSetting('messages')}
            />
            <SettingRow
                icon={Video}
                title="New Sermons"
                description="Be the first to know when a new sermon is uploaded."
                isOn={settings.sermons}
                onToggle={() => toggleSetting('sermons')}
            />
        </div>
    );
}
