'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface BibleReference {
    book: string;
    chapter: number;
    verse?: number;
    endVerse?: number;
}

interface BibleContextType {
    isOpen: boolean;
    isStudyOpen: boolean;
    reference: BibleReference;
    version: string;
    openBible: (ref?: BibleReference) => void;
    closeBible: () => void;
    openStudy: () => void;
    closeStudy: () => void;
    setReference: (ref: BibleReference) => void;
    setVersion: (version: string) => void;
    onInsertNote: ((text: string) => void) | null;
    registerInsertHandler: (handler: ((text: string) => void) | null) => void;
}

const BibleContext = createContext<BibleContextType | undefined>(undefined);

export function BibleProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [reference, setReference] = useState<BibleReference>({ book: 'John', chapter: 3, verse: 16 });
    const [version, setVersion] = useState('kjv');
    const [onInsertNote, setOnInsertNote] = useState<((text: string) => void) | null>(null);

    const [isStudyOpen, setIsStudyOpen] = useState(false);

    const openBible = (ref?: BibleReference) => {
        if (ref) {
            setReference(ref);
        }
        setIsOpen(true);
    };

    const closeBible = () => {
        setIsOpen(false);
    };

    const openStudy = () => setIsStudyOpen(true);
    const closeStudy = () => setIsStudyOpen(false);

    const registerInsertHandler = (handler: ((text: string) => void) | null) => {
        setOnInsertNote(() => handler);
    };

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
            registerInsertHandler
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
