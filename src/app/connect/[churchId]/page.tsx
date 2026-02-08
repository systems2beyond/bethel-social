'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { VisitorsService } from '@/lib/visitors';
import { ConnectFormService, getDefaultConfig } from '@/lib/connect-form';
import { PulpitService } from '@/lib/services/PulpitService';
import { ConnectFormConfig, ConnectFormField } from '@/types';
import { Loader2 } from 'lucide-react';

export default function ConnectPage() {
    const params = useParams();
    const churchId = params.churchId as string;

    const [config, setConfig] = useState<ConnectFormConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Load config on mount
    useEffect(() => {
        if (churchId) {
            loadConfig();
        }
    }, [churchId]);

    const loadConfig = async () => {
        try {
            const loadedConfig = await ConnectFormService.getPublicConfig(churchId);

            if (loadedConfig) {
                setConfig(loadedConfig);
                // Initialize form data with empty values for enabled fields
                const initialData: Record<string, any> = {};
                loadedConfig.fields.filter(f => f.enabled).forEach(field => {
                    initialData[field.id] = field.type === 'checkbox' ? false : '';
                });
                setFormData(initialData);
            } else {
                // Use defaults
                const defaults = getDefaultConfig(churchId);
                setConfig({
                    id: churchId,
                    ...defaults,
                    updatedAt: null,
                    updatedBy: ''
                });
                const initialData: Record<string, any> = {};
                defaults.fields.filter(f => f.enabled).forEach(field => {
                    initialData[field.id] = field.type === 'checkbox' ? false : '';
                });
                setFormData(initialData);
            }
        } catch (error) {
            console.error('Error loading config:', error);
            // Fallback to defaults
            const defaults = getDefaultConfig(churchId);
            setConfig({
                id: churchId,
                ...defaults,
                updatedAt: null,
                updatedBy: ''
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Map form data to visitor format with churchId
            const visitorData = {
                firstName: formData.firstName || '',
                lastName: formData.lastName || '',
                phone: formData.phone || '',
                email: formData.email || '',
                isFirstTime: formData.isFirstTime || false,
                prayerRequests: formData.prayerRequests || '',
                churchId: churchId, // Include churchId for multi-tenancy
                // Include any custom fields
                customFields: Object.fromEntries(
                    Object.entries(formData).filter(([key]) =>
                        !['firstName', 'lastName', 'phone', 'email', 'isFirstTime', 'prayerRequests'].includes(key)
                    )
                )
            };

            // Create visitor record
            const visitorId = await VisitorsService.createVisitor(visitorData);

            // Also create a pulpit_checkin if there's an active session
            // This makes the check-in appear on the Pulpit Dashboard in real-time
            try {
                console.log('[Connect Form] Looking for active session with churchId:', churchId);
                const activeSession = await PulpitService.getActiveSession(churchId);
                console.log('[Connect Form] Active session found:', activeSession ? { id: activeSession.id, status: activeSession.status, churchId: activeSession.churchId } : 'NONE');

                if (activeSession) {
                    const fullName = `${visitorData.firstName} ${visitorData.lastName}`.trim() || 'Guest';
                    console.log('[Connect Form] Creating pulpit check-in for session:', activeSession.id);
                    // Use null instead of undefined for empty values (Firestore rejects undefined)
                    const checkinId = await PulpitService.createCheckin({
                        sessionId: activeSession.id,
                        churchId: churchId,
                        visitorId: visitorId,
                        name: fullName,
                        isFirstTime: visitorData.isFirstTime || false,
                        source: 'qr-code',
                        notes: visitorData.prayerRequests || null,
                        prayerRequest: visitorData.prayerRequests || null
                    });
                    console.log('[Connect Form] Pulpit check-in created with ID:', checkinId);
                } else {
                    console.warn('[Connect Form] No active session found for churchId:', churchId, '- check-in will only appear in pipeline');
                }
            } catch (sessionError) {
                // Non-critical: If pulpit check-in fails, visitor is still saved
                console.warn('[Connect Form] Could not create pulpit check-in:', sessionError);
            }

            setSuccess(true);
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-dvh bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!config) return null;

    const { branding, fields, successMessage, settings } = config;
    const enabledFields = fields.filter(f => f.enabled).sort((a, b) => a.order - b.order);

    // Form disabled state
    if (!settings.enabled) {
        return (
            <div
                className="min-h-dvh flex items-center justify-center p-6 text-center"
                style={{ backgroundColor: branding.backgroundColor }}
            >
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
                    <h1 className="text-2xl font-bold text-white mb-2">{branding.churchName}</h1>
                    <p className="text-zinc-400">Our digital connection card is coming soon.</p>
                </div>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div
                className="min-h-dvh overflow-y-auto flex items-center justify-center p-6 text-center"
                style={{ backgroundColor: branding.backgroundColor }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl"
                >
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: `${branding.primaryColor}20`, color: branding.primaryColor }}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{successMessage.title}</h1>
                    <p className="text-zinc-400">{successMessage.subtitle}</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div
            className="h-dvh overflow-y-auto overscroll-contain py-8 px-4 sm:px-6 sm:py-12 pb-24"
            style={{ backgroundColor: branding.backgroundColor }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg mx-auto"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    {branding.logoUrl && (
                        <img
                            src={branding.logoUrl}
                            alt={branding.churchName}
                            className="h-16 mx-auto mb-4 object-contain"
                        />
                    )}
                    <div
                        className="inline-block px-4 py-1.5 rounded-full text-sm font-medium mb-4"
                        style={{
                            backgroundColor: `${branding.primaryColor}15`,
                            color: branding.primaryColor,
                            border: `1px solid ${branding.primaryColor}30`
                        }}
                    >
                        Digital Connection Card
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">{branding.churchName}</h1>
                    <p className="text-zinc-400">{branding.tagline}</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">

                    {/* Render fields dynamically */}
                    {renderFields(enabledFields, formData, updateField, branding.primaryColor)}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        style={{
                            backgroundColor: branding.primaryColor,
                            boxShadow: `0 10px 25px -5px ${branding.primaryColor}30`
                        }}
                    >
                        {submitting ? 'Connecting...' : 'Connect With Us'}
                    </button>

                </form>

                <div className="text-center mt-8 text-zinc-600 text-sm">
                    Protected by Bethel Secure &bull; Privacy Policy
                </div>
            </motion.div>
        </div>
    );
}

// Helper function to render fields dynamically
function renderFields(
    fields: ConnectFormField[],
    formData: Record<string, any>,
    updateField: (id: string, value: any) => void,
    primaryColor: string
) {
    // Group firstName and lastName into a row if both exist
    const firstNameField = fields.find(f => f.id === 'firstName');
    const lastNameField = fields.find(f => f.id === 'lastName');
    const otherFields = fields.filter(f => f.id !== 'firstName' && f.id !== 'lastName');

    return (
        <>
            {/* Name row */}
            {(firstNameField || lastNameField) && (
                <div className="grid grid-cols-2 gap-4">
                    {firstNameField && (
                        <FormField
                            field={firstNameField}
                            value={formData[firstNameField.id]}
                            onChange={(v) => updateField(firstNameField.id, v)}
                            primaryColor={primaryColor}
                        />
                    )}
                    {lastNameField && (
                        <FormField
                            field={lastNameField}
                            value={formData[lastNameField.id]}
                            onChange={(v) => updateField(lastNameField.id, v)}
                            primaryColor={primaryColor}
                        />
                    )}
                </div>
            )}

            {/* Other fields */}
            {otherFields.map(field => (
                <FormField
                    key={field.id}
                    field={field}
                    value={formData[field.id]}
                    onChange={(v) => updateField(field.id, v)}
                    primaryColor={primaryColor}
                />
            ))}
        </>
    );
}

function FormField({
    field,
    value,
    onChange,
    primaryColor
}: {
    field: ConnectFormField;
    value: any;
    onChange: (value: any) => void;
    primaryColor: string;
}) {
    const baseInputClass = "w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all placeholder:text-zinc-600";
    const focusStyle = { '--tw-ring-color': `${primaryColor}50` } as React.CSSProperties;

    // Normalize legacy types
    const fieldType = field.type === 'text' ? 'short_answer' : field.type === 'textarea' ? 'paragraph' : field.type;

    if (fieldType === 'checkbox') {
        return (
            <div className="pt-2">
                <label className="flex items-center gap-3 p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                    <input
                        type="checkbox"
                        checked={value || false}
                        onChange={e => onChange(e.target.checked)}
                        className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 focus:ring-2"
                        style={{ accentColor: primaryColor }}
                    />
                    <span className="text-zinc-300 font-medium">{field.label}</span>
                </label>
            </div>
        );
    }

    if (fieldType === 'paragraph') {
        return (
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">
                    {field.label}
                    {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                </label>
                <textarea
                    required={field.required}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className={`${baseInputClass} min-h-[100px] resize-none focus:ring-2`}
                    style={focusStyle}
                />
            </div>
        );
    }

    if (fieldType === 'select' && field.options) {
        return (
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">
                    {field.label}
                    {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                </label>
                <select
                    required={field.required}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className={`${baseInputClass} focus:ring-2`}
                    style={focusStyle}
                >
                    <option value="">{field.placeholder || 'Select...'}</option>
                    {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (fieldType === 'date') {
        return (
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">
                    {field.label}
                    {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                </label>
                <input
                    type="date"
                    required={field.required}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className={`${baseInputClass} focus:ring-2`}
                    style={focusStyle}
                />
            </div>
        );
    }

    // Map field types to HTML input types
    const getInputType = () => {
        switch (fieldType) {
            case 'email': return 'email';
            case 'phone': return 'tel';
            case 'number': return 'number';
            case 'url': return 'url';
            default: return 'text';
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">
                {field.label}
                {!field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
            </label>
            <input
                type={getInputType()}
                required={field.required}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={field.placeholder}
                className={`${baseInputClass} focus:ring-2`}
                style={focusStyle}
            />
        </div>
    );
}
