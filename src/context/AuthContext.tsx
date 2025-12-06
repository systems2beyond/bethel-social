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

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google", error);
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
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithYahoo, signInWithFacebook, signOut }}>
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
