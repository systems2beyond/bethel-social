'use client';

import React, { useEffect, useState } from 'react';
import { EventsService } from '@/lib/services/EventsService';
import { Loader2, DollarSign, Ticket, Gift, Users } from 'lucide-react';
import { EventRegistration } from '@/types';

interface EventRevenueStatsProps {
    eventId: string;
}

export default function EventRevenueStats({ eventId }: EventRevenueStatsProps) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        ticketSales: 0,
        tips: 0,
        uniqueDonors: 0,
        paidRegistrations: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const registrations = await EventsService.getEventRegistrations(eventId);

                let totalRevenue = 0;
                let ticketSales = 0; // Derived or explicitly stored
                let tips = 0;
                let paidCount = 0;
                const donors = new Set<string>();

                registrations.forEach(reg => {
                    // Check for paid status
                    if (reg.status === 'paid' || reg.paymentStatus === 'paid') {
                        paidCount++;

                        // Amounts are in cents usually from Stripe, but let's check how we stored them. 
                        // In webhook we stored: totalAmount: donationAmount || 0, tipAmount: tipAmount || 0
                        // Assuming donationAmount from Stripe intent is in CENTS.
                        // We need to divide by 100 for display.

                        const total = (reg.totalAmount || 0) / 100;
                        const tip = (reg.tipAmount || 0) / 100;

                        totalRevenue += total;
                        tips += tip;
                        ticketSales += (total - tip);

                        if (reg.userEmail) donors.add(reg.userEmail);
                    }
                });

                setStats({
                    totalRevenue,
                    ticketSales,
                    tips,
                    uniqueDonors: donors.size,
                    paidRegistrations: paidCount
                });
            } catch (error) {
                console.error("Error fetching event stats:", error);
            } finally {
                setLoading(false);
            }
        };

        if (eventId) {
            fetchStats();
        }
    }, [eventId]);

    if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <DollarSign className="w-4 h-4" /> Total Revenue
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${stats.totalRevenue.toFixed(2)}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <Ticket className="w-4 h-4" /> Ticket Sales
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${stats.ticketSales.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                    {stats.paidRegistrations} paid
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <Gift className="w-4 h-4" /> Tips
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${stats.tips.toFixed(2)}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <Users className="w-4 h-4" /> Unique Payers
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.uniqueDonors}
                </div>
            </div>
        </div>
    );
}
