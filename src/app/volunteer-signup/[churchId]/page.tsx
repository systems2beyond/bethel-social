'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VolunteerRecruitmentService } from '@/lib/services/VolunteerRecruitmentService';
import { VolunteerFormService, getDefaultConfig } from '@/lib/services/VolunteerFormService';
import { Ministry, Church, VolunteerFormConfig, VolunteerFormField } from '@/types';
import { cn } from '@/lib/utils';
import {
    Heart,
    CheckCircle,
    Loader2
} from 'lucide-react';

export default function VolunteerSignupPage() {
    const params = useParams();
    const churchId = params.churchId as string;

    const [church, setChurch] = useState<Church | null>(null);
    const [config, setConfig] = useState<VolunteerFormConfig | null>(null);
    const [ministries, setMinistries] = useState<Ministry[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dynamic form state based on fields
    const [formData, setFormData] = useState<Record<string, any>>({
        name: '',
        email: '',
        phone: '',
        ministryInterests: [],
        availability: {
            sunday: false,
            monday: false,
            tuesday: false,
            wednesday: false,
            thursday: false,
            friday: false,
            saturday: false
        },
        skills: '',
        message: ''
    });

    // Fetch church, config, and ministries
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch church info
                const churchRef = doc(db, 'churches', churchId);
                const churchSnap = await getDoc(churchRef);
                if (churchSnap.exists()) {
                    setChurch({ id: churchSnap.id, ...churchSnap.data() } as Church);
                }

                // Fetch form config
                const formConfig = await VolunteerFormService.getPublicConfig(churchId);
                if (formConfig) {
                    setConfig(formConfig);
                } else {
                    // Use defaults
                    setConfig({
                        id: churchId,
                        ...getDefaultConfig(churchId),
                        updatedAt: null,
                        updatedBy: ''
                    });
                }

                // Fetch ministries
                const ministriesQuery = query(
                    collection(db, 'ministries'),
                    where('churchId', '==', churchId),
                    where('active', '==', true)
                );
                const ministriesSnap = await getDocs(ministriesQuery);
                const ministriesList = ministriesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Ministry[];
                setMinistries(ministriesList);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Unable to load form. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        if (churchId) {
            fetchData();
        }
    }, [churchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        const enabledFields = config?.fields.filter(f => f.enabled) || [];
        for (const field of enabledFields) {
            if (field.required) {
                const value = formData[field.id];
                if (!value || (Array.isArray(value) && value.length === 0)) {
                    setError(`Please fill in ${field.label}`);
                    return;
                }
            }
        }

        if (!formData.name || !formData.email) {
            setError('Please fill in your name and email');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // Check for existing signup
            const existing = await VolunteerRecruitmentService.checkExistingSignup(churchId, formData.email);
            if (existing) {
                setError('You have already signed up. We\'ll be in touch soon!');
                setSubmitting(false);
                return;
            }

            // Create signup
            await VolunteerRecruitmentService.createSignup({
                churchId,
                name: formData.name,
                email: formData.email.toLowerCase(),
                phone: formData.phone || undefined,
                ministryInterests: formData.ministryInterests || [],
                availability: formData.availability,
                skills: typeof formData.skills === 'string'
                    ? formData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [],
                message: formData.message || undefined,
                status: 'new',
                source: 'form'
            });

            setSubmitted(true);
        } catch (err) {
            console.error('Error submitting:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleMinistry = (name: string) => {
        setFormData(prev => ({
            ...prev,
            ministryInterests: prev.ministryInterests.includes(name)
                ? prev.ministryInterests.filter((n: string) => n !== name)
                : [...prev.ministryInterests, name]
        }));
    };

    const toggleAvailability = (day: string) => {
        setFormData(prev => ({
            ...prev,
            availability: { ...prev.availability, [day]: !prev.availability[day] }
        }));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    // Form disabled
    if (config && !config.settings.enabled) {
        return (
            <div
                className="min-h-screen flex items-center justify-center p-4"
                style={{ backgroundColor: config.branding.backgroundColor }}
            >
                <div className="max-w-md w-full bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/10">
                    <h1 className="text-2xl font-bold text-white mb-2">Coming Soon</h1>
                    <p className="text-zinc-400">
                        Our volunteer signup form is currently being set up. Please check back later.
                    </p>
                </div>
            </div>
        );
    }

    // Success state
    if (submitted && config) {
        return (
            <div
                className="min-h-screen flex items-center justify-center p-4"
                style={{ backgroundColor: config.branding.backgroundColor }}
            >
                <div className="max-w-md w-full bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/10">
                    <div
                        className="inline-flex p-4 rounded-full mb-6"
                        style={{ backgroundColor: `${config.branding.primaryColor}20` }}
                    >
                        <CheckCircle className="h-12 w-12" style={{ color: config.branding.primaryColor }} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        {config.successMessage.title || 'Thank You!'}
                    </h1>
                    <p className="text-zinc-400 mb-6">
                        {config.successMessage.subtitle || `We've received your interest. Someone from ${church?.name || 'the church'} will be in touch soon.`}
                    </p>
                </div>
            </div>
        );
    }

    // Get enabled fields sorted by order
    const enabledFields = config?.fields
        .filter(f => f.enabled)
        .sort((a, b) => a.order - b.order) || [];

    const branding = config?.branding || getDefaultConfig(churchId).branding;
    const primaryColor = branding.primaryColor;
    const backgroundColor = branding.backgroundColor;

    return (
        <div
            className="min-h-screen p-4 py-8"
            style={{ backgroundColor }}
        >
            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    {branding.logoUrl && (
                        <img
                            src={branding.logoUrl}
                            alt="Logo"
                            className="h-16 mx-auto mb-4 object-contain"
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
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {branding.formTitle || 'Volunteer With Us'}
                    </h1>
                    <p className="text-zinc-400">
                        {branding.tagline || (church && church.name)}
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800 p-6 space-y-6"
                >
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Render fields dynamically */}
                    {enabledFields.map((field) => (
                        <DynamicField
                            key={field.id}
                            field={field}
                            value={formData[field.id]}
                            onChange={(value) => setFormData(prev => ({ ...prev, [field.id]: value }))}
                            ministries={ministries}
                            primaryColor={primaryColor}
                            toggleMinistry={toggleMinistry}
                            toggleAvailability={toggleAvailability}
                            formData={formData}
                        />
                    ))}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Heart className="h-5 w-5" />
                                Sign Up to Volunteer
                            </>
                        )}
                    </button>

                    <p className="text-xs text-center text-zinc-500">
                        By submitting this form, you agree to be contacted about volunteer opportunities.
                    </p>
                </form>
            </div>
        </div>
    );
}

// Dynamic field renderer
function DynamicField({
    field,
    value,
    onChange,
    ministries,
    primaryColor,
    toggleMinistry,
    toggleAvailability,
    formData
}: {
    field: VolunteerFormField;
    value: any;
    onChange: (value: any) => void;
    ministries: Ministry[];
    primaryColor: string;
    toggleMinistry: (name: string) => void;
    toggleAvailability: (day: string) => void;
    formData: Record<string, any>;
}) {
    // Ministry Interests - special field
    if (field.type === 'ministry_interests') {
        return (
            <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">
                    {field.label}
                    {!field.required && <span className="text-zinc-500 ml-1">(optional)</span>}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ministries.map(ministry => (
                        <button
                            key={ministry.id}
                            type="button"
                            onClick={() => toggleMinistry(ministry.name)}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                                formData.ministryInterests?.includes(ministry.name)
                                    ? "border-opacity-100 bg-opacity-10"
                                    : "border-zinc-700 hover:border-zinc-600"
                            )}
                            style={formData.ministryInterests?.includes(ministry.name) ? {
                                borderColor: primaryColor,
                                backgroundColor: `${primaryColor}10`
                            } : {}}
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                                style={{ backgroundColor: ministry.color || primaryColor }}
                            >
                                {ministry.name.charAt(0)}
                            </div>
                            <span className="font-medium text-sm text-zinc-200">{ministry.name}</span>
                            {formData.ministryInterests?.includes(ministry.name) && (
                                <CheckCircle className="h-4 w-4 ml-auto" style={{ color: primaryColor }} />
                            )}
                        </button>
                    ))}
                </div>
                {ministries.length === 0 && (
                    <p className="text-sm text-zinc-500 italic">
                        No ministries available at this time.
                    </p>
                )}
            </div>
        );
    }

    // Availability - special field
    if (field.type === 'availability') {
        const days = [
            { key: 'sunday', label: 'Sun' },
            { key: 'monday', label: 'Mon' },
            { key: 'tuesday', label: 'Tue' },
            { key: 'wednesday', label: 'Wed' },
            { key: 'thursday', label: 'Thu' },
            { key: 'friday', label: 'Fri' },
            { key: 'saturday', label: 'Sat' }
        ];

        return (
            <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">
                    {field.label}
                    {!field.required && <span className="text-zinc-500 ml-1">(optional)</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                    {days.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => toggleAvailability(key)}
                            className={cn(
                                "px-4 py-2 rounded-full border-2 font-medium text-sm transition-all",
                                formData.availability?.[key]
                                    ? ""
                                    : "border-zinc-700 hover:border-zinc-600 text-zinc-400"
                            )}
                            style={formData.availability?.[key] ? {
                                borderColor: primaryColor,
                                backgroundColor: `${primaryColor}15`,
                                color: primaryColor
                            } : {}}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Checkbox
    if (field.type === 'checkbox') {
        return (
            <label className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700 cursor-pointer">
                <input
                    type="checkbox"
                    checked={value || false}
                    onChange={(e) => onChange(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: primaryColor }}
                />
                <span className="text-zinc-200 text-sm">{field.label}</span>
            </label>
        );
    }

    // Paragraph / textarea
    if (field.type === 'paragraph') {
        return (
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                    {!field.required && <span className="text-zinc-500 ml-1">(optional)</span>}
                </label>
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    required={field.required}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-0 resize-y"
                />
            </div>
        );
    }

    // Select / dropdown
    if (field.type === 'select') {
        return (
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                    {!field.required && <span className="text-zinc-500 ml-1">(optional)</span>}
                </label>
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={field.required}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-zinc-500 focus:ring-0"
                >
                    <option value="">{field.placeholder || 'Select...'}</option>
                    {(field.options || []).map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
    }

    // All other text-based fields
    const inputType =
        field.type === 'email' ? 'email' :
        field.type === 'phone' ? 'tel' : 'text';

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
                {!field.required && <span className="text-zinc-500 ml-1">(optional)</span>}
            </label>
            <input
                type={inputType}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-0"
            />
        </div>
    );
}
