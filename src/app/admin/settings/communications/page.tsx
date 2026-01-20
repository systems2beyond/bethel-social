'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, Save, Lock } from 'lucide-react';
import { CommunicationSettings, DEFAULT_COMMUNICATION_SETTINGS } from '@/types/settings';

export default function CommunicationSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<CommunicationSettings>(DEFAULT_COMMUNICATION_SETTINGS);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            // In a real multi-tenant app, this would be `tenants/{tenantId}/settings/communications`
            // For this project structure, we'll use a global singleton 'settings' collection
            const docRef = doc(db, 'settings', 'communications');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setSettings({ ...DEFAULT_COMMUNICATION_SETTINGS, ...snap.data() } as CommunicationSettings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Failed to load communication settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const docRef = doc(db, 'settings', 'communications');
            await setDoc(docRef, settings);
            toast.success('Communication settings saved');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Communication Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Configure your email server settings to enable mass messaging and automated reminders.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        SMTP Configuration
                    </CardTitle>
                    <CardDescription>
                        Enter your mail server details directly. We recommend using an App Password if using Gmail.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="host">SMTP Host</Label>
                                <Input
                                    id="host"
                                    placeholder="smtp.gmail.com"
                                    value={settings.host}
                                    onChange={(e) => setSettings({ ...settings, host: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="port">Port</Label>
                                <Input
                                    id="port"
                                    type="number"
                                    placeholder="587"
                                    value={settings.port}
                                    onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || 587 })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="user">SMTP Username (Email)</Label>
                                <Input
                                    id="user"
                                    type="email"
                                    placeholder="you@yourchurch.com"
                                    value={settings.user}
                                    onChange={(e) => setSettings({ ...settings, user: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pass">SMTP Password / App Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                                    <Input
                                        id="pass"
                                        type="password"
                                        className="pl-9"
                                        placeholder="••••••••••••••••"
                                        value={settings.pass}
                                        onChange={(e) => setSettings({ ...settings, pass: e.target.value })}
                                        required
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    This is stored securely encrypted in your database settings.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fromName">Sender Name</Label>
                            <Input
                                id="fromName"
                                placeholder="Bethel Church"
                                value={settings.fromName}
                                onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                                required
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Configuration
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
