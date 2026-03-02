'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { VolunteerFormService, DEFAULT_FIELDS, getDefaultConfig } from '@/lib/services/VolunteerFormService';
import { VolunteerFormConfig, VolunteerFormField, VolunteerFormFieldType } from '@/types';
import { uploadMedia } from '@/lib/storage';
import { HexColorPicker } from 'react-colorful';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    ArrowLeft, Save, Loader2, Eye, Palette, FormInput, CheckCircle, Settings,
    GripVertical, Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink,
    Upload, X, ChevronDown, ChevronUp, Image as ImageIcon, Users, Calendar
} from 'lucide-react';
import Link from 'next/link';

// Field type options with friendly names
const FIELD_TYPE_OPTIONS: { value: VolunteerFormFieldType; label: string; description: string }[] = [
    { value: 'short_answer', label: 'Short Answer', description: 'Single line of text' },
    { value: 'paragraph', label: 'Paragraph', description: 'Multiple lines of text' },
    { value: 'name', label: 'Name', description: 'Person\'s name' },
    { value: 'email', label: 'Email', description: 'Email address' },
    { value: 'phone', label: 'Phone Number', description: 'Phone with formatting' },
    { value: 'checkbox', label: 'Checkbox', description: 'Yes/No toggle' },
    { value: 'select', label: 'Dropdown', description: 'Choose from options' },
    { value: 'ministry_interests', label: 'Ministry Interests', description: 'Multi-select ministries' },
    { value: 'availability', label: 'Availability', description: '7-day availability picker' },
];

export default function VolunteerFormEditorPage() {
    const { user, userData } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'branding' | 'fields' | 'success' | 'settings'>('branding');

    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [tagline, setTagline] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#10b981');
    const [backgroundColor, setBackgroundColor] = useState('#09090b');
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const [fields, setFields] = useState<VolunteerFormField[]>([]);

    const [successTitle, setSuccessTitle] = useState('');
    const [successSubtitle, setSuccessSubtitle] = useState('');

    const [enabled, setEnabled] = useState(true);
    const [notifyAdmins, setNotifyAdmins] = useState(true);

    // Ministries for preview
    const [ministries, setMinistries] = useState<{ id: string; name: string }[]>([]);

    // Load config
    useEffect(() => {
        if (userData?.churchId) {
            loadConfig();
            loadMinistries();
        }
    }, [userData?.churchId]);

    const loadConfig = async () => {
        if (!userData?.churchId) return;

        try {
            const config = await VolunteerFormService.getConfig(userData.churchId);

            setFormTitle(config.branding.formTitle);
            setTagline(config.branding.tagline);
            setLogoUrl(config.branding.logoUrl || '');
            setPrimaryColor(config.branding.primaryColor);
            setBackgroundColor(config.branding.backgroundColor);

            setFields(config.fields.length > 0 ? config.fields : DEFAULT_FIELDS);

            setSuccessTitle(config.successMessage.title);
            setSuccessSubtitle(config.successMessage.subtitle);

            setEnabled(config.settings.enabled);
            setNotifyAdmins(config.settings.notifyAdmins);
        } catch (error) {
            console.error('Error loading config:', error);
            const defaults = getDefaultConfig(userData.churchId);
            setFormTitle(defaults.branding.formTitle);
            setTagline(defaults.branding.tagline);
            setPrimaryColor(defaults.branding.primaryColor);
            setBackgroundColor(defaults.branding.backgroundColor);
            setFields(defaults.fields);
            setSuccessTitle(defaults.successMessage.title);
            setSuccessSubtitle(defaults.successMessage.subtitle);
            setEnabled(defaults.settings.enabled);
            setNotifyAdmins(defaults.settings.notifyAdmins);
        } finally {
            setLoading(false);
        }
    };

    const loadMinistries = async () => {
        if (!userData?.churchId) return;
        try {
            const q = query(
                collection(db, 'ministries'),
                where('churchId', '==', userData.churchId)
            );
            const snapshot = await getDocs(q);
            setMinistries(snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name
            })));
        } catch (error) {
            console.error('Error loading ministries:', error);
        }
    };

    const handleSave = async () => {
        if (!userData?.churchId || !user?.uid) {
            alert('Error: Not authenticated. Please refresh and try again.');
            return;
        }

        setSaving(true);
        try {
            await VolunteerFormService.saveConfig(
                userData.churchId,
                {
                    branding: {
                        formTitle,
                        tagline,
                        logoUrl: logoUrl || undefined,
                        primaryColor,
                        backgroundColor
                    },
                    fields,
                    successMessage: {
                        title: successTitle,
                        subtitle: successSubtitle
                    },
                    settings: {
                        enabled,
                        notifyAdmins
                    }
                },
                user.uid
            );
            alert('Volunteer form saved successfully!');
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Logo upload handler
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingLogo(true);
        try {
            const url = await uploadMedia(file, 'volunteer-form/logos');
            setLogoUrl(url);
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Failed to upload logo. Please try again.');
        } finally {
            setUploadingLogo(false);
        }
    };

    // Field Management
    const updateField = (index: number, updates: Partial<VolunteerFormField>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...updates };
        setFields(newFields);
    };

    const removeField = (index: number) => {
        const field = fields[index];
        if (['name', 'email'].includes(field.id)) {
            alert('This field cannot be removed.');
            return;
        }
        setFields(fields.filter((_, i) => i !== index));
    };

    const addField = () => {
        const newField: VolunteerFormField = {
            id: `custom_${Date.now()}`,
            type: 'short_answer',
            label: 'New Question',
            placeholder: 'Enter your answer',
            required: false,
            enabled: true,
            order: fields.length
        };
        setFields([...fields, newField]);
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= fields.length) return;

        const newFields = [...fields];
        [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
        newFields.forEach((f, i) => f.order = i);
        setFields(newFields);
    };

    // Role Check
    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">You must be an admin to edit the Volunteer Form.</p>
                <Link href="/" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                    Return Home
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Volunteer Form Editor</h1>
                        <p className="text-sm text-gray-500">Customize your Volunteer Signup Form</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/volunteer-signup/${userData?.churchId}`}
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                        Preview
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <TabButton
                    active={activeTab === 'branding'}
                    onClick={() => setActiveTab('branding')}
                    icon={<Palette className="w-4 h-4" />}
                    label="Form Editor"
                />
                <TabButton
                    active={activeTab === 'fields'}
                    onClick={() => setActiveTab('fields')}
                    icon={<FormInput className="w-4 h-4" />}
                    label="Questions"
                />
                <TabButton
                    active={activeTab === 'success'}
                    onClick={() => setActiveTab('success')}
                    icon={<CheckCircle className="w-4 h-4" />}
                    label="Success Message"
                />
                <TabButton
                    active={activeTab === 'settings'}
                    onClick={() => setActiveTab('settings')}
                    icon={<Settings className="w-4 h-4" />}
                    label="Settings"
                />
            </div>

            {/* Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Editor Panel */}
                <div className="lg:col-span-3">
                    {activeTab === 'branding' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold mb-4">Form Appearance</h2>

                                <div className="space-y-6">
                                    {/* Logo Upload */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Logo</label>
                                        <div className="flex items-start gap-4">
                                            {logoUrl ? (
                                                <div className="relative group">
                                                    <img
                                                        src={logoUrl}
                                                        alt="Logo"
                                                        className="w-24 h-24 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                                                    />
                                                    <button
                                                        onClick={() => setLogoUrl('')}
                                                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors w-fit">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleLogoUpload}
                                                        className="hidden"
                                                    />
                                                    {uploadingLogo ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Upload className="w-4 h-4" />
                                                    )}
                                                    <span className="text-sm font-medium">
                                                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                                                    </span>
                                                </label>
                                                <p className="text-xs text-gray-500 mt-2">
                                                    PNG, JPG or SVG. Max 2MB.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            placeholder="Volunteer With Us"
                                        />
                                    </div>

                                    {/* Tagline */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Tagline</label>
                                        <input
                                            type="text"
                                            value={tagline}
                                            onChange={(e) => setTagline(e.target.value)}
                                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            placeholder="Join our team and make a difference."
                                        />
                                    </div>

                                    {/* Color Pickers */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <ColorPickerField
                                            label="Primary Color"
                                            value={primaryColor}
                                            onChange={setPrimaryColor}
                                        />
                                        <ColorPickerField
                                            label="Background Color"
                                            value={backgroundColor}
                                            onChange={setBackgroundColor}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fields' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">Questions</h2>
                                    <p className="text-sm text-gray-500">Click on a question to edit it</p>
                                </div>
                                <button
                                    onClick={addField}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Question
                                </button>
                            </div>

                            <div className="space-y-3">
                                {fields.map((field, index) => (
                                    <FieldEditor
                                        key={field.id}
                                        field={field}
                                        index={index}
                                        total={fields.length}
                                        onUpdate={(updates) => updateField(index, updates)}
                                        onRemove={() => removeField(index)}
                                        onMove={(dir) => moveField(index, dir)}
                                        isCore={['name', 'email'].includes(field.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'success' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <h2 className="text-lg font-semibold">Success Message</h2>
                            <p className="text-sm text-gray-500">Customize what visitors see after submitting the form.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={successTitle}
                                        onChange={(e) => setSuccessTitle(e.target.value)}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="Thank You!"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Subtitle</label>
                                    <textarea
                                        value={successSubtitle}
                                        onChange={(e) => setSuccessSubtitle(e.target.value)}
                                        rows={3}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="We've received your volunteer interest form..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <h2 className="text-lg font-semibold">Form Settings</h2>

                            <div className="space-y-4">
                                <ToggleSetting
                                    label="Enable Volunteer Form"
                                    description="When disabled, the public form will show a 'coming soon' message."
                                    enabled={enabled}
                                    onChange={setEnabled}
                                />

                                <ToggleSetting
                                    label="Notify Admins"
                                    description="Send real-time notifications when new volunteers sign up."
                                    enabled={notifyAdmins}
                                    onChange={setNotifyAdmins}
                                />
                            </div>

                            {/* Share Link */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h3 className="font-medium mb-2">Share Link</h3>
                                <p className="text-sm text-gray-500 mb-3">Share this link to collect volunteer signups.</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/volunteer-signup/${userData?.churchId}`}
                                        readOnly
                                        className="flex-1 p-2 text-sm border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/volunteer-signup/${userData?.churchId}`);
                                            alert('Link copied!');
                                        }}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Live Preview */}
                <div className="lg:col-span-2">
                    <div className="sticky top-6">
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-2">
                            <div className="text-xs text-gray-500 text-center mb-2 font-medium">Live Preview</div>
                            <div
                                className="rounded-lg overflow-hidden shadow-lg"
                                style={{ backgroundColor }}
                            >
                                <div className="p-6 max-h-[600px] overflow-y-auto">
                                    {/* Preview Header */}
                                    <div className="text-center mb-6">
                                        {logoUrl && (
                                            <img
                                                src={logoUrl}
                                                alt="Logo"
                                                className="h-12 mx-auto mb-3 object-contain"
                                            />
                                        )}
                                        <div
                                            className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3"
                                            style={{
                                                backgroundColor: `${primaryColor}20`,
                                                color: primaryColor,
                                                border: `1px solid ${primaryColor}30`
                                            }}
                                        >
                                            Volunteer Signup
                                        </div>
                                        <h2 className="text-xl font-bold text-white mb-1">{formTitle || 'Your Title'}</h2>
                                        <p className="text-zinc-400 text-sm">{tagline || 'Your tagline here'}</p>
                                    </div>

                                    {/* Preview Form */}
                                    <div className="space-y-4 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                                        {fields.filter(f => f.enabled).map((field) => (
                                            <PreviewField
                                                key={field.id}
                                                field={field}
                                                primaryColor={primaryColor}
                                                ministries={ministries}
                                            />
                                        ))}

                                        <button
                                            className="w-full py-3 rounded-xl font-bold text-white mt-4"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            Submit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Color Picker Field Component with Wheel
function ColorPickerField({
    label,
    value,
    onChange
}: {
    label: string;
    value: string;
    onChange: (color: string) => void;
}) {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={pickerRef}>
            <label className="block text-sm font-medium mb-2">{label}</label>
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="w-full flex items-center gap-3 p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
                <div
                    className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-500 shadow-inner"
                    style={{ backgroundColor: value }}
                />
                <span className="font-mono text-sm flex-1 text-left">{value.toUpperCase()}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>

            {showPicker && (
                <div className="absolute z-50 mt-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                    <HexColorPicker color={value} onChange={onChange} />
                    <div className="mt-3 flex items-center gap-2">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="flex-1 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono"
                            placeholder="#000000"
                        />
                    </div>
                    {/* Preset colors */}
                    <div className="mt-3 flex gap-2 flex-wrap">
                        {['#10b981', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#64748b'].map((color) => (
                            <button
                                key={color}
                                onClick={() => onChange(color)}
                                className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-700 shadow-sm hover:scale-110 transition-transform"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Sub-components
function TabButton({ active, onClick, icon, label }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function FieldEditor({
    field,
    index,
    total,
    onUpdate,
    onRemove,
    onMove,
    isCore
}: {
    field: VolunteerFormField;
    index: number;
    total: number;
    onUpdate: (updates: Partial<VolunteerFormField>) => void;
    onRemove: () => void;
    onMove: (direction: 'up' | 'down') => void;
    isCore: boolean;
}) {
    const [expanded, setExpanded] = useState(false);

    const getTypeLabel = (type: VolunteerFormFieldType) => {
        const option = FIELD_TYPE_OPTIONS.find(o => o.value === type);
        return option?.label || type;
    };

    const getTypeIcon = (type: VolunteerFormFieldType) => {
        if (type === 'ministry_interests') return <Users className="w-3 h-3" />;
        if (type === 'availability') return <Calendar className="w-3 h-3" />;
        return null;
    };

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${
            expanded ? 'border-emerald-300 dark:border-emerald-700 shadow-md' : 'border-gray-200 dark:border-gray-700'
        } ${!field.enabled && 'opacity-60'}`}>
            {/* Header */}
            <div
                className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <button
                    className="text-gray-400 cursor-grab hover:text-gray-600"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="w-4 h-4" />
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdate({ enabled: !field.enabled });
                    }}
                    className={`${field.enabled ? 'text-green-600' : 'text-gray-400'}`}
                >
                    {field.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{field.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded flex items-center gap-1">
                            {getTypeIcon(field.type)}
                            {getTypeLabel(field.type)}
                        </span>
                        {field.required && (
                            <span className="text-xs text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                Required
                            </span>
                        )}
                        {isCore && (
                            <span className="text-xs text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                Core
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => onMove('up')}
                        disabled={index === 0}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                        title="Move up"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onMove('down')}
                        disabled={index === total - 1}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                        title="Move down"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                    {!isCore && (
                        <button
                            onClick={onRemove}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>

            {/* Expanded Editor */}
            {expanded && (
                <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    {/* Question Label */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Question</label>
                        <input
                            type="text"
                            value={field.label}
                            onChange={(e) => onUpdate({ label: e.target.value })}
                            className="w-full p-3 text-base border-0 border-b-2 border-gray-200 dark:border-gray-600 focus:border-emerald-500 focus:ring-0 bg-transparent font-medium"
                            placeholder="Enter your question"
                        />
                    </div>

                    {/* Field Type Selector - only show for non-special types */}
                    {!['ministry_interests', 'availability'].includes(field.type) && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Answer Type</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {FIELD_TYPE_OPTIONS.filter(o => !['ministry_interests', 'availability'].includes(o.value)).map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => onUpdate({ type: option.value })}
                                        disabled={isCore && !['name', 'short_answer'].includes(option.value)}
                                        className={`p-3 rounded-lg border text-left transition-all ${
                                            field.type === option.value
                                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                        <div className="font-medium text-sm">{option.label}</div>
                                        <div className="text-xs text-gray-500">{option.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Special field notice */}
                    {['ministry_interests', 'availability'].includes(field.type) && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                {field.type === 'ministry_interests'
                                    ? 'This field displays all active ministries as checkboxes.'
                                    : 'This field displays day-of-week availability toggles (Sun-Sat).'}
                            </p>
                        </div>
                    )}

                    {/* Placeholder - Only for text-based fields */}
                    {!['checkbox', 'select', 'ministry_interests', 'availability'].includes(field.type) && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Placeholder Text</label>
                            <input
                                type="text"
                                value={field.placeholder || ''}
                                onChange={(e) => onUpdate({ placeholder: e.target.value })}
                                className="w-full p-2.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                placeholder="e.g., Enter your answer here..."
                            />
                        </div>
                    )}

                    {/* Options for Select type */}
                    {field.type === 'select' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">Dropdown Options</label>
                            <div className="space-y-2">
                                {(field.options || []).map((option, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-gray-400 text-sm w-6">{idx + 1}.</span>
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => {
                                                const newOptions = [...(field.options || [])];
                                                newOptions[idx] = e.target.value;
                                                onUpdate({ options: newOptions });
                                            }}
                                            className="flex-1 p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            placeholder={`Option ${idx + 1}`}
                                        />
                                        <button
                                            onClick={() => {
                                                const newOptions = (field.options || []).filter((_, i) => i !== idx);
                                                onUpdate({ options: newOptions });
                                            }}
                                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => onUpdate({ options: [...(field.options || []), ''] })}
                                    className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add option
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Required Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-medium">Required</span>
                        <button
                            onClick={() => onUpdate({ required: !field.required })}
                            disabled={isCore}
                            className={`${field.required ? 'text-emerald-600' : 'text-gray-400'} disabled:opacity-50`}
                        >
                            {field.required ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToggleSetting({
    label,
    description,
    enabled,
    onChange
}: {
    label: string;
    description: string;
    enabled: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div>
                <h3 className="font-medium">{label}</h3>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
            <button
                onClick={() => onChange(!enabled)}
                className={`${enabled ? 'text-green-600' : 'text-gray-400'}`}
            >
                {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
        </div>
    );
}

function PreviewField({
    field,
    primaryColor,
    ministries
}: {
    field: VolunteerFormField;
    primaryColor: string;
    ministries: { id: string; name: string }[];
}) {
    // Ministry Interests field
    if (field.type === 'ministry_interests') {
        return (
            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">
                    {field.label}
                    {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                    {ministries.length > 0 ? ministries.slice(0, 4).map((m) => (
                        <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 cursor-pointer">
                            <input type="checkbox" className="w-3 h-3 rounded" style={{ accentColor: primaryColor }} disabled />
                            {m.name}
                        </label>
                    )) : (
                        <span className="text-xs text-zinc-500">Ministry checkboxes will appear here</span>
                    )}
                </div>
            </div>
        );
    }

    // Availability field
    if (field.type === 'availability') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return (
            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">
                    {field.label}
                    {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {days.map((day) => (
                        <button
                            key={day}
                            className="px-2.5 py-1 text-xs rounded-lg border transition-all bg-zinc-800/50 border-zinc-700/50 text-zinc-400"
                            disabled
                        >
                            {day}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (field.type === 'checkbox') {
        return (
            <label className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 cursor-pointer">
                <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    style={{ accentColor: primaryColor }}
                    disabled
                />
                <span className="text-zinc-300 text-sm">{field.label}</span>
            </label>
        );
    }

    if (field.type === 'paragraph') {
        return (
            <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">
                    {field.label}
                    {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                </label>
                <textarea
                    placeholder={field.placeholder}
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600 min-h-[60px]"
                    disabled
                />
            </div>
        );
    }

    if (field.type === 'select') {
        return (
            <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">
                    {field.label}
                    {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                </label>
                <select
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm"
                    disabled
                >
                    <option>{field.placeholder || 'Select...'}</option>
                </select>
            </div>
        );
    }

    // All other types render as text inputs
    const inputType =
        field.type === 'email' ? 'email' :
        field.type === 'phone' ? 'tel' : 'text';

    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">
                {field.label}
                {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
            </label>
            <input
                type={inputType}
                placeholder={field.placeholder}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600"
                disabled
            />
        </div>
    );
}
