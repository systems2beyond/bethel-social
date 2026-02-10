'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MemberRegistrationService, getDefaultRegistrationConfig } from '@/lib/services/MemberRegistrationService';
import { MemberRegistrationFormConfig, MemberRegistrationField, FamilyMemberEntry, FirestoreUser, MemberRegistrationSubmission } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serverTimestamp } from 'firebase/firestore';
import {
    Loader2, ChevronRight, ChevronLeft, Users, Heart, CheckCircle,
    Plus, Trash2, Search, User, X, AlertCircle
} from 'lucide-react';
import AddressAutocompleteInput, { ParsedAddress } from '@/components/Shared/AddressAutocompleteInput';

type Step = 'info' | 'family' | 'ministry' | 'review';

export default function MemberRegistrationPage() {
    const params = useParams();
    const churchId = params.churchId as string;

    const [config, setConfig] = useState<MemberRegistrationFormConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Multi-step state
    const [currentStep, setCurrentStep] = useState<Step>('info');

    // Form data
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [familyMembers, setFamilyMembers] = useState<FamilyMemberEntry[]>([]);
    const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
    const [ministries, setMinistries] = useState<{ id: string; name: string; description?: string }[]>([]);

    // Family member search
    const [searchingMember, setSearchingMember] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState<FirestoreUser[]>([]);
    const [addingFamilyMember, setAddingFamilyMember] = useState<'spouse' | 'child' | 'other' | null>(null);

    // Load config on mount
    useEffect(() => {
        if (churchId) {
            loadConfig();
            loadMinistries();
        }
    }, [churchId]);

    const loadConfig = async () => {
        try {
            const loadedConfig = await MemberRegistrationService.getPublicConfig(churchId);

            if (loadedConfig) {
                setConfig(loadedConfig);
                // Initialize form data
                const initialData: Record<string, any> = {};
                loadedConfig.fields.filter(f => f.enabled).forEach(field => {
                    initialData[field.id] = field.type === 'checkbox' ? false : '';
                });
                setFormData(initialData);
            } else {
                // Use defaults
                const defaults = getDefaultRegistrationConfig(churchId);
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
            const defaults = getDefaultRegistrationConfig(churchId);
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

    const loadMinistries = async () => {
        try {
            const q = query(
                collection(db, 'ministries'),
                where('churchId', '==', churchId),
                where('active', '==', true)
            );
            const snapshot = await getDocs(q);
            setMinistries(snapshot.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                description: d.data().description
            })));
        } catch (error) {
            console.error('Error loading ministries:', error);
        }
    };

    const [searchError, setSearchError] = useState<string | null>(null);

    const searchExistingMembers = async (searchTerm: string) => {
        if (searchTerm.length < 2) {
            setMemberSearchResults([]);
            setSearchError(null);
            return;
        }

        setSearchingMember(true);
        setSearchError(null);
        try {
            const results = await MemberRegistrationService.searchExistingMembers(churchId, searchTerm);
            setMemberSearchResults(results);
            if (results.length === 0 && searchTerm.length >= 3) {
                setSearchError('No members found. You can add them as a new family member below.');
            }
        } catch (error) {
            console.error('Error searching members:', error);
            // On public forms, the search may fail due to security rules - this is expected
            setSearchError('Search unavailable. Please add as a new family member.');
            setMemberSearchResults([]);
        } finally {
            setSearchingMember(false);
        }
    };

    const handleSubmit = async () => {
        if (!config) return;

        setSubmitting(true);
        try {
            // Build submission data
            const submission: MemberRegistrationSubmission = {
                primaryMember: {
                    firstName: formData.firstName || '',
                    lastName: formData.lastName || '',
                    email: formData.email || undefined,
                    phone: formData.phone || undefined,
                    address: formData.street1 ? {
                        street1: formData.street1,
                        street2: formData.street2,
                        city: formData.city || '',
                        state: formData.state || '',
                        postalCode: formData.postalCode || '',
                        country: 'USA'
                    } : undefined,
                    dateOfBirth: formData.dateOfBirth || undefined,
                    ministryInterests: selectedMinistries,
                    customFields: Object.fromEntries(
                        Object.entries(formData).filter(([key]) =>
                            !['firstName', 'lastName', 'email', 'phone', 'street1', 'street2', 'city', 'state', 'postalCode', 'dateOfBirth'].includes(key)
                        )
                    )
                },
                familyMembers: familyMembers.length > 0 ? familyMembers : undefined,
                submittedAt: serverTimestamp(),
                source: 'web',
                churchId
            };

            await MemberRegistrationService.processSubmission(submission, config);
            setSuccess(true);
        } catch (error) {
            console.error('Error submitting registration:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    // Handle address autocomplete selection
    const handleAddressSelect = (address: ParsedAddress) => {
        setFormData(prev => ({
            ...prev,
            street1: address.street1,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode
        }));
    };

    const addFamilyMember = (relationship: FamilyMemberEntry['relationship']) => {
        setAddingFamilyMember(relationship as any);
        setMemberSearchQuery('');
        setMemberSearchResults([]);
    };

    const linkExistingMember = (member: FirestoreUser, relationship: FamilyMemberEntry['relationship']) => {
        const newEntry: FamilyMemberEntry = {
            id: `existing_${member.uid}`,
            existingMemberId: member.uid,
            isExisting: true,
            firstName: member.displayName?.split(' ')[0] || '',
            lastName: member.displayName?.split(' ').slice(1).join(' ') || '',
            email: member.email,
            phone: member.phoneNumber,
            relationship
        };
        setFamilyMembers(prev => [...prev, newEntry]);
        setAddingFamilyMember(null);
        setMemberSearchQuery('');
        setMemberSearchResults([]);
    };

    const addNewFamilyMember = (relationship: FamilyMemberEntry['relationship']) => {
        const newEntry: FamilyMemberEntry = {
            id: `new_${Date.now()}`,
            isExisting: false,
            firstName: '',
            lastName: '',
            relationship
        };
        setFamilyMembers(prev => [...prev, newEntry]);
        setAddingFamilyMember(null);
    };

    const updateFamilyMember = (id: string, updates: Partial<FamilyMemberEntry>) => {
        setFamilyMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const removeFamilyMember = (id: string) => {
        setFamilyMembers(prev => prev.filter(m => m.id !== id));
    };

    const getSteps = (): Step[] => {
        const steps: Step[] = ['info'];
        if (config?.familyIntake.enabled) steps.push('family');
        if (config?.ministrySettings.enabled && ministries.length > 0) steps.push('ministry');
        steps.push('review');
        return steps;
    };

    const goToNextStep = () => {
        const steps = getSteps();
        const currentIndex = steps.indexOf(currentStep);
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1]);
        }
    };

    const goToPrevStep = () => {
        const steps = getSteps();
        const currentIndex = steps.indexOf(currentStep);
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1]);
        }
    };

    const isValidForNextStep = (): boolean => {
        if (currentStep === 'info') {
            const requiredFields = config?.fields.filter(f => f.enabled && f.required) || [];
            return requiredFields.every(f => {
                const value = formData[f.id];
                return value !== undefined && value !== '' && value !== false;
            });
        }
        return true;
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-dvh bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    if (!config) return null;

    const { branding, fields, familyIntake, ministrySettings, successMessage, settings } = config;
    const enabledFields = fields.filter(f => f.enabled).sort((a, b) => a.order - b.order);
    const steps = getSteps();

    // Form disabled state
    if (!settings.enabled) {
        return (
            <div
                className="min-h-dvh flex items-center justify-center p-6 text-center"
                style={{ backgroundColor: branding.backgroundColor }}
            >
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
                    <h1 className="text-2xl font-bold text-white mb-2">{branding.formTitle}</h1>
                    <p className="text-zinc-400">Registration is currently closed. Please check back later.</p>
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
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{successMessage.title}</h1>
                    <p className="text-zinc-400 mb-4">{successMessage.subtitle}</p>
                    {successMessage.showNextSteps && successMessage.nextStepsContent && (
                        <div className="p-4 bg-zinc-800/50 rounded-xl text-sm text-zinc-300 text-left mb-6">
                            {successMessage.nextStepsContent}
                        </div>
                    )}

                    {/* Call to action - Sign up for the app */}
                    <div className="mt-6 pt-6 border-t border-zinc-800">
                        <p className="text-zinc-400 text-sm mb-4">
                            Stay connected with our community by creating an account
                        </p>
                        <a
                            href="/"
                            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl font-bold text-white transition-all bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md hover:shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Get the App
                        </a>
                        <p className="text-zinc-500 text-xs mt-3">
                            Access sermons, events, groups & more
                        </p>

                        {/* Add to Home Screen Instructions */}
                        <div className="mt-6 p-4 bg-zinc-800/30 rounded-xl text-left">
                            <p className="text-zinc-300 text-sm font-medium mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add to Your Home Screen
                            </p>
                            <div className="space-y-3 text-xs text-zinc-400">
                                <div className="flex gap-2">
                                    <span className="shrink-0 font-semibold text-zinc-300">iPhone/iPad:</span>
                                    <span>Tap the Share button <span className="inline-block px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">↑</span> then "Add to Home Screen"</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="shrink-0 font-semibold text-zinc-300">Android:</span>
                                    <span>Tap the menu <span className="inline-block px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">⋮</span> then "Add to Home Screen" or "Install App"</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div
            className="h-dvh overflow-y-auto overscroll-contain p-4 sm:p-6 pt-8 sm:pt-12 pb-24"
            style={{ backgroundColor: branding.backgroundColor }}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl mx-auto"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    {branding.logoUrl && (
                        <img
                            src={branding.logoUrl}
                            alt={branding.formTitle}
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
                        New Member Registration
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">{branding.formTitle}</h1>
                    <p className="text-zinc-400">{branding.tagline}</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {steps.map((step, index) => (
                        <div key={step} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    steps.indexOf(currentStep) >= index
                                        ? 'text-white'
                                        : 'bg-zinc-800 text-zinc-500'
                                }`}
                                style={{
                                    backgroundColor: steps.indexOf(currentStep) >= index ? branding.primaryColor : undefined
                                }}
                            >
                                {index + 1}
                            </div>
                            {index < steps.length - 1 && (
                                <div
                                    className={`w-12 h-1 mx-1 rounded transition-colors ${
                                        steps.indexOf(currentStep) > index ? '' : 'bg-zinc-800'
                                    }`}
                                    style={{
                                        backgroundColor: steps.indexOf(currentStep) > index ? branding.primaryColor : undefined
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                    <AnimatePresence mode="wait">
                        {/* Step 1: Basic Info */}
                        {currentStep === 'info' && (
                            <motion.div
                                key="info"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <User className="w-5 h-5" style={{ color: branding.primaryColor }} />
                                    <h2 className="text-lg font-semibold text-white">Your Information</h2>
                                </div>

                                {renderFields(enabledFields, formData, updateField, branding.primaryColor, handleAddressSelect)}
                            </motion.div>
                        )}

                        {/* Step 2: Family */}
                        {currentStep === 'family' && familyIntake.enabled && (
                            <motion.div
                                key="family"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <Users className="w-5 h-5" style={{ color: branding.primaryColor }} />
                                    <h2 className="text-lg font-semibold text-white">Family Members</h2>
                                </div>

                                <p className="text-zinc-400 text-sm">
                                    Do you have family members who attend or will be attending with you?
                                </p>

                                {/* Added family members */}
                                {familyMembers.length > 0 && (
                                    <div className="space-y-3">
                                        {familyMembers.map((member) => (
                                            <div
                                                key={member.id}
                                                className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="px-2 py-0.5 text-xs font-medium rounded"
                                                            style={{
                                                                backgroundColor: `${branding.primaryColor}20`,
                                                                color: branding.primaryColor
                                                            }}
                                                        >
                                                            {member.relationship.charAt(0).toUpperCase() + member.relationship.slice(1)}
                                                        </span>
                                                        {member.isExisting && (
                                                            <span className="text-xs text-zinc-500">Existing Member</span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => removeFamilyMember(member.id)}
                                                        className="p-1 text-red-400 hover:bg-red-900/30 rounded"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {member.isExisting ? (
                                                    <div className="text-white font-medium">
                                                        {member.firstName} {member.lastName}
                                                        {member.email && <span className="text-zinc-400 text-sm ml-2">({member.email})</span>}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <input
                                                            type="text"
                                                            placeholder="First Name"
                                                            value={member.firstName}
                                                            onChange={(e) => updateFamilyMember(member.id, { firstName: e.target.value })}
                                                            className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Last Name"
                                                            value={member.lastName}
                                                            onChange={(e) => updateFamilyMember(member.id, { lastName: e.target.value })}
                                                            className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                                                        />
                                                        <input
                                                            type="email"
                                                            placeholder="Email (optional)"
                                                            value={member.email || ''}
                                                            onChange={(e) => updateFamilyMember(member.id, { email: e.target.value })}
                                                            className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                                                        />
                                                        <input
                                                            type="tel"
                                                            placeholder="Phone (optional)"
                                                            value={member.phone || ''}
                                                            onChange={(e) => updateFamilyMember(member.id, { phone: e.target.value })}
                                                            className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add family member dialog */}
                                {addingFamilyMember && (
                                    <div className="p-4 bg-zinc-800/70 rounded-xl border border-zinc-700">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-medium text-white">
                                                Add {addingFamilyMember.charAt(0).toUpperCase() + addingFamilyMember.slice(1)}
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setAddingFamilyMember(null);
                                                    setSearchError(null);
                                                    setMemberSearchQuery('');
                                                    setMemberSearchResults([]);
                                                }}
                                                className="p-1 text-zinc-400 hover:bg-zinc-700 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Primary action - Add New */}
                                        <button
                                            onClick={() => addNewFamilyMember(addingFamilyMember)}
                                            className="w-full p-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl text-white text-sm font-bold transition-all shadow-md hover:shadow-lg mb-4"
                                        >
                                            <Plus className="w-4 h-4 inline mr-2" />
                                            Add New {addingFamilyMember.charAt(0).toUpperCase() + addingFamilyMember.slice(1)}
                                        </button>

                                        {/* Secondary - Search for existing */}
                                        <div className="border-t border-zinc-700 pt-4">
                                            <label className="text-xs text-zinc-500 mb-2 block">
                                                Already a member? Enter their exact email to link
                                            </label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                                <input
                                                    type="email"
                                                    placeholder="example@email.com"
                                                    value={memberSearchQuery}
                                                    onChange={(e) => {
                                                        setMemberSearchQuery(e.target.value);
                                                        searchExistingMembers(e.target.value);
                                                    }}
                                                    className="w-full pl-10 p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                                                />
                                            </div>
                                            {searchingMember && (
                                                <div className="flex items-center gap-2 mt-2 text-sm text-zinc-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Searching...
                                                </div>
                                            )}

                                            {/* Show helper text while typing partial email */}
                                            {!searchingMember && memberSearchQuery.length > 0 && !memberSearchQuery.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) && (
                                                <p className="text-xs text-zinc-500 mt-2">
                                                    Enter the complete email address to search (e.g., name@email.com)
                                                </p>
                                            )}

                                            {/* Only show "not found" when email is complete format */}
                                            {searchError && !searchError.includes('unavailable') && memberSearchQuery.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) && memberSearchResults.length === 0 && (
                                                <div className="flex items-start gap-2 mt-2 text-sm text-zinc-400 bg-zinc-800/50 p-2 rounded-lg">
                                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                    <span>No member found with that email. Use "Add New" above.</span>
                                                </div>
                                            )}

                                            {memberSearchResults.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {memberSearchResults.map((member) => (
                                                        <button
                                                            key={member.uid}
                                                            onClick={() => linkExistingMember(member, addingFamilyMember)}
                                                            className="w-full p-2 bg-zinc-700/50 rounded-lg text-left text-sm hover:bg-zinc-700 transition-colors"
                                                        >
                                                            <div className="text-white font-medium">{member.displayName}</div>
                                                            <div className="text-zinc-400 text-xs">{member.email}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Add buttons */}
                                {!addingFamilyMember && familyMembers.length < familyIntake.maxFamilyMembers && (
                                    <div className="flex flex-wrap gap-2">
                                        {familyIntake.askAboutSpouse && !familyMembers.find(m => m.relationship === 'spouse') && (
                                            <button
                                                onClick={() => addFamilyMember('spouse')}
                                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Spouse
                                            </button>
                                        )}
                                        {familyIntake.askAboutChildren && (
                                            <button
                                                onClick={() => addFamilyMember('child')}
                                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Child
                                            </button>
                                        )}
                                        {familyIntake.askAboutOtherFamily && (
                                            <button
                                                onClick={() => addFamilyMember('other')}
                                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Other Family
                                            </button>
                                        )}
                                    </div>
                                )}

                                {familyMembers.length === 0 && !addingFamilyMember && (
                                    <p className="text-zinc-500 text-sm italic">
                                        No family members added. You can skip this step if you're registering individually.
                                    </p>
                                )}
                            </motion.div>
                        )}

                        {/* Step 3: Ministry */}
                        {currentStep === 'ministry' && ministrySettings.enabled && (
                            <motion.div
                                key="ministry"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <Heart className="w-5 h-5" style={{ color: branding.primaryColor }} />
                                    <h2 className="text-lg font-semibold text-white">Ministry Interests</h2>
                                </div>

                                <p className="text-zinc-400 text-sm">
                                    {ministrySettings.allowMultiple
                                        ? 'Select any ministries you\'re interested in learning more about.'
                                        : 'Select a ministry you\'re interested in learning more about.'}
                                </p>

                                <div className="grid gap-3">
                                    {ministries.map((ministry) => {
                                        const isSelected = selectedMinistries.includes(ministry.id);
                                        return (
                                            <button
                                                key={ministry.id}
                                                onClick={() => {
                                                    if (ministrySettings.allowMultiple) {
                                                        setSelectedMinistries(prev =>
                                                            isSelected
                                                                ? prev.filter(id => id !== ministry.id)
                                                                : [...prev, ministry.id]
                                                        );
                                                    } else {
                                                        setSelectedMinistries(isSelected ? [] : [ministry.id]);
                                                    }
                                                }}
                                                className={`p-4 rounded-xl border text-left transition-all ${
                                                    isSelected
                                                        ? 'border-amber-500/50 bg-amber-500/10'
                                                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className={`w-5 h-5 rounded ${ministrySettings.allowMultiple ? 'rounded' : 'rounded-full'} border-2 flex items-center justify-center mt-0.5 ${
                                                            isSelected ? 'border-amber-500 bg-amber-500' : 'border-zinc-600'
                                                        }`}
                                                    >
                                                        {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white">{ministry.name}</div>
                                                        {ministry.description && (
                                                            <div className="text-sm text-zinc-400 mt-1">{ministry.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {ministries.length === 0 && (
                                    <p className="text-zinc-500 text-sm italic">
                                        No ministries available at this time.
                                    </p>
                                )}
                            </motion.div>
                        )}

                        {/* Step 4: Review */}
                        {currentStep === 'review' && (
                            <motion.div
                                key="review"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle className="w-5 h-5" style={{ color: branding.primaryColor }} />
                                    <h2 className="text-lg font-semibold text-white">Review & Submit</h2>
                                </div>

                                <p className="text-zinc-400 text-sm">
                                    Please review your information before submitting.
                                </p>

                                {/* Personal Info Summary */}
                                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                                    <h3 className="font-medium text-white mb-3">Your Information</h3>
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm overflow-hidden">
                                        <div className="text-zinc-400">Name:</div>
                                        <div className="text-white truncate">{formData.firstName} {formData.lastName}</div>
                                        {formData.email && (
                                            <>
                                                <div className="text-zinc-400">Email:</div>
                                                <div className="text-white truncate">{formData.email}</div>
                                            </>
                                        )}
                                        {formData.phone && (
                                            <>
                                                <div className="text-zinc-400">Phone:</div>
                                                <div className="text-white truncate">{formData.phone}</div>
                                            </>
                                        )}
                                        {formData.street1 && (
                                            <>
                                                <div className="text-zinc-400">Address:</div>
                                                <div className="text-white truncate">
                                                    {formData.street1}
                                                    {formData.city && `, ${formData.city}`}
                                                    {formData.state && `, ${formData.state}`}
                                                    {formData.postalCode && ` ${formData.postalCode}`}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Family Summary */}
                                {familyMembers.length > 0 && (
                                    <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                                        <h3 className="font-medium text-white mb-3">Family Members ({familyMembers.length})</h3>
                                        <ul className="space-y-2">
                                            {familyMembers.map((member) => (
                                                <li key={member.id} className="text-sm">
                                                    <span className="text-white">{member.firstName} {member.lastName}</span>
                                                    <span className="text-zinc-500 ml-2">({member.relationship})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Ministry Summary */}
                                {selectedMinistries.length > 0 && (
                                    <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                                        <h3 className="font-medium text-white mb-3">Ministry Interests</h3>
                                        <ul className="space-y-1">
                                            {selectedMinistries.map((ministryId) => {
                                                const ministry = ministries.find(m => m.id === ministryId);
                                                return ministry ? (
                                                    <li key={ministryId} className="text-sm text-white">
                                                        {ministry.name}
                                                    </li>
                                                ) : null;
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
                        <button
                            onClick={goToPrevStep}
                            disabled={currentStep === steps[0]}
                            className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>

                        {currentStep === 'review' ? (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white disabled:opacity-50 transition-all bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md hover:shadow-lg"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Complete Registration
                                        <CheckCircle className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={goToNextStep}
                                disabled={!isValidForNextStep()}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white disabled:opacity-50 transition-all bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md hover:shadow-lg"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="text-center mt-8 text-zinc-600 text-sm">
                    Protected by Bethel Secure
                </div>
            </motion.div>
        </div>
    );
}

// Helper function to render fields
function renderFields(
    fields: MemberRegistrationField[],
    formData: Record<string, any>,
    updateField: (id: string, value: any) => void,
    primaryColor: string,
    onAddressSelect?: (address: ParsedAddress) => void
) {
    // Group firstName and lastName into a row
    const firstNameField = fields.find(f => f.id === 'firstName');
    const lastNameField = fields.find(f => f.id === 'lastName');

    // Group address fields together
    const addressFields = ['street1', 'city', 'state', 'postalCode'];
    const street1Field = fields.find(f => f.id === 'street1');
    const cityField = fields.find(f => f.id === 'city');
    const stateField = fields.find(f => f.id === 'state');
    const postalCodeField = fields.find(f => f.id === 'postalCode');

    const otherFields = fields.filter(f =>
        f.id !== 'firstName' &&
        f.id !== 'lastName' &&
        !addressFields.includes(f.id)
    );

    return (
        <>
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

            {otherFields.map(field => (
                <FormField
                    key={field.id}
                    field={field}
                    value={formData[field.id]}
                    onChange={(v) => updateField(field.id, v)}
                    primaryColor={primaryColor}
                />
            ))}

            {/* Address section with autocomplete */}
            {street1Field && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">
                            {street1Field.label}
                            {!street1Field.required && <span className="text-zinc-600 ml-1">(Optional)</span>}
                        </label>
                        <AddressAutocompleteInput
                            onAddressSelect={(address) => {
                                if (onAddressSelect) {
                                    onAddressSelect(address);
                                }
                            }}
                            defaultValue={formData.street1 || ''}
                            placeholder={street1Field.placeholder || 'Start typing your address...'}
                        />
                    </div>

                    {/* City, State, Zip in a row */}
                    {(cityField || stateField || postalCodeField) && (
                        <div className="grid grid-cols-6 gap-3">
                            {cityField && (
                                <div className="col-span-3 space-y-2">
                                    <label className="text-sm font-medium text-zinc-400">
                                        {cityField.label}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city || ''}
                                        onChange={e => updateField('city', e.target.value)}
                                        placeholder={cityField.placeholder}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"
                                    />
                                </div>
                            )}
                            {stateField && (
                                <div className="col-span-1 space-y-2">
                                    <label className="text-sm font-medium text-zinc-400">
                                        {stateField.label}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.state || ''}
                                        onChange={e => updateField('state', e.target.value)}
                                        placeholder={stateField.placeholder}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"
                                    />
                                </div>
                            )}
                            {postalCodeField && (
                                <div className="col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-zinc-400">
                                        {postalCodeField.label}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.postalCode || ''}
                                        onChange={e => updateField('postalCode', e.target.value)}
                                        placeholder={postalCodeField.placeholder}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

function FormField({
    field,
    value,
    onChange,
    primaryColor
}: {
    field: MemberRegistrationField;
    value: any;
    onChange: (value: any) => void;
    primaryColor: string;
}) {
    const baseInputClass = "w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-white focus:outline-none transition-all placeholder:text-zinc-600";
    const focusStyle = { '--tw-ring-color': `${primaryColor}50` } as React.CSSProperties;

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
