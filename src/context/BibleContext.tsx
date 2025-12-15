'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { bibleSearch } from '@/lib/search/bible-index';

export interface BibleReference {
    book: string;
    chapter: number;
    verse?: number;
    endVerse?: number;
}

export interface Tab {
    id: string;
    reference: BibleReference;
    scrollPosition?: number;
}

interface BibleContextType {
    isOpen: boolean;
    isStudyOpen: boolean;
    reference: BibleReference;
    version: string;
    openBible: (ref?: BibleReference, newTab?: boolean) => void;
    closeBible: () => void;
    openStudy: () => void;
    closeStudy: () => void;
    setReference: (ref: BibleReference) => void;
    setVersion: (version: string) => void;
    onInsertNote: ((text: string) => void) | null;
    registerInsertHandler: (handler: ((text: string) => void) | null) => void;
    // Tabs
    tabs: Tab[];
    activeTabId: string;
    addTab: () => void;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    // Search Config
    searchVersion: string;
    setSearchVersion: (version: string) => void;
}

const BibleContext = createContext<BibleContextType | undefined>(undefined);

export function BibleProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const { user, userData } = useAuth();

    // Sync Custom Sources from User Data
    useEffect(() => {
        if (userData?.customBibleSources && Array.isArray(userData.customBibleSources)) {
            userData.customBibleSources.forEach((source: { name: string, url: string }) => {
                bibleSearch.registerCustomSource(source.name, source.url).catch(console.error);
            });
        }
    }, [userData?.customBibleSources]);

    // Tabs State
    const [tabs, setTabs] = useState<Tab[]>([
        { id: '1', reference: { book: 'John', chapter: 3, verse: 16 } }
    ]);
    const [activeTabId, setActiveTabId] = useState<string>('1');

    const [version, setVersion] = useState('kjv');
    const [searchVersion, setSearchVersion] = useState('kjv'); // Default to KJV
    const [onInsertNote, setOnInsertNote] = useState<((text: string) => void) | null>(null);
    const [isStudyOpen, setIsStudyOpen] = useState(false);

    const openBible = useCallback((ref?: BibleReference, newTab = false) => {
        if (newTab) {
            const newId = Date.now().toString();
            setTabs(prev => [...prev, { id: newId, reference: ref || { book: 'John', chapter: 3, verse: 16 } }]);
            setActiveTabId(newId);
        } else if (ref) {
            // Update active tab
            setTabs(prev => prev.map(tab =>
                tab.id === activeTabId ? { ...tab, reference: ref } : tab
            ));
        }

        setIsOpen(true);
    }, [activeTabId]);

    const addTab = () => {
        const newId = Date.now().toString();
        // Clone current tab's reference or default
        const currentRef = tabs.find(t => t.id === activeTabId)?.reference || { book: 'John', chapter: 3, verse: 16 };
        setTabs(prev => [...prev, { id: newId, reference: { ...currentRef } }]);
        setActiveTabId(newId);
    };

    const closeTab = (id: string) => {
        if (tabs.length === 1) return; // Don't close last tab

        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);

        if (id === activeTabId) {
            // Switch to last tab
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
    };

    const setActiveTab = (id: string) => setActiveTabId(id);

    // Shim setReference to update ACTIVE tab
    const setReference = (ref: BibleReference) => {
        setTabs(prev => prev.map(tab =>
            tab.id === activeTabId ? { ...tab, reference: ref } : tab
        ));
    };

    // Derived reference for backward compatibility
    const reference = tabs.find(t => t.id === activeTabId)?.reference || { book: 'John', chapter: 3, verse: 16 };

    const closeBible = () => {
        setIsOpen(false);
    };

    const openStudy = () => setIsStudyOpen(true);
    const closeStudy = () => setIsStudyOpen(false);

    const registerInsertHandler = (handler: ((text: string) => void) | null) => {
        setOnInsertNote(() => handler);
    };

    // Load tabs from Firestore
    useEffect(() => {
        if (!user) return;
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'settings', 'bible-tabs'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.tabs) setTabs(data.tabs);
                if (data.activeTabId) setActiveTabId(data.activeTabId);
                // Also restore search version if saved
                if (data.searchVersion) setSearchVersion(data.searchVersion);
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Save tabs/state
    useEffect(() => {
        if (!user) return;
        const saveState = setTimeout(() => {
            // Sanitize tabs to remove undefined values which Firebase rejects
            const sanitizedTabs = tabs.map(tab => ({
                id: tab.id || 'tab-' + Date.now(),
                reference: {
                    book: tab.reference?.book || 'Genesis',
                    chapter: tab.reference?.chapter || '1',
                    verse: tab.reference?.verse ?? null,
                    endVerse: tab.reference?.endVerse ?? null
                },
                scrollPosition: tab.scrollPosition ?? 0
            }));

            // Ensure searchVersion is never undefined
            const safeSearchVersion = searchVersion || 'kjv';

            setDoc(doc(db, 'users', user.uid, 'settings', 'bible-tabs'), {
                tabs: sanitizedTabs,
                activeTabId: activeTabId || '1', // Ensure activeTabId is never undefined
                searchVersion: safeSearchVersion
            }, { merge: true }).catch(err => console.error('Error saving bible tabs:', err));
        }, 1000);
        return () => clearTimeout(saveState);
    }, [tabs, activeTabId, user, searchVersion]);

    return (
        <BibleContext.Provider value={{
            isOpen,
            isStudyOpen,
            reference,
            version,
            openBible,
            closeBible,
            openStudy,
            closeStudy,
            setReference,
            setVersion,
            onInsertNote,
            registerInsertHandler,
            tabs,
            activeTabId,
            addTab,
            closeTab,
            setActiveTab,
            searchVersion,
            setSearchVersion
        }}>
            {children}
        </BibleContext.Provider>
    );
}

export function useBible() {
    const context = useContext(BibleContext);
    if (context === undefined) {
        throw new Error('useBible must be used within a BibleProvider');
    }
    return context;
}
