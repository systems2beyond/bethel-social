'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateProfile } from 'firebase/auth';

export function OnboardingModal() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkProfile = async () => {
            if (!user) return;

            // Check Firestore for profile completeness
            const userRef = doc(db, 'users', user.uid);
            const snapshot = await getDoc(userRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                // If name or phone is missing, show modal
                // Note: We check if they have *ever* set it. 
                // If they explicitly saved an empty string, maybe we shouldn't bug them?
                // For now, let's assume we want to capture it if it's falsy.
                if (!data.displayName || !data.phoneNumber) {
                    setName(data.displayName || user.displayName || '');
                    setPhone(data.phoneNumber || '');
                    setIsOpen(true);
                }
            }
        };

        checkProfile();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            // 1. Update Firestore
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                displayName: name,
                phoneNumber: phone,
                updatedAt: new Date() // Use serverTimestamp in real app, but Date is fine for now
            });

            // 2. Update Auth Profile (for Display Name only)
            if (name !== user.displayName) {
                await updateProfile(user, { displayName: name });
            }

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-zinc-800">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Bethel!</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Please complete your profile so we can serve you better.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="John Doe"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="(555) 123-4567"
                            required
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Used for event reminders and connecting with staff.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {loading ? 'Saving...' : 'Complete Profile'}
                    </button>
                </form>
            </div>
        </div>
    );
}
