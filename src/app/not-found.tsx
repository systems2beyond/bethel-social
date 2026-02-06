'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800">
                <span className="text-3xl font-bold text-zinc-700">404</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
            <p className="text-zinc-400 mb-8 max-w-md">
                We couldn't find the page you were looking for. It might have been moved, deleted, or never existed.
            </p>

            <div className="flex items-center gap-4">
                <Link
                    href="/"
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
                >
                    <Home className="w-4 h-4" />
                    <span>Go Home</span>
                </Link>
                <button
                    onClick={() => window.history.back()}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-xl transition-colors font-medium"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Go Back</span>
                </button>
            </div>
        </div>
    );
}
