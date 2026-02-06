'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    GoogleAuthProvider,
    OAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useTheme } from 'next-themes';
import { FirestoreUser } from '@/types';

interface AuthContextType {
    user: User | null;
    userData: FirestoreUser | null;
    loading: boolean;
    googleAccessToken: string | null;
    signInWithGoogle: () => Promise<void>;
    signInWithYahoo: () => Promise<void>;
    signInWithFacebook: () => Promise<void>;
    signOut: () => Promise<void>;
    clearGmailToken: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<FirestoreUser | null>(null);
    const [loading, setLoading] = useState(true);
    const { setTheme } = useTheme();

    useEffect(() => {
        let unsubscribeUserData: (() => void) | undefined;

        // [AGENT ACCESS] Simulation check for development/automated testing
        const simulateRole = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('simulate_user') : null;
        if (simulateRole === 'admin' && process.env.NODE_ENV === 'development') {
            console.log("AGENT: Simulating admin login...");
            const mockUser = {
                uid: 'agent-dev-123',
                email: 'agent@bethel.dev',
                displayName: 'Antigravity Agent (Dev)',
                photoURL: 'https://github.com/google.png'
            } as User;
            setUser(mockUser);
            setUserData({
                uid: mockUser.uid,
                email: mockUser.email!,
                displayName: mockUser.displayName!,
                role: 'admin',
                churchId: 'bethel-metro', // Default for dev
                createdAt: new Date()
            } as FirestoreUser);
            setLoading(false);
            return;
        }

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // [MULTI-CHURCH] Real-time User Data Sync
                const userRef = doc(db, 'users', currentUser.uid);

                // Initial check to create doc if missing
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    const { resolveChurchIdFromHostname } = await import('@/lib/tenant');
                    const resolvedChurchId = await resolveChurchIdFromHostname(window.location.hostname);

                    const newUserData = {
                        uid: currentUser.uid,
                        email: currentUser.email || '',
                        displayName: currentUser.displayName || 'User',
                        photoURL: currentUser.photoURL || undefined,
                        createdAt: serverTimestamp(),
                        theme: 'system',
                        role: 'member' as const,
                        churchId: resolvedChurchId || null // FIXED: Using null instead of undefined
                    };
                    await setDoc(userRef, newUserData);
                }

                // Listen for changes (important for onboarding completion)
                unsubscribeUserData = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        setUserData(doc.data() as FirestoreUser);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("AuthContext: Error listening to userData:", error);
                    setLoading(false);
                });
            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeUserData) unsubscribeUserData();
        };
    }, []);

    // Filter console noise
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const filterMsg = (msg: string) => {
            return (
                msg.includes('net::ERR_BLOCKED_BY_CLIENT') ||
                msg.includes('violates the following Content Security Policy') ||
                msg.includes('The policy is report-only') ||
                msg.includes('youtube.com/youtubei/v1/log_event') ||
                msg.includes('www.youtube.com/generate_204')
            );
        };

        const originalError = console.error;
        const originalWarn = console.warn;
        const originalLog = console.log;

        console.error = (...args) => {
            const msg = args[0]?.toString() || '';
            if (filterMsg(msg)) return;
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            const msg = args[0]?.toString() || '';
            if (filterMsg(msg)) return;
            originalWarn.apply(console, args);
        };

        console.log = (...args) => {
            const msg = args[0]?.toString() || '';
            if (filterMsg(msg)) return;
            originalLog.apply(console, args);
        };

        return () => {
            console.error = originalError;
            console.warn = originalWarn;
            console.log = originalLog;
        };
    }, []);

    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('googleAccessToken');
        }
        return null;
    });

    const clearGmailToken = () => {
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('googleAccessToken');
        }
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/gmail.send');
        provider.addScope('https://www.googleapis.com/auth/calendar.events');

        // Force consent to ensure we get a fresh credential with the new scope
        provider.setCustomParameters({
            prompt: 'consent'
        });

        try {
            console.error("DEBUG: Starting Google Sign In...");
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);

            if (credential?.accessToken) {
                console.error("DEBUG: Successfully retrieved Gmail access token");
                setGoogleAccessToken(credential.accessToken);
                sessionStorage.setItem('googleAccessToken', credential.accessToken);
            } else {
                console.error("DEBUG: Sign in successful but no access token returned. Credential:", credential);
            }
        } catch (error) {
            console.error("DEBUG: Error signing in with Google", error);
            throw error;
        }
    };

    const signInWithYahoo = async () => {
        const provider = new OAuthProvider('yahoo.com');
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Yahoo", error);
            throw error;
        }
    };

    const signInWithFacebook = async () => {
        const provider = new FacebookAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Facebook", error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUserData(null);
        } catch (error) {
            console.error("Error signing out", error);
            throw error;
        }
    };

    const value = React.useMemo(() => ({
        user,
        userData,
        loading,
        googleAccessToken,
        signInWithGoogle,
        signInWithYahoo,
        signInWithFacebook,
        signOut,
        clearGmailToken
    }), [user, userData, loading, googleAccessToken]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
