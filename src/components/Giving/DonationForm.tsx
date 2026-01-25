
'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Loader2, Heart, ShieldCheck, Lock, Gift, ChevronLeft, CreditCard, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useChurchConfig } from '@/hooks/useChurchConfig';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const DEFAULT_CAMPAIGNS = [
    { id: 'general', name: 'General Fund', description: 'Where it is needed most' },
    { id: 'tithe', name: 'Tithe', description: '10% of income' },
];

const PRESET_AMOUNTS = [50, 100, 250, 500];
const TIP_PERCENTAGES = [0, 0.03, 0.05, 0.08];

interface DonationWidgetProps {
    initialCampaignId?: string;
    initialChurchId?: string;
    compact?: boolean;
    onClose?: () => void;
}

import { Campaign } from '@/types';
import { X as CloseIcon } from 'lucide-react';

// ... (existing imports)

export default function DonationWidget({ initialCampaignId, initialChurchId, compact = false, onClose }: DonationWidgetProps) {
    const { userData } = useAuth();
    const effectiveChurchId = initialChurchId || userData?.churchId || 'bethel-metro';
    const [campaigns, setCampaigns] = useState<Campaign[]>(DEFAULT_CAMPAIGNS);
    // Fetch campaigns from collection
    React.useEffect(() => {
        const q = query(collection(db, 'campaigns'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Campaign[];
            if (data.length > 0) {
                setCampaigns(data);
                // If initialCampaignId is provided, try to find it
                if (initialCampaignId) {
                    const found = data.find((c) => c.id === initialCampaignId);
                    if (found) {
                        setCampaign(found.name);
                        return;
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [initialCampaignId]); // Added dependency

    const [step, setStep] = useState<number>(1); // 1: Details, 2: Payment
    const [amount, setAmount] = useState<number>(100);
    const [campaign, setCampaign] = useState<string>('General Fund');
    const [donorName, setDonorName] = useState<string>('');
    const [donorEmail, setDonorEmail] = useState<string>('');

    // Effect to set default campaign once loaded
    React.useEffect(() => {
        // Only default to General Fund logic if we haven't already set a campaign via initialCampaignId
        if (campaigns.length > 0 && campaign === 'General Fund' && !campaigns.find(c => c.name === 'General Fund')) {
            // If initialCampaignId matches one, use it.
            if (initialCampaignId) {
                const found = campaigns.find(c => c.id === initialCampaignId);
                if (found) {
                    setCampaign(found.name);
                    return;
                }
            }
            setCampaign(campaigns[0].name);
        }
    }, [campaigns, campaign, initialCampaignId]);


    // Tipping
    const [tipPercent, setTipPercent] = useState<number>(0.10);
    const [customTip, setCustomTip] = useState<number>(0);
    const [isCustomTip, setIsCustomTip] = useState<boolean>(false);
    const [showTipSection, setShowTipSection] = useState(false);

    // Dynamic Tip Defaulting
    React.useEffect(() => {
        // Sliding scale: 5% for smaller amounts (to cover separate transaction fees/costs), 3% for larger
        if (amount < 250) setTipPercent(0.05);
        else setTipPercent(0.03);
    }, [amount]);

    // Payment State
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Calculations
    const baseAmount = amount || 0;
    const calculatedTip = Math.round(baseAmount * tipPercent);
    const tipAmount = isCustomTip ? customTip : (tipPercent > 0 ? Math.max(calculatedTip, 1) : 0);
    const total = baseAmount + tipAmount;

    const handleContinue = async () => {
        if (baseAmount < 1) {
            toast.error('Minimum donation is $1.00');
            return;
        }
        setIsLoading(true);
        try {
            const createIntent = httpsCallable(functions, 'createDonationIntent');
            const result = await createIntent({
                amount: baseAmount * 100,
                tipAmount: tipAmount * 100,
                churchId: effectiveChurchId,
                frequency: 'one_time',
                campaign: campaign,
                donorName: donorName,
                donorEmail: donorEmail
            });
            const data = result.data as { clientSecret: string };
            setClientSecret(data.clientSecret);
            setStep(2);
        } catch (error) {
            console.error('Donation Error:', error);
            toast.error('Could not initialize donation. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 2 && clientSecret) {
        return (
            <div className="w-full max-w-md mx-auto">
                <Elements stripe={stripePromise} options={{
                    clientSecret,
                    appearance: {
                        theme: 'stripe',
                        variables: {
                            colorPrimary: '#2563eb',
                            colorBackground: '#ffffff',
                            colorText: '#1f2937',
                        }
                    }
                }}>
                    <CheckoutForm
                        total={total}
                        onBack={() => setStep(1)}
                        campaign={campaign}
                    />
                </Elements>
            </div>
        );
    }

    // Dynamic padding/spacing classes based on compact prop
    const containerClasses = compact
        ? "w-full mx-auto bg-white dark:bg-gray-800 rounded-xl overflow-hidden transition-all duration-300 max-h-[85vh] overflow-y-auto"
        : "w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300";

    const headerClasses = compact
        ? "relative bg-transparent p-4 border-b border-gray-100 dark:border-gray-700/50 overflow-hidden transition-colors duration-300"
        : "relative bg-transparent p-5 border-b border-gray-100 dark:border-gray-700/50 overflow-hidden transition-colors duration-300";

    const bodyClasses = compact
        ? "p-4 space-y-2"
        : "p-5 md:p-6 space-y-5"; // Reduced from p-8 space-y-8

    const inputPadding = compact ? "py-2.5" : "py-3"; // Reduced from py-4

    return (
        <div className={containerClasses}>
            {/* Premium Header */}
            <div className={headerClasses}>
                {/* Header content only - no background blobs */}

                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors z-20 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                )}

                <div className="relative z-10 text-center">
                    <div className={`${compact ? 'w-10 h-10 mb-2' : 'w-10 h-10 mb-2'} bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto border border-gray-200 dark:border-gray-700 shadow-sm`}>
                        <Heart className={`${compact ? 'w-5 h-5' : 'w-5 h-5'} text-pink-500 fill-pink-500/20`} />
                    </div>
                    <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-bold tracking-tight text-gray-900 dark:text-white`}>Giving</h2>
                    {!compact && <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 font-medium">Empowering our community, together.</p>}
                </div>
            </div>

            <div className={bodyClasses}>
                {/* Amount Section */}
                <div className="space-y-2"> {/* Reduced space-y-3 */}
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Select Amount</label>
                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_AMOUNTS.map(val => (
                            <button
                                key={val}
                                onClick={() => setAmount(val)}
                                className={`py-2 rounded-lg text-sm font-bold transition-all duration-200 border ${amount === val
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-300 dark:hover:border-blue-500'
                                    }`}
                            >
                                ${val}
                            </button>
                        ))}
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-gray-400 text-lg font-semibold">$</span>
                        </div>
                        <input
                            type="number"
                            value={amount || ''}
                            onChange={(e) => setAmount(parseFloat(e.target.value))}
                            className={`w-full pl-8 pr-4 ${inputPadding} bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-xl font-bold text-gray-900 dark:text-white placeholder-gray-400`}
                            placeholder="Enter custom amount"
                        />
                    </div>
                </div>

                {/* Donor Details */}
                <div className="space-y-2"> {/* Reduced space-y-3 */}
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Your Information</label>
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={donorName}
                            onChange={(e) => setDonorName(e.target.value)}
                            className={`w-full px-4 ${inputPadding} bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400`}
                            placeholder="Full Name"
                        />
                        <input
                            type="email"
                            value={donorEmail}
                            onChange={(e) => setDonorEmail(e.target.value)}
                            className={`w-full px-4 ${inputPadding} bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400`}
                            placeholder="Email Address"
                        />
                    </div>
                </div>

                {/* Campaign Selection */}
                <div className="space-y-2"> {/* Reduced space-y-3 */}
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Designation</label>
                    <div className="relative">
                        <select
                            value={campaign}
                            onChange={(e) => setCampaign(e.target.value)}
                            className={`w-full pl-4 pr-10 ${inputPadding} bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none text-gray-900 dark:text-white font-medium cursor-pointer`}
                        >
                            {campaigns.map((c: any) => (
                                <option key={c.id || c.name} value={c.name}>{c.name} {c.description ? `- ${c.description}` : ''}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                            <ChevronLeft className="w-4 h-4 -rotate-90" />
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 dark:bg-gray-700 w-full" />

                {/* Platform Support (Tip) - Collapsible */}
                <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowTipSection(!showTipSection)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                        <div className="flex items-center">
                            <Gift className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Support the Platform</span>
                        </div>
                        {showTipSection ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {showTipSection && (
                        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                                Your optional tip allows us to continue building and improving technology for churches.
                            </p>

                            <div className="flex bg-gray-50 dark:bg-gray-700/50 rounded-lg p-1 border border-gray-200 dark:border-gray-600/50">
                                {TIP_PERCENTAGES.map((pct) => (
                                    <button
                                        key={pct}
                                        onClick={() => { setTipPercent(pct); setIsCustomTip(false); }}
                                        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${!isCustomTip && tipPercent === pct
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white shadow-sm'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {pct === 0 ? 'None' : `${pct * 100}%`}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setIsCustomTip(true)}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${isCustomTip
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    Custom
                                </button>
                            </div>

                            {isCustomTip && (
                                <div className="mt-3 relative animate-in fade-in slide-in-from-top-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                                    <input
                                        type="number"
                                        value={customTip}
                                        onChange={(e) => setCustomTip(parseFloat(e.target.value))}
                                        className="w-full pl-6 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Tip amount"
                                    />
                                </div>
                            )}

                            <div className="mt-3 flex justify-between items-center text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Platform Tip</span>
                                <span className="font-semibold text-gray-900 dark:text-white">${tipAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Total & Action */}
                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-end px-1">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Gift</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">${total.toFixed(2)}</span>
                    </div>

                    <button
                        onClick={handleContinue}
                        disabled={isLoading || baseAmount <= 0}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue to Payment'}
                    </button>

                    <div className="flex items-center justify-center space-x-2 text-gray-400 dark:text-gray-500 text-xs text-center">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Secure SSL Encryption · Tax Deductible (Donation Only)</span>
                    </div>
                </div>
            </div>
        </div >
    );
}

function CheckoutForm({ total, onBack, campaign }: { total: number, onBack: () => void, campaign: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsLoading(true);
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/giving/success`,
            },
        });

        if (error.type === "card_error" || error.type === "validation_error") {
            setMessage(error.message || 'An error occurred.');
        } else {
            setMessage("An unexpected error occurred.");
        }
        setIsLoading(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                </button>
                <span className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Checkout</span>
                <div className="w-12"></div> {/* Spacer */}
            </div>

            <div className="p-8">
                <div className="mb-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Total Amount</p>
                    <div className="text-4xl font-extrabold text-gray-900 dark:text-white">${total.toFixed(2)}</div>
                    <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100 dark:border-blue-800">
                        {campaign}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                        <PaymentElement />
                    </div>

                    {message && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-xl border border-red-100 dark:border-red-800 flex items-start">
                            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            {message}
                        </div>
                    )}

                    <button
                        disabled={isLoading || !stripe || !elements}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-200 dark:shadow-none transition-all flex items-center justify-center disabled:opacity-50 transform active:scale-[0.98]"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <span className="flex items-center">
                                Pay ${total.toFixed(2)}
                                <ShieldCheck className="w-4 h-4 ml-2 opacity-80" />
                            </span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}


