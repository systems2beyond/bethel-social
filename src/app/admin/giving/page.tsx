'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot, collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { AlertCircle, CheckCircle, ExternalLink, Loader2, DollarSign, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminDonationsTable from './AdminDonationsTable';
import GivingAnalytics from './GivingAnalytics';

import { Suspense } from 'react';

// Shared Interface
interface Donation {
    id: string;
    donorId: string;
    amount: number;
    tipAmount: number;
    totalAmount: number;
    campaign: string;
    status: string;
    createdAt: Timestamp | null;
    donorName?: string;
    donorEmail?: string;
}

interface Payout {
    id: string;
    amount: number;
    arrival_date: number;
    status: string;
}

const PayoutsList = () => {
    const { userData } = useAuth();
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userData?.churchId) return;
        const fetchPayouts = async () => {
            try {
                const getRecentPayouts = httpsCallable(functions, 'getRecentPayouts');
                const result = await getRecentPayouts({ churchId: userData.churchId });
                const data = result.data as any;
                setPayouts(data.payouts || []);
            } catch (err) {
                console.error('Failed to fetch payouts', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPayouts();
    }, [userData?.churchId]);

    if (loading) return <div className="text-sm text-gray-400 py-2">Loading payouts...</div>;

    if (payouts.length === 0) {
        return <div className="text-sm text-gray-500 py-2">No recent payouts found. Funds are automatically transferred on a rolling basis.</div>;
    }

    return (
        <div className="overflow-hidden bg-gray-50 rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arrival Date</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payouts.map((payout) => (
                        <tr key={payout.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                ${(payout.amount / 100).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payout.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                    {payout.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(payout.arrival_date * 1000).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

function AdminGivingContent() {
    const { userData } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Status can be: 'loading', 'none', 'pending', 'active'
    const [stripeStatus, setStripeStatus] = useState<string>('loading');
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);

    // Donation Data State
    const [donations, setDonations] = useState<Donation[]>([]);
    const [donationsLoading, setDonationsLoading] = useState(true);

    // Check for "status" query param from Stripe redirect
    useEffect(() => {
        const status = searchParams.get('status');
        if (status === 'complete') {
            // Remove the query param to clean the URL
            router.replace('/admin/giving');
        }
    }, [searchParams, router]);

    const [stripeDetailsSubmitted, setStripeDetailsSubmitted] = useState<boolean>(false);

    useEffect(() => {
        if (!userData?.churchId) return;
        const unsub = onSnapshot(doc(db, 'churches', userData.churchId), (docSnapshot) => {
            const data = docSnapshot.data();
            if (data?.stripeAccountStatus) {
                setStripeStatus(data.stripeAccountStatus);
            } else {
                setStripeStatus('none');
            }
            if (data?.stripeDetailsSubmitted) {
                setStripeDetailsSubmitted(data.stripeDetailsSubmitted);
            }
        });
        return () => unsub();
    }, [userData?.churchId]);

    // Fetch Donations
    useEffect(() => {
        if (!userData?.churchId) return;
        const donationsRef = collection(db, 'donations');
        // We fetch ALL recent donations and filter client-side to support legacy data 
        // ONLY for the default church. New churches will only see their own.
        const q = query(
            donationsRef,
            where('churchId', '==', userData.churchId),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const donationsData: Donation[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                donationsData.push({
                    id: doc.id,
                    ...data,
                    amount: data.amount || 0,
                    tipAmount: data.tipAmount || 0,
                    totalAmount: data.totalAmount || 0,
                    campaign: data.campaign || 'General Fund',
                    status: data.status || 'pending',
                } as Donation);
            });
            setDonations(donationsData);
            setDonationsLoading(false);
        }, (err) => {
            console.error("Error fetching donations:", err);
            setDonationsLoading(false);
        });

        return () => unsubscribe();
    }, [userData?.churchId]);


    const handleOnboard = async () => {
        if (!userData?.churchId) return;
        setIsLoadingUrl(true);
        try {
            const createExpressAccount = httpsCallable(functions, 'createExpressAccount');
            const result = await createExpressAccount({
                churchId: userData.churchId,
                redirectUrl: window.location.origin
            });
            const { url } = result.data as any;
            window.location.href = url;
        } catch (error) {
            console.error(error);
            alert('Failed to start onboarding. Check console for details.');
            setIsLoadingUrl(false);
        }
    };

    const handleLoginLink = async () => {
        if (!userData?.churchId) return;
        setIsLoadingUrl(true);
        try {
            // Open window immediately to avoid popup blockers
            const newWindow = window.open('', '_blank');
            if (newWindow) newWindow.document.body.innerHTML = 'Loading Stripe Dashboard...';

            const getLoginLink = httpsCallable(functions, 'getStripeLoginLink');
            const result = await getLoginLink({ churchId: userData.churchId });
            const { url } = result.data as any;

            if (newWindow) {
                newWindow.location.href = url;
            } else {
                // Fallback if blocked entirely
                window.location.href = url;
            }
            setIsLoadingUrl(false);
        } catch (error) {
            console.error(error);
            alert('Failed to get dashboard link.');
            setIsLoadingUrl(false);
        }
    };

    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">You must be an administrator to view this dashboard.</p>
                <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Return Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 mb-2 inline-block">← Back to Admin</Link>
                    <h1 className="text-3xl font-bold text-gray-900">Giving & Tithing</h1>
                    <p className="text-gray-500 mt-2">Manage donations, payouts, and your non-profit status.</p>
                </header>

                {/* Account Status Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stripeStatus === 'active' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Payment Processor</h2>
                                <p className="text-sm text-gray-500">
                                    {stripeStatus === 'active'
                                        ? 'Stripe is active. Recent payouts to your bank account:'
                                        : 'Connect Stripe to start accepting donations.'}
                                </p>
                            </div>
                        </div>

                        {/* Status Badge or Actions */}
                        <div className="flex items-center space-x-3">
                            {stripeStatus === 'active' && (
                                <>
                                    <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full flex items-center">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Active
                                    </span>
                                    {/* Demoted "Manage" Button */}
                                    <button
                                        onClick={handleLoginLink}
                                        disabled={isLoadingUrl}
                                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                                        title="Manage Stripe Account"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                            {(stripeStatus === 'pending_onboarding' || stripeStatus === 'pending_verification') && (
                                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full flex items-center">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Pending
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Payouts List or Onboarding Button */}
                    {stripeStatus === 'active' ? (
                        <PayoutsList />
                    ) : (
                        <div className="mt-4">
                            {(stripeStatus === 'pending_onboarding' || stripeStatus === 'pending_verification') && stripeDetailsSubmitted ? (
                                <button
                                    onClick={handleLoginLink}
                                    disabled={isLoadingUrl}
                                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    {isLoadingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                    <span>Check Status in Dashboard</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleOnboard}
                                    disabled={isLoadingUrl}
                                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                                >
                                    {isLoadingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                    <span>{stripeStatus === 'pending_onboarding' ? 'Resume Onboarding' : 'Set up Payments'}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Analytics Dashboard */}
                <GivingAnalytics donations={donations} />

                {/* Donations Table */}
                <AdminDonationsTable donations={donations} loading={donationsLoading} />
            </div>
        </div>
    );
}

export default function AdminGivingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <AdminGivingContent />
        </Suspense>
    );
}
