'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MemberRegistrationService, DEFAULT_REGISTRATION_FIELDS, getDefaultRegistrationConfig } from '@/lib/services/MemberRegistrationService';
import { MemberRegistrationFormConfig, MemberRegistrationField, MemberRegistrationFieldType } from '@/types';
import { uploadMedia } from '@/lib/storage';
import { HexColorPicker } from 'react-colorful';
import { QRCodeSVG } from 'qrcode.react';
import {
    ArrowLeft, Save, Loader2, Eye, Palette, FormInput, CheckCircle, Settings,
    GripVertical, Plus, Trash2, ToggleLeft, ToggleRight, ExternalLink,
    Upload, X, ChevronDown, ChevronUp, Image as ImageIcon, Users, Heart,
    QrCode, Copy, Download, Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';

// Field type options with friendly names
const FIELD_TYPE_OPTIONS: { value: MemberRegistrationFieldType; label: string; description: string }[] = [
    { value: 'short_answer', label: 'Short Answer', description: 'Single line of text' },
    { value: 'paragraph', label: 'Paragraph', description: 'Multiple lines of text' },
    { value: 'name', label: 'Name', description: 'Person\'s name' },
    { value: 'email', label: 'Email', description: 'Email address' },
    { value: 'phone', label: 'Phone Number', description: 'Phone with formatting' },
    { value: 'number', label: 'Number', description: 'Numeric value only' },
    { value: 'date', label: 'Date', description: 'Date picker' },
    { value: 'checkbox', label: 'Checkbox', description: 'Yes/No toggle' },
    { value: 'select', label: 'Dropdown', description: 'Choose from options' },
    { value: 'url', label: 'URL', description: 'Website link' },
];

export default function MemberRegistrationEditorPage() {
    const { user, userData } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'branding' | 'fields' | 'family' | 'ministry' | 'success' | 'settings' | 'share'>('branding');

    // Form State - Branding
    const [formTitle, setFormTitle] = useState('');
    const [tagline, setTagline] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#d97706');
    const [backgroundColor, setBackgroundColor] = useState('#09090b');
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // Fields
    const [fields, setFields] = useState<MemberRegistrationField[]>([]);

    // Family Intake
    const [familyIntakeEnabled, setFamilyIntakeEnabled] = useState(true);
    const [askAboutSpouse, setAskAboutSpouse] = useState(true);
    const [askAboutChildren, setAskAboutChildren] = useState(true);
    const [askAboutOtherFamily, setAskAboutOtherFamily] = useState(false);
    const [maxFamilyMembers, setMaxFamilyMembers] = useState(10);

    // Ministry Settings
    const [ministryEnabled, setMinistryEnabled] = useState(true);
    const [allowMultipleMinistries, setAllowMultipleMinistries] = useState(true);

    // Success Message
    const [successTitle, setSuccessTitle] = useState('');
    const [successSubtitle, setSuccessSubtitle] = useState('');
    const [showNextSteps, setShowNextSteps] = useState(true);
    const [nextStepsContent, setNextStepsContent] = useState('');

    // Settings
    const [enabled, setEnabled] = useState(true);
    const [notifyAdmins, setNotifyAdmins] = useState(true);
    const [defaultMembershipStage, setDefaultMembershipStage] = useState<'visitor' | 'active' | 'inactive' | 'non-member'>('visitor');

    // Share tab
    const [copied, setCopied] = useState(false);

    // Load config
    useEffect(() => {
        if (userData?.churchId) {
            loadConfig();
        }
    }, [userData?.churchId]);

    const loadConfig = async () => {
        if (!userData?.churchId) return;

        try {
            const config = await MemberRegistrationService.getConfig(userData.churchId);

            setFormTitle(config.branding.formTitle);
            setTagline(config.branding.tagline);
            setLogoUrl(config.branding.logoUrl || '');
            setPrimaryColor(config.branding.primaryColor);
            setBackgroundColor(config.branding.backgroundColor);

            setFields(config.fields.length > 0 ? config.fields : DEFAULT_REGISTRATION_FIELDS);

            setFamilyIntakeEnabled(config.familyIntake.enabled);
            setAskAboutSpouse(config.familyIntake.askAboutSpouse);
            setAskAboutChildren(config.familyIntake.askAboutChildren);
            setAskAboutOtherFamily(config.familyIntake.askAboutOtherFamily);
            setMaxFamilyMembers(config.familyIntake.maxFamilyMembers);

            setMinistryEnabled(config.ministrySettings.enabled);
            setAllowMultipleMinistries(config.ministrySettings.allowMultiple);

            setSuccessTitle(config.successMessage.title);
            setSuccessSubtitle(config.successMessage.subtitle);
            setShowNextSteps(config.successMessage.showNextSteps || false);
            setNextStepsContent(config.successMessage.nextStepsContent || '');

            setEnabled(config.settings.enabled);
            setNotifyAdmins(config.settings.notifyAdmins);
            setDefaultMembershipStage(config.settings.defaultMembershipStage);
        } catch (error) {
            console.error('Error loading config:', error);
            const defaults = getDefaultRegistrationConfig(userData.churchId);
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

    const handleSave = async () => {
        if (!userData?.churchId || !user?.uid) {
            alert('Error: Not authenticated. Please refresh and try again.');
            return;
        }

        setSaving(true);
        try {
            await MemberRegistrationService.saveConfig(
                userData.churchId,
                {
                    branding: {
                        formTitle,
                        tagline,
                        ...(logoUrl ? { logoUrl } : {}),
                        primaryColor,
                        backgroundColor
                    },
                    fields,
                    familyIntake: {
                        enabled: familyIntakeEnabled,
                        askAboutSpouse,
                        askAboutChildren,
                        askAboutOtherFamily,
                        maxFamilyMembers
                    },
                    ministrySettings: {
                        enabled: ministryEnabled,
                        allowMultiple: allowMultipleMinistries,
                        ministryOptions: []
                    },
                    successMessage: {
                        title: successTitle,
                        subtitle: successSubtitle,
                        showNextSteps,
                        nextStepsContent
                    },
                    settings: {
                        enabled,
                        notifyAdmins,
                        defaultMembershipStage
                    }
                },
                user.uid
            );
            alert('Member registration form saved successfully!');
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
            const url = await uploadMedia(file, 'member-registration/logos');
            setLogoUrl(url);
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Failed to upload logo. Please try again.');
        } finally {
            setUploadingLogo(false);
        }
    };

    // Field Management
    const updateField = (index: number, updates: Partial<MemberRegistrationField>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...updates };
        setFields(newFields);
    };

    const removeField = (index: number) => {
        const field = fields[index];
        if (['firstName', 'lastName', 'email'].includes(field.id)) {
            alert('This field cannot be removed.');
            return;
        }
        setFields(fields.filter((_, i) => i !== index));
    };

    const addField = () => {
        const newField: MemberRegistrationField = {
            id: `custom_${Date.now()}`,
            type: 'short_answer',
            label: 'New Question',
            placeholder: 'Enter your answer',
            required: false,
            enabled: true,
            order: fields.length,
            mapsTo: 'custom'
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

    // Get public URL
    const getPublicUrl = () => {
        if (typeof window === 'undefined') return '';
        return `${window.location.origin}/register/${userData?.churchId}`;
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(getPublicUrl());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDownloadQR = () => {
        const svg = document.getElementById('registration-qr-code');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.download = 'member-registration-qr.png';
            downloadLink.href = pngFile;
            downloadLink.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    // Role Check
    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">You must be an admin to edit the Member Registration Form.</p>
                <Link href="/" className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700">
                    Return Home
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Member Registration Form</h1>
                        <p className="text-sm text-gray-500">Configure your new member registration form</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/register/${userData?.churchId}`}
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
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
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
                    label="Branding"
                    color="amber"
                />
                <TabButton
                    active={activeTab === 'fields'}
                    onClick={() => setActiveTab('fields')}
                    icon={<FormInput className="w-4 h-4" />}
                    label="Questions"
                    color="amber"
                />
                <TabButton
                    active={activeTab === 'family'}
                    onClick={() => setActiveTab('family')}
                    icon={<Users className="w-4 h-4" />}
                    label="Family"
                    color="amber"
                />
                <TabButton
                    active={activeTab === 'ministry'}
                    onClick={() => setActiveTab('ministry')}
                    icon={<Heart className="w-4 h-4" />}
                    label="Ministries"
                    color="amber"
                />
                <TabButton
                    active={activeTab === 'success'}
                    onClick={() => setActiveTab('success')}
                    icon={<CheckCircle className="w-4 h-4" />}
                    label="Success"
                    color="amber"
                />
                <TabButton
                    active={activeTab === 'settings'}
                    onClick={() => setActiveTab('settings')}
                    icon={<Settings className="w-4 h-4" />}
                    label="Settings"
                    color="amber"
                />
                <TabButton
                    active={activeTab === 'share'}
                    onClick={() => setActiveTab('share')}
                    icon={<QrCode className="w-4 h-4" />}
                    label="Share"
                    color="amber"
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
                                        <label className="block text-sm font-medium mb-1">Form Title</label>
                                        <input
                                            type="text"
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            placeholder="Member Registration"
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
                                            placeholder="Join our church family today!"
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
                                    <h2 className="text-lg font-semibold">Registration Questions</h2>
                                    <p className="text-sm text-gray-500">Click on a question to edit it</p>
                                </div>
                                <button
                                    onClick={addField}
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-sm font-medium hover:from-amber-700 hover:to-orange-700 shadow-md transition-all"
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
                                        isCore={['firstName', 'lastName', 'email'].includes(field.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'family' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold mb-2">Family Intake</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    Allow new members to add family members during registration
                                </p>

                                <div className="space-y-4">
                                    <ToggleSetting
                                        label="Enable Family Intake"
                                        description="Ask if they have family members who attend or will attend"
                                        enabled={familyIntakeEnabled}
                                        onChange={setFamilyIntakeEnabled}
                                    />

                                    {familyIntakeEnabled && (
                                        <div className="pl-4 border-l-2 border-amber-200 dark:border-amber-800 space-y-4">
                                            <ToggleSetting
                                                label="Ask About Spouse"
                                                description="Include spouse/partner registration"
                                                enabled={askAboutSpouse}
                                                onChange={setAskAboutSpouse}
                                            />
                                            <ToggleSetting
                                                label="Ask About Children"
                                                description="Allow adding children to the family"
                                                enabled={askAboutChildren}
                                                onChange={setAskAboutChildren}
                                            />
                                            <ToggleSetting
                                                label="Ask About Other Family"
                                                description="Allow adding other relatives (parents, siblings, etc.)"
                                                enabled={askAboutOtherFamily}
                                                onChange={setAskAboutOtherFamily}
                                            />
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Max Family Members</label>
                                                <input
                                                    type="number"
                                                    value={maxFamilyMembers}
                                                    onChange={(e) => setMaxFamilyMembers(parseInt(e.target.value) || 10)}
                                                    min={1}
                                                    max={20}
                                                    className="w-24 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ministry' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold mb-2">Ministry Interests</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    Allow new members to indicate which ministries they're interested in
                                </p>

                                <div className="space-y-4">
                                    <ToggleSetting
                                        label="Enable Ministry Selection"
                                        description="Show ministry interest checkboxes on the form"
                                        enabled={ministryEnabled}
                                        onChange={setMinistryEnabled}
                                    />

                                    {ministryEnabled && (
                                        <div className="pl-4 border-l-2 border-amber-200 dark:border-amber-800 space-y-4">
                                            <ToggleSetting
                                                label="Allow Multiple Selections"
                                                description="Let members select interest in multiple ministries"
                                                enabled={allowMultipleMinistries}
                                                onChange={setAllowMultipleMinistries}
                                            />
                                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                                    Ministry options are automatically pulled from your church's configured ministries.
                                                    Manage ministries in the <Link href="/admin/ministries" className="underline font-medium">Ministries settings</Link>.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'success' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <h2 className="text-lg font-semibold">Success Message</h2>
                            <p className="text-sm text-gray-500">Customize what new members see after registering.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={successTitle}
                                        onChange={(e) => setSuccessTitle(e.target.value)}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="Welcome to the Family!"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Subtitle</label>
                                    <textarea
                                        value={successSubtitle}
                                        onChange={(e) => setSuccessSubtitle(e.target.value)}
                                        rows={3}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="Thank you for registering..."
                                    />
                                </div>

                                <ToggleSetting
                                    label="Show Next Steps"
                                    description="Display additional instructions after registration"
                                    enabled={showNextSteps}
                                    onChange={setShowNextSteps}
                                />

                                {showNextSteps && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Next Steps Content</label>
                                        <textarea
                                            value={nextStepsContent}
                                            onChange={(e) => setNextStepsContent(e.target.value)}
                                            rows={3}
                                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                            placeholder="A member of our team will reach out to you soon..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <h2 className="text-lg font-semibold">Form Settings</h2>

                            <div className="space-y-4">
                                <ToggleSetting
                                    label="Enable Registration Form"
                                    description="When disabled, the public form will show a 'coming soon' message."
                                    enabled={enabled}
                                    onChange={setEnabled}
                                />

                                <ToggleSetting
                                    label="Notify Admins"
                                    description="Send notifications when new members register."
                                    enabled={notifyAdmins}
                                    onChange={setNotifyAdmins}
                                />

                                <div>
                                    <label className="block text-sm font-medium mb-1">Default Membership Stage</label>
                                    <select
                                        value={defaultMembershipStage}
                                        onChange={(e) => setDefaultMembershipStage(e.target.value as any)}
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    >
                                        <option value="visitor">Visitor</option>
                                        <option value="active">Active Member</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="non-member">Non-Member</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        New registrants will be assigned this membership stage by default.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'share' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                            <h2 className="text-lg font-semibold">Share Your Registration Form</h2>
                            <p className="text-sm text-gray-500">
                                Share this form with potential new members via link or QR code.
                            </p>

                            {/* QR Code */}
                            <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                <div className="bg-white p-4 rounded-xl shadow-md">
                                    <QRCodeSVG
                                        id="registration-qr-code"
                                        value={getPublicUrl()}
                                        size={200}
                                        level="H"
                                        includeMargin
                                        fgColor={primaryColor}
                                    />
                                </div>
                                <button
                                    onClick={handleDownloadQR}
                                    className="flex items-center gap-2 mt-4 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-medium hover:from-amber-700 hover:to-orange-700 shadow-md transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    Download QR Code
                                </button>
                            </div>

                            {/* Link */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Registration Link</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={getPublicUrl()}
                                        readOnly
                                        className="flex-1 p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600 text-sm font-mono"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            {/* Open Link */}
                            <Link
                                href={getPublicUrl()}
                                target="_blank"
                                className="flex items-center justify-center gap-2 w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open Registration Form
                            </Link>
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
                                            New Member Registration
                                        </div>
                                        <h2 className="text-xl font-bold text-white mb-1">{formTitle || 'Member Registration'}</h2>
                                        <p className="text-zinc-400 text-sm">{tagline || 'Join our church family today!'}</p>
                                    </div>

                                    {/* Preview Form */}
                                    <div className="space-y-4 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                                        {fields.filter(f => f.enabled).slice(0, 5).map((field) => (
                                            <PreviewField key={field.id} field={field} primaryColor={primaryColor} />
                                        ))}

                                        {fields.filter(f => f.enabled).length > 5 && (
                                            <div className="text-center text-zinc-500 text-sm py-2">
                                                +{fields.filter(f => f.enabled).length - 5} more fields...
                                            </div>
                                        )}

                                        {familyIntakeEnabled && (
                                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                                                    <Users className="w-4 h-4" />
                                                    Family Members Section
                                                </div>
                                            </div>
                                        )}

                                        {ministryEnabled && (
                                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                                                    <Heart className="w-4 h-4" />
                                                    Ministry Interests Section
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            className="w-full py-3 rounded-xl font-bold text-white mt-4"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            Complete Registration
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

// Color Picker Field Component
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
                    <div className="mt-3 flex gap-2 flex-wrap">
                        {['#d97706', '#b45309', '#ea580c', '#dc2626', '#16a34a', '#2563eb', '#7c3aed', '#64748b'].map((color) => (
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
function TabButton({ active, onClick, icon, label, color = 'blue' }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color?: 'blue' | 'amber';
}) {
    const activeClass = color === 'amber' ? 'border-amber-600 text-amber-600' : 'border-blue-600 text-blue-600';

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                    ? activeClass
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
    field: MemberRegistrationField;
    index: number;
    total: number;
    onUpdate: (updates: Partial<MemberRegistrationField>) => void;
    onRemove: () => void;
    onMove: (direction: 'up' | 'down') => void;
    isCore: boolean;
}) {
    const [expanded, setExpanded] = useState(false);

    const getTypeLabel = (type: MemberRegistrationFieldType) => {
        const option = FIELD_TYPE_OPTIONS.find(o => o.value === type);
        if (option) return option.label;
        if (type === 'text') return 'Short Answer';
        if (type === 'textarea') return 'Paragraph';
        return type;
    };

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${
            expanded ? 'border-amber-300 dark:border-amber-700 shadow-md' : 'border-gray-200 dark:border-gray-700'
        } ${!field.enabled && 'opacity-60'}`}>
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
                        <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                            {getTypeLabel(field.type)}
                        </span>
                        {field.required && (
                            <span className="text-xs text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded">
                                Required
                            </span>
                        )}
                        {isCore && (
                            <span className="text-xs text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">
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
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onMove('down')}
                        disabled={index === total - 1}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                    {!isCore && (
                        <button
                            onClick={onRemove}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>

            {expanded && (
                <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Question</label>
                        <input
                            type="text"
                            value={field.label}
                            onChange={(e) => onUpdate({ label: e.target.value })}
                            className="w-full p-3 text-base border-0 border-b-2 border-gray-200 dark:border-gray-600 focus:border-amber-500 focus:ring-0 bg-transparent font-medium"
                            placeholder="Enter your question"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Answer Type</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {FIELD_TYPE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => onUpdate({ type: option.value })}
                                    disabled={isCore && !['text', 'short_answer', 'name', 'email'].includes(option.value)}
                                    className={`p-3 rounded-lg border text-left transition-all ${
                                        (field.type === option.value || (field.type === 'text' && option.value === 'short_answer'))
                                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    <div className="font-medium text-sm">{option.label}</div>
                                    <div className="text-xs text-gray-500">{option.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {!['checkbox', 'select', 'date'].includes(field.type) && (
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
                                    className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium mt-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add option
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-medium">Required</span>
                        <button
                            onClick={() => onUpdate({ required: !field.required })}
                            disabled={isCore}
                            className={`${field.required ? 'text-amber-600' : 'text-gray-400'} disabled:opacity-50`}
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
                className={`${enabled ? 'text-amber-600' : 'text-gray-400'}`}
            >
                {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
        </div>
    );
}

function PreviewField({ field, primaryColor }: { field: MemberRegistrationField; primaryColor: string }) {
    const type = field.type === 'text' ? 'short_answer' : field.type === 'textarea' ? 'paragraph' : field.type;

    if (type === 'checkbox') {
        return (
            <label className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: primaryColor }} disabled />
                <span className="text-zinc-300 text-sm">{field.label}</span>
            </label>
        );
    }

    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">
                {field.label}
                {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
            </label>
            <input
                type="text"
                placeholder={field.placeholder}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600"
                disabled
            />
        </div>
    );
}
