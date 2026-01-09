'use client';

import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Loader2, QrCode, Heart } from 'lucide-react';
import Image from 'next/image';

interface Donation {
    id: string;
    donorId: string;
    amount: number;
    donorName?: string;
    createdAt: Timestamp | null;
}

// Helper for the rolling number effect
const AnimatedNumber = ({ value }: { value: number }) => {
    return (
        <motion.span
            key={value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block"
        >
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}
        </motion.span>
    );
};

export default function GalaGivingPage() {
    const [totalRaised, setTotalRaised] = useState(0);
    const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const initialLoadDone = useRef(false);

    // Goal could be dynamic, hardcoding for demo
    const GOAL = 10000;

    useEffect(() => {
        const donationsRef = collection(db, 'donations');
        // Get all donations for the total
        // In a real app with thousands of docs, you'd want a separate "aggregates" document.
        // For now, client-side summing is fine for smaller datasets.

        const qTotal = query(
            donationsRef,
            where('churchId', '==', 'default_church')
        );

        const unsubscribeTotal = onSnapshot(qTotal, (snapshot) => {
            let sum = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                sum += (data.amount || 0); // Use 'amount' (net to church) not totalAmount
            });
            setTotalRaised(sum);
        });

        // Separate listener for "New" donations to show in ticker and trigger confetti
        const qRecent = query(
            donationsRef,
            where('churchId', '==', 'default_church'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
            const newDonations: Donation[] = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    // Only trigger confetti if this is a NEW add after initial load
                    if (initialLoadDone.current) {
                        triggerConfetti();
                    }
                }
            });

            snapshot.forEach((doc) => {
                const data = doc.data();
                newDonations.push({
                    id: doc.id,
                    ...data,
                    amount: data.amount || 0,
                    donorName: data.donorName || 'Anonymous',
                    createdAt: data.createdAt
                } as Donation);
            });

            setRecentDonations(newDonations);
            setLoading(false);

            // Mark initial load as done after first snapshot processed
            // Small timeout to allow the "initial" batch to settle without triggering confetti
            if (!initialLoadDone.current) {
                setTimeout(() => {
                    initialLoadDone.current = true;
                }, 1000);
            }
        });

        return () => {
            unsubscribeTotal();
            unsubscribeRecent();
        };
    }, []);

    const triggerConfetti = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
            </div>
        );
    }

    const progressPercentage = Math.min((totalRaised / GOAL) * 100, 100);

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden relative font-sans">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-black to-black z-0 pointer-events-none" />

            <div className="relative z-10 container mx-auto px-4 py-8 h-screen flex flex-col">

                {/* Header */}
                <header className="flex justify-between items-center mb-12">
                    <div className="flex items-center space-x-3">
                        {/* Placeholder Logo */}
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                            <Heart className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Bethel Gala</span>
                    </div>
                    <div className="text-sm text-gray-400">Live Giving Dashboard</div>
                </header>

                <main className="flex-grow flex flex-col md:flex-row gap-12 items-center justify-center">

                    {/* Left Column: The Big Number */}
                    <div className="flex-1 text-center md:text-left">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <h2 className="text-purple-400 text-lg uppercase tracking-widest font-semibold mb-2">Total Raised</h2>
                            <div className="text-7xl md:text-9xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
                                <AnimatedNumber value={totalRaised} />
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full max-w-2xl bg-gray-800 h-6 rounded-full overflow-hidden mb-4 border border-gray-700">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                />
                            </div>
                            <p className="text-gray-400 text-lg">Goal: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(GOAL)}</p>
                        </motion.div>
                    </div>

                    {/* Right Column: QR Code & Call to Action */}
                    <div className="w-full md:w-auto flex flex-col items-center">
                        <div className="bg-white p-4 rounded-3xl shadow-2xl mb-6 transform hover:scale-105 transition-transform duration-300">
                            {/* In a real app, use a dynamic QR code generator pointing to current URL/giving */}
                            {/* Using a placeholder service for now */}
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent('https://bethel-metro-social.netlify.app/giving')}`}
                                alt="Scan to Give"
                                className="w-64 h-64 md:w-80 md:h-80 object-contain rounded-lg"
                            />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Scan to Give</h3>
                        <p className="text-gray-400">Join {recentDonations.length} others in supporting the mission.</p>
                    </div>
                </main>

                {/* Footer: Recent Ticker */}
                <div className="mt-12 mb-8 h-24 relative mask-linear-gradient">
                    <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Recent Donors</h3>
                    <div className="flex space-x-4 overflow-hidden mask-fade-right">
                        <AnimatePresence>
                            {recentDonations.slice(0, 5).map((donation, index) => (
                                <motion.div
                                    key={donation.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex-shrink-0 bg-gray-900/50 border border-gray-800 px-6 py-3 rounded-xl flex items-center space-x-3 backdrop-blur-sm"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                                        {donation.donorName ? donation.donorName.charAt(0) : 'A'}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">{donation.donorName || 'Anonymous'}</div>
                                        <div className="text-xs text-purple-400">Just gave {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(donation.amount)}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
