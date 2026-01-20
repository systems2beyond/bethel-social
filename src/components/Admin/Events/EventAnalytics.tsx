'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, DollarSign, Ticket, Gift, Users, HandHeart, Contact } from 'lucide-react';
import { Event, EventRegistration } from '@/types';

interface EventAnalyticsProps {
    event: Event;
    registrations: EventRegistration[];
}

export default function EventAnalytics({ event, registrations }: EventAnalyticsProps) {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        ticketSalesVolume: 0,
        ticketCount: 0,
        tips: 0,
        donationVolume: 0,
        campaignDonations: 0,
        uniquePayers: 0,
        attendeesCount: 0,
        withContactInfo: 0,
    });
    const [campaignName, setCampaignName] = useState<string | null>(null);

    const isTicketed = (event.registrationConfig?.ticketPrice || 0) > 0;
    const ticketPrice = (event.registrationConfig?.ticketPrice || 0);

    useEffect(() => {
        const calculateMetrics = async () => {
            let totalRev = 0;
            let ticketsVol = 0;
            let tipsVol = 0;
            let donationsVol = 0;
            let tCount = 0;
            let payers = new Set<string>();
            let attendees = 0;
            let contacts = 0;

            // 1. Fetch Request Campaign Name if linked
            let linkedCampaignName = null;
            if (event.linkedCampaignId) {
                try {
                    const snap = await getDoc(doc(db, 'campaigns', event.linkedCampaignId));
                    if (snap.exists()) {
                        linkedCampaignName = snap.data().name;
                        setCampaignName(linkedCampaignName);
                    }
                } catch (e) {
                    console.error("Failed to load campaign name", e);
                }
            }

            // 2. Process Registrations
            registrations.forEach(reg => {
                // Count basic stats
                attendees += (reg.ticketCount || 1);
                if (reg.userEmail || reg.userName) contacts++;

                // Financials
                if (reg.status === 'paid' || reg.paymentStatus === 'paid') {
                    if (reg.userEmail) payers.add(reg.userEmail);

                    const totalCents = reg.totalAmount || 0;
                    const tipCents = reg.tipAmount || 0;

                    const total = totalCents / 100;
                    const tip = tipCents / 100;

                    tipsVol += tip;

                    const count = reg.ticketCount || 1;
                    tCount += count;

                    if (isTicketed) {
                        const ticketRev = count * ticketPrice;
                        ticketsVol += ticketRev;
                        // Assuming remainder is donation
                        const possibleDonation = total - tip - ticketRev;
                        if (possibleDonation > 0) donationsVol += possibleDonation;
                    } else {
                        // Free event, all non-tip payment is donation
                        donationsVol += (total - tip);
                    }
                }
            });

            // 3. Fetch Direct Donations to Linked Campaign (if any)
            let directDonationVol = 0;
            if (linkedCampaignName) {
                try {
                    const donationsRef = collection(db, 'donations');
                    const q = query(donationsRef, where('campaign', '==', linkedCampaignName));
                    const snapshot = await getDocs(q);

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const status = (data.status || 'pending').toLowerCase();
                        if (status === 'succeeded' || status === 'paid') {
                            const amountCents = data.amount || 0;
                            // Add check to avoid double counting if we ever link recipts? 
                            // For now assume distinct.
                            directDonationVol += (amountCents / 100);
                        }
                    });
                } catch (error) {
                    console.error("Error fetching campaign donations:", error);
                }
            }

            // Combine Donation Volumes
            // Note: We display Total Event Donations. If we include Campaign specific ones, it might seem unmatched to registrations.
            // But usually desired behavior is "Total raised".
            donationsVol += directDonationVol;

            totalRev = ticketsVol + donationsVol;

            setMetrics({
                totalRevenue: totalRev,
                ticketSalesVolume: ticketsVol,
                ticketCount: tCount,
                tips: tipsVol,
                donationVolume: donationsVol,
                campaignDonations: directDonationVol,
                uniquePayers: payers.size,
                attendeesCount: attendees,
                withContactInfo: contacts
            });
            setLoading(false);
        };

        if (event) {
            calculateMetrics();
        }
    }, [event, registrations, isTicketed, ticketPrice]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Primary Metric */}
                {isTicketed ? (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <DollarSign className="w-4 h-4" /> Total Revenue
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            ${metrics.totalRevenue.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Excludes tips</div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <Users className="w-4 h-4" /> Total Attendees
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.attendeesCount}
                        </div>
                    </div>
                )}

                {/* 2. Secondary Metric */}
                {isTicketed ? (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <Ticket className="w-4 h-4" /> Ticket Sales
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            ${metrics.ticketSalesVolume.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{metrics.ticketCount} tickets sold</div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <Contact className="w-4 h-4" /> Contacts Collected
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.withContactInfo}
                        </div>
                    </div>
                )}

                {/* 3. Unique Payers */}
                {isTicketed && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <Users className="w-4 h-4" /> Unique Payers
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {metrics.uniquePayers}
                        </div>
                    </div>
                )}

                {/* 4. Donations */}
                {(metrics.donationVolume > 0 || event.linkedCampaignId) && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <HandHeart className="w-4 h-4" />
                            {campaignName ? `Donations to "${campaignName}"` : 'Event Donations'}
                        </div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            ${metrics.donationVolume.toFixed(2)}
                        </div>
                    </div>
                )}
            </div>

            {/* Note about Tips */}
            {metrics.tips > 0 && (
                <div className="text-xs text-gray-400 text-right">
                    * ${metrics.tips.toFixed(2)} collected in platform tips
                </div>
            )}
        </div>
    );
}
