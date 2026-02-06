'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// This page redirects to the church-specific connect form
// URL format: /connect/[churchId]
// If user is logged in, it redirects to their church's form
// Otherwise, shows a message that the URL is incomplete
export default function ConnectFormPage() {
    const router = useRouter();
    const { userData, loading } = useAuth();

    useEffect(() => {
        // If user is logged in, redirect to their church's connect form
        if (!loading && userData?.churchId) {
            router.replace(`/connect/${userData.churchId}`);
        }
    }, [userData, loading, router]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // If logged in, show redirect message
    if (userData?.churchId) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-zinc-400">Redirecting to your church&apos;s connect form...</p>
                </div>
            </div>
        );
    }

    // If not logged in, show message about needing the full URL
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Connect Form</h1>
                <p className="text-zinc-400 mb-6">
                    Please scan the QR code provided by your church to access their connect form.
                </p>
                <p className="text-zinc-500 text-sm">
                    If you&apos;re a church admin, log in to access your connect form editor.
                </p>
            </div>
        </div>
    );
}
