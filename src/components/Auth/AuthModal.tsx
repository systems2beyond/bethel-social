'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogIn } from 'lucide-react';

export function AuthModal() {
    const { user, signInWithGoogle, signInWithFacebook, signInWithYahoo, loading } = useAuth();
    const [isOpen, setIsOpen] = React.useState(false);

    // Auto-open if not logged in and on the home page (or other public feed)
    // We can refine this logic. For now, let's keep it manual but prominent.
    // Or we can show it if there's no user and they try to interact.

    // Let's actually make it controllable via a global state or just check user.
    // However, we don't want to annoy them if they are just browsing.
    // The user said: "sign in and or signup modal when a none user or a user that is not signed in see instead of the App just spinning"

    // We'll show a "Prompter" if not logged in.

    if (user || loading) return null;

    return (
        <AnimatePresence>
            {!user && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh] pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-gray-100 dark:border-zinc-800 p-8 w-full max-w-md pointer-events-auto"
                    >
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                                <LogIn className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Welcome to the Community</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Sign in to join the conversation, share with your church family, and stay connected.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={signInWithGoogle}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all font-medium text-gray-700 dark:text-gray-200 shadow-sm"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </button>

                            <button
                                onClick={signInWithFacebook}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] transition-all font-medium text-white shadow-sm"
                            >
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                                Continue with Facebook
                            </button>

                            <button
                                onClick={signInWithYahoo}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#6001d2] hover:bg-[#5201b1] transition-all font-medium text-white shadow-sm"
                            >
                                <span className="font-bold">Y!</span>
                                Continue with Yahoo
                            </button>
                        </div>

                        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-4 uppercase tracking-widest font-semibold">
                            Secure • Private • Community
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
