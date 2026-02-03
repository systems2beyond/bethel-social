'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-lg w-full border border-red-200 dark:border-red-900">
                        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                            <AlertCircle className="w-8 h-8" />
                            <h2 className="text-xl font-bold">Something went wrong</h2>
                        </div>

                        <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-md overflow-auto max-h-[300px] text-xs font-mono mb-4 text-slate-700 dark:text-slate-300">
                            {this.state.error?.toString()}
                            <br />
                            <br />
                            {this.state.errorInfo?.componentStack}
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
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
