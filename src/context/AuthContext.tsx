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
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useTheme } from 'next-themes';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    googleAccessToken: string | null;
    signInWithGoogle: () => Promise<void>;
    signInWithYahoo: () => Promise<void>;
    signInWithFacebook: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { setTheme } = useTheme();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Sync user to Firestore
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    // Create new user doc
                    await setDoc(userRef, {
                        email: currentUser.email,
                        displayName: currentUser.displayName,
                        photoURL: currentUser.photoURL,
                        createdAt: serverTimestamp(),
                        theme: 'system' // Default theme
                    });
                } else {
                    // Update existing user doc (if needed) and load theme
                    const userData = userSnap.data();
                    if (userData.theme) {
                        setTheme(userData.theme);
                    }
                }
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [setTheme]);

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

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/gmail.send');

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
        } catch (error) {
            console.error("Error signing out", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, googleAccessToken, signInWithGoogle, signInWithYahoo, signInWithFacebook, signOut }}>
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
