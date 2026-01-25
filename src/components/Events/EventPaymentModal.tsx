
'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Loader2, ShieldCheck, Gift, ChevronDown, ChevronUp, AlertCircle, Ticket, CalendarClock, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { resolveChurchIdFromHostname } from '@/lib/tenant';
import { useAuth } from '@/context/AuthContext';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const TIP_PERCENTAGES = [0, 0.03, 0.05, 0.08];

interface EventPaymentModalProps {
    eventId: string;
    eventTitle: string;
    ticketType: string;
    ticketPrice: number; // Single ticket price
    quantity: number;
    registrationData: any; // Name, email, answers
    dateLabel: string; // "Oct 5, 2025"
    onSuccess: (registrationId: string) => void;
    onBack: () => void;
    initialChurchId?: string;
}

export default function EventPaymentModal({
    eventId,
    eventTitle,
    ticketType,
    ticketPrice,
    quantity,
    registrationData,
    dateLabel,
    onSuccess,
    onBack,
    initialChurchId
}: EventPaymentModalProps) {
    const { userData } = useAuth();
    const [resolvedChurchId, setResolvedChurchId] = useState<string | null>(initialChurchId || userData?.churchId || null);
    const [step, setStep] = useState<number>(1); // 1: Tip & Review, 2: Payment

    useEffect(() => {
        if (!resolvedChurchId) {
            const init = async () => {
                const id = await resolveChurchIdFromHostname(window.location.hostname);
                setResolvedChurchId(id || 'bethel-metro');
            };
            init();
        }
    }, [resolvedChurchId]);

    // Tipping
    const [tipPercent, setTipPercent] = useState<number>(0.03); // Default 3%
    const [customTip, setCustomTip] = useState<number>(0);
    const [isCustomTip, setIsCustomTip] = useState<boolean>(false);
    const [showTipSection, setShowTipSection] = useState(false);

    // Payment State
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [registrationId, setRegistrationId] = useState<string | null>(null);

    // Calculations
    const subtotal = ticketPrice * quantity;
    const baseAmount = subtotal; // In dollars
    const calculatedTip = Math.round(baseAmount * tipPercent * 100) / 100; // Round to 2 decimals
    const tipAmount = isCustomTip ? customTip : (tipPercent > 0 ? Math.max(calculatedTip, 1) : 0);
    const total = baseAmount + tipAmount;

    const handleInitializePayment = async () => {
        setIsLoading(true);
        try {
            const createIntent = httpsCallable(functions, 'createEventPaymentIntent');
            const result = await createIntent({
                amount: baseAmount * 100, // Cents
                tipAmount: tipAmount * 100, // Cents
                churchId: resolvedChurchId || 'bethel-metro',
                eventId: eventId,
                ticketType: ticketType,
                quantity: quantity,
                registrationData: registrationData
            });
            const data = result.data as { clientSecret: string, registrationId: string };
            setClientSecret(data.clientSecret);
            setRegistrationId(data.registrationId);
            setStep(2);
        } catch (error) {
            console.error('Payment Init Error:', error);
            toast.error('Could not initialize payment. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 2 && clientSecret) {
        return (
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
                    onSuccess={() => onSuccess(registrationId!)} // Pass the registration ID back
                    eventTitle={eventTitle}
                />
            </Elements>
        );
    }

    return (
        <div className="animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-6 pr-14 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="-ml-2 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                    >
                        <span className="sr-only">Go Back</span>
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Complete Registration</h2>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                            <CalendarClock className="w-4 h-4 mr-2" />
                            {dateLabel}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Order Summary */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Order Summary</h3>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-2 border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-900 dark:text-white">{eventTitle}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex items-center">
                                <Ticket className="w-4 h-4 mr-2" />
                                {quantity}x {ticketType} Ticket{quantity > 1 ? 's' : ''}
                            </span>
                            <span className="font-semibold">${subtotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Platform Support (Tip) */}
                <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowTipSection(!showTipSection)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                        <div className="flex items-center">
                            <Gift className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Support the Platform</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {tipAmount > 0 && <span className="text-xs font-medium text-green-600 dark:text-green-400">+${tipAmount.toFixed(2)}</span>}
                            {showTipSection ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                    </button>

                    {showTipSection && (
                        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                                Your optional tip helps us maintain the platform for the church.
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
                        </div>
                    )}
                </div>

                {/* Total & Action */}
                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-end px-1 border-t border-gray-100 dark:border-gray-700 pt-4">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">${total.toFixed(2)}</span>
                    </div>

                    <button
                        onClick={handleInitializePayment}
                        disabled={isLoading}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue to Payment'}
                    </button>

                    <div className="flex items-center justify-center space-x-2 text-gray-400 dark:text-gray-500 text-xs text-center">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Secure SSL Encryption</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CheckoutForm({ total, onBack, onSuccess, eventTitle }: { total: number, onBack: () => void, onSuccess: () => void, eventTitle: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsLoading(true);
        // We confirm the payment.
        // For webhooks to work perfectly, we technically rely on the webhook to confirm registration.
        // But for UX, we can check the paymentIntent status.

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: 'if_required'
        });

        if (error) {
            if (error.type === "card_error" || error.type === "validation_error") {
                setMessage(error.message || 'An error occurred.');
            } else {
                setMessage("An unexpected error occurred.");
            }
            setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            // Success!
            onSuccess();
        } else {
            setMessage("Payment processing...");
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 pr-14 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                </button>
                <span className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Checkout</span>
                <div className="w-12"></div>
            </div>

            <div className="p-6">
                <div className="mb-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{eventTitle}</p>
                    <div className="text-3xl font-extrabold text-gray-900 dark:text-white">${total.toFixed(2)}</div>
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
                        className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-200 dark:shadow-none transition-all flex items-center justify-center disabled:opacity-50 transform active:scale-[0.98]"
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
