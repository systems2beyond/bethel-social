'use client';

import React, { useMemo } from 'react';
// using standard divs instead of ui/card component library

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, Users, TrendingUp, CreditCard } from 'lucide-react';
import { startOfWeek, format, subDays, isAfter } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface Donation {
    id: string;
    donorId: string;
    amount: number;
    campaign: string;
    createdAt: Timestamp | null;
    status: string;
    donorEmail?: string;
}

interface GivingAnalyticsProps {
    donations: Donation[];
}

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#6366F1'];

const StatCard = ({ title, value, icon: Icon, subtext }: { title: string, value: string, icon: any, subtext?: string }) => (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className="p-3 bg-indigo-50 rounded-lg">
            <Icon className="w-5 h-5 text-indigo-600" />
        </div>
    </div>
);

export default function GivingAnalytics({ donations }: GivingAnalyticsProps) {

    // Process Data
    const analytics = useMemo(() => {
        const now = new Date();
        const thirtyDaysAgo = subDays(now, 30);

        let totalRaised = 0;
        let totalCount = 0;
        const campaigns: { [key: string]: number } = {};
        const uniqueDonors = new Set();

        // For Trend Chart (Last 4 Weeks)
        const weeklyTrends: { [key: string]: number } = {};
        // Initialize last 4 weeks
        for (let i = 0; i < 4; i++) {
            const weekStart = startOfWeek(subDays(now, i * 7));
            const label = format(weekStart, 'MMM d');
            weeklyTrends[label] = 0;
        }

        donations.forEach(d => {
            console.log('Processing donation:', d.amount, d.status);
            const date = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();

            // Only count "paid" or "succeeded"
            if (d.status !== 'paid' && d.status !== 'succeeded') return;

            // Total Stats
            totalRaised += (d.amount / 100);
            totalCount++;
            if (d.donorId && d.donorId !== 'anonymous') uniqueDonors.add(d.donorId);
            else if (d.donorEmail) uniqueDonors.add(d.donorEmail);

            // Campaign Data
            const campaignName = d.campaign || 'General';
            campaigns[campaignName] = (campaigns[campaignName] || 0) + (d.amount / 100);

            // Trend Data (aggregating by week start)
            if (isAfter(date, subDays(now, 35))) { // Roughly last month
                const weekLabel = format(startOfWeek(date), 'MMM d');
                if (weeklyTrends[weekLabel] !== undefined) {
                    weeklyTrends[weekLabel] += (d.amount / 100);
                }
            }
        });

        // Format for Recharts
        const pieData = Object.keys(campaigns).map(name => ({
            name,
            value: campaigns[name]
        })).sort((a, b) => b.value - a.value);

        const barData = Object.keys(weeklyTrends).map(date => ({
            name: date,
            amount: weeklyTrends[date]
        })).reverse(); // Oldest to newest

        return {
            totalRaised,
            totalCount,
            uniqueDonorCount: uniqueDonors.size,
            pieData,
            barData
        };
    }, [donations]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    return (
        <div className="space-y-6 mb-8">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="Total Revenue"
                    value={formatCurrency(analytics.totalRaised)}
                    icon={DollarSign}
                    subtext="Net to church (excludes tips)"
                />
                <StatCard
                    title="Donations"
                    value={analytics.totalCount.toString()}
                    icon={CreditCard}
                    subtext="Successful transactions"
                />
                <StatCard
                    title="Unique Donors"
                    value={analytics.uniqueDonorCount.toString()}
                    icon={Users}
                    subtext="Individual contributors"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Trends Chart */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Donation Trends</h3>
                        <p className="text-sm text-gray-500">Weekly giving over the last month</p>
                    </div>
                    <div className="h-64 w-full" style={{ minHeight: '250px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.barData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    tickFormatter={(val) => `$${val}`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val: number | string | Array<any> | undefined) => [formatCurrency(Number(val) || 0), 'Amount']}
                                />
                                <Bar dataKey="amount" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Breakdown Chart */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Fund Breakdown</h3>
                        <p className="text-sm text-gray-500">Distribution by envelope/campaign</p>
                    </div>
                    <div className="h-64 w-full relative" style={{ minHeight: "250px", minWidth: 0 }}>
                        {analytics.pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {analytics.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val: number | string | Array<any> | undefined) => formatCurrency(Number(val) || 0)}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-gray-400 text-sm">No data available</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
