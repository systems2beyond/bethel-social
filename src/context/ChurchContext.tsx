'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { Church, ChurchProfile } from '@/types';

const SESSION_STORAGE_KEY = 'super_admin_church_override';

function resolveProfile(church: Church): ChurchProfile {
    return {
        ...church,
        tagline: church.tagline || `Stay connected with ${church.name}`,
        appName: church.appName || 'Living Water',
        description: church.description || '',
        botName: church.botName || `${church.name} Assistant`,
        botGreeting: church.botGreeting || `Hello! I'm your ${church.name} Assistant. How can I help you today?`,
    };
}

interface ChurchContextValue {
    church: ChurchProfile | null;
    loading: boolean;
    error: Error | null;
    // Super admin church switching
    switchChurch: (churchId: string) => void;
    resetChurch: () => void;
    isSwitched: boolean;
    originalChurchId: string | null;
}

const ChurchContext = createContext<ChurchContextValue>({
    church: null,
    loading: true,
    error: null,
    switchChurch: () => {},
    resetChurch: () => {},
    isSwitched: false,
    originalChurchId: null,
});

export function ChurchProvider({ children }: { children: React.ReactNode }) {
    const { userData } = useAuth();
    const [church, setChurch] = useState<ChurchProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [overrideChurchId, setOverrideChurchId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem(SESSION_STORAGE_KEY);
        }
        return null;
    });

    const originalChurchId = userData?.churchId || null;
    const activeChurchId = overrideChurchId || originalChurchId;
    const isSwitched = !!overrideChurchId && overrideChurchId !== originalChurchId;

    const switchChurch = useCallback((churchId: string) => {
        setOverrideChurchId(churchId);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_STORAGE_KEY, churchId);
        }
    }, []);

    const resetChurch = useCallback(() => {
        setOverrideChurchId(null);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        if (!activeChurchId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = onSnapshot(
            doc(db, 'churches', activeChurchId),
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = { id: snapshot.id, ...snapshot.data() } as Church;
                    setChurch(resolveProfile(data));
                } else {
                    setChurch(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching church profile:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [activeChurchId]);

    return (
        <ChurchContext.Provider value={{
            church,
            loading,
            error,
            switchChurch,
            resetChurch,
            isSwitched,
            originalChurchId,
        }}>
            {children}
        </ChurchContext.Provider>
    );
}

export function useChurch() {
    const context = useContext(ChurchContext);
    if (context === undefined) {
        throw new Error('useChurch must be used within a ChurchProvider');
    }
    return context;
}
