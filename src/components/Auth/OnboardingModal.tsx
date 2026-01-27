'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateProfile } from 'firebase/auth';
import { ChurchPicker } from './ChurchPicker';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, MapPin, Sparkles } from 'lucide-react';

export function OnboardingModal() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedChurchId, setSelectedChurchId] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Info, 2: Church

    useEffect(() => {
        const checkProfile = async () => {
            if (!user) {
                setIsOpen(false);
                return;
            }

            try {
                // Check Firestore for profile completeness
                const userRef = doc(db, 'users', user.uid);
                const snapshot = await getDoc(userRef);

                if (snapshot.exists()) {
                    const data = snapshot.data();
                    // Check if they are missing critical fields
                    const isMissingInfo = !data.displayName || !data.phoneNumber;
                    const isMissingChurch = !data.churchId;

                    if (isMissingInfo || isMissingChurch) {
                        setName(data.displayName || user.displayName || '');
                        setPhone(data.phoneNumber || '');
                        setSelectedChurchId(data.churchId || undefined);

                        if (!isMissingInfo && isMissingChurch) {
                            setStep(2);
                        } else {
                            setStep(1);
                        }
                        setIsOpen(true);
                    } else {
                        setIsOpen(false);
                    }
                } else {
                    // Document doesn't exist yet - definitely show onboarding
                    setName(user.displayName || '');
                    setStep(1);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('Error checking profile during onboarding:', error);
                setIsOpen(true);
            }
        };

        checkProfile();
    }, [user]);

    const handleContinue = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!user || !selectedChurchId) return;
        setLoading(true);

        try {
            // 1. Update Firestore
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                displayName: name,
                phoneNumber: phone,
                churchId: selectedChurchId,
                updatedAt: serverTimestamp()
            });

            // 2. Update Auth Profile (for Display Name only)
            if (name !== user.displayName) {
                await updateProfile(user, { displayName: name });
            }

            // Force a reload or wait for AuthContext to sync (handled by context listener)
            setIsOpen(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[101] flex items-start justify-center bg-black/60 backdrop-blur-md p-4 pt-[10vh] overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 dark:border-zinc-800"
                    >
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-zinc-800 flex">
                            <motion.div
                                className="h-full bg-blue-600"
                                animate={{ width: step === 1 ? '50%' : '100%' }}
                            />
                        </div>

                        <div className="p-8">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl mb-4 text-blue-600 dark:text-blue-400">
                                    <Sparkles className="w-7 h-7" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {step === 1 ? 'Complete Your Profile' : 'Find Your Church'}
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">
                                    {step === 1
                                        ? "Let's get to know you a bit better."
                                        : "Select your home church to see the community feed."}
                                </p>
                            </div>

                            {step === 1 ? (
                                <form onSubmit={handleContinue} className="space-y-5">
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                                                How should we call you?
                                            </label>
                                            <div className="group relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                    placeholder="First & Last Name"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                                                Your Phone (For Updates)
                                            </label>
                                            <div className="group relative">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                                <input
                                                    type="tel"
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                    placeholder="(000) 000-0000"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-[0.98] mt-4"
                                    >
                                        Next Component
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-6">
                                    <ChurchPicker
                                        onSelect={setSelectedChurchId}
                                        selectedId={selectedChurchId}
                                    />

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="flex-1 py-4 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 font-bold rounded-2xl transition-all"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={loading || !selectedChurchId}
                                            className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? 'Joining Community...' : 'Start Fellowship'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
