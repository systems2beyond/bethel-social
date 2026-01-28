'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AnalyticsService } from '@/services/AnalyticsService';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    errorId?: string;
}

export class GlobalErrorHandler extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);

        try {
            // Log to Firestore via AnalyticsService V2
            // We strip PII but keep user ID for debugging context
            await AnalyticsService.logError(error.message, 'critical', {
                feature_area: window.location.pathname.split('/')[1] || 'home',
                stack: error.stack,
                fatal: true
            });

            // Set state to show UI (we no longer manually write to system_logs here 
            // because AnalyticsService.logError handles that via 'error_event')
            this.setState({ errorId: `err_${Date.now()}` }); // Simple client-side REF for user

        } catch (logError) {
            console.error('Failed to log error to Firestore:', logError);
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-900 p-4">
                    <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-6 text-center space-y-4">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            Something went wrong
                        </h2>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            We've logged this issue and our engineering team has been notified.
                        </p>

                        {this.state.errorId && (
                            <p className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-zinc-900 p-2 rounded select-all">
                                Error Ref: {this.state.errorId}
                            </p>
                        )}

                        <button
                            onClick={() => window.location.href = '/'}
                            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Return Home
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-2 px-4 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
