'use client';

import React from 'react';
import { Loader2, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface Donation {
    id: string;
    donorId: string;
    amount: number;
    campaign: string;
    status: string;
    createdAt: Timestamp | null;
    donorName?: string;
    donorEmail?: string;
}

interface AdminDonationsTableProps {
    donations: Donation[];
    loading?: boolean;
}

export default function AdminDonationsTable({ donations, loading = false }: AdminDonationsTableProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles = {
            paid: 'bg-green-100 text-green-800',
            succeeded: 'bg-green-100 text-green-800',
            pending: 'bg-yellow-100 text-yellow-800',
            failed: 'bg-red-100 text-red-800',
            refunded: 'bg-gray-100 text-gray-800',
        };
        const normalizedStatus = (status.toLowerCase() in styles) ? status.toLowerCase() : 'pending';
        const activeStyle = styles[normalizedStatus as keyof typeof styles];

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${activeStyle}`}>
                {status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl border border-gray-100">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
                    <p className="text-sm text-gray-500">Real-time overview of incoming donations.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg border border-gray-200 text-sm hover:bg-gray-100 transition-colors">
                        <Filter className="w-4 h-4" />
                        <span>Filter</span>
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg border border-gray-200 text-sm hover:bg-gray-100 transition-colors">
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Donor</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaign</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Net Amount</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {donations.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No donations found yet.
                                </td>
                            </tr>
                        ) : (
                            donations.map((donation) => (
                                <tr key={donation.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                        {donation.createdAt?.toDate ? format(donation.createdAt.toDate(), 'MMM d, yyyy h:mm a') : 'Pending...'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">
                                        {donation.donorName || 'Anonymous'}
                                        {donation.donorEmail && <div className="text-xs text-gray-400 font-normal">{donation.donorEmail}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                        {donation.campaign}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold text-right whitespace-nowrap">
                                        {formatCurrency(donation.amount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <StatusBadge status={donation.status} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
                <span>Showing last 50 transactions</span>
                {/* Pagination logic would go here */}
            </div>
        </div>
    );
}
