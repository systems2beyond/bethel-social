'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
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

export interface VideoData {
    url: string;
    title?: string;
    provider?: 'youtube' | 'native';
    poster?: string;
}

export interface TabGroup {
    id: string;
    name: string;
    color: string;
    isCollapsed: boolean;
    createdAt: number;
}

export interface Tab {
    id: string;
    reference: BibleReference;
    scrollPosition?: number;
    groupId?: string;
}

export interface BibleContextType {
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
    // Video Context
    activeVideo: VideoData | null;
    openVideo: (video: VideoData) => void;
    closeVideo: () => void;
    onInsertNote: ((text: string) => void) | null;
    registerInsertHandler: (handler: ((text: string) => void) | null) => void;
    // Tabs
    tabs: Tab[];
    groups: TabGroup[];
    activeTabId: string;
    addTab: () => void;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    // Group Management
    createTabGroup: (name: string, color: string) => string;
    toggleGroupCollapse: (groupId: string) => void;
    closeGroup: (groupId: string) => void;
    openMultipleTabs: (refs: BibleReference[], groupId?: string) => void;
    // Search Config
    searchVersion: string;
    setSearchVersion: (version: string) => void;
    // Note & Collaboration Context
    activeNoteId: string | null;
    collaborationId: string | null;
    setCollaborationId: (id: string | null) => void;
    collaborationInitialContent: string | null;
    setCollaborationInitialContent: (content: string | null) => void;
    noteTitle: string;
    openNote: (noteId: string, title?: string) => void;
    pendingNoteContent: string | null;
    setPendingNoteContent: (content: string | null) => void;
    pendingNoteTitle?: string | null;
    setPendingNoteTitle: (title: string | null) => void;
    closeNote: () => void;
    openCollaboration: (collabId: string, title?: string, initialContent?: string) => void;
    // Deep Linking
    initialSearchQuery: string | null;
    openStudyWithSearch: (query: string) => void;
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
    const [groups, setGroups] = useState<TabGroup[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('1');

    // Track if initial Firestore load is complete to avoid reopening study on every save
    const initialLoadDoneRef = useRef(false);

    const [version, setVersion] = useState('kjv');
    const [searchVersion, setSearchVersion] = useState('kjv'); // Default to KJV
    const [onInsertNote, setOnInsertNote] = useState<((text: string) => void) | null>(null);
    const [isStudyOpen, setIsStudyOpen] = useState(false);

    // Note & Collaboration State
    // Note & Collaboration State
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [_collaborationId, _setCollaborationId] = useState<string | null>(null);

    // Wrapper to trace ID changes
    // Wrapper to trace ID changes
    const setCollaborationId = useCallback((id: string | null) => {
        _setCollaborationId(id);
    }, []);

    const collaborationId = _collaborationId;

    const [collaborationInitialContent, setCollaborationInitialContent] = useState<string | null>(null);
    const [noteTitle, setNoteTitle] = useState('General Bible Study');

    // Video State
    const [activeVideo, setActiveVideo] = useState<VideoData | null>(null);

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

    const addTab = useCallback(() => {
        const newId = Date.now().toString();
        // Clone current tab's reference or default
        const currentRef = tabs.find(t => t.id === activeTabId)?.reference || { book: 'John', chapter: 3, verse: 16 };
        setTabs(prev => [...prev, { id: newId, reference: { ...currentRef } }]);
        setActiveTabId(newId);
    }, [activeTabId, tabs]);

    const closeTab = useCallback((id: string) => {
        if (tabs.length === 1) return; // Don't close last tab

        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);

        if (id === activeTabId) {
            // Switch to last tab
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
    }, [tabs, activeTabId]);

    const createTabGroup = useCallback((name: string, color: string) => {
        const newGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setGroups(prev => [...prev, {
            id: newGroupId,
            name,
            color,
            isCollapsed: false,
            createdAt: Date.now()
        }]);
        return newGroupId;
    }, []);

    const toggleGroupCollapse = useCallback((groupId: string) => {
        setGroups(prev => prev.map(g =>
            g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
        ));
    }, []);

    const closeGroup = useCallback((groupId: string) => {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        // Close all tabs in this group
        setTabs(prev => {
            const keeping = prev.filter(t => t.groupId !== groupId);
            // If we closed the active tab, switch to the last remaining one
            if (!keeping.some(t => t.id === activeTabId) && keeping.length > 0) {
                setActiveTabId(keeping[keeping.length - 1].id);
            }
            // Ensure at least one tab remains
            if (keeping.length === 0) {
                return [{ id: '1', reference: { book: 'John', chapter: 3, verse: 16 } }];
            }
            return keeping;
        });
    }, [activeTabId]);

    const openMultipleTabs = useCallback((refs: BibleReference[], groupId?: string) => {
        setTabs(prev => {
            // 1. Identify all refs we want to be in this group/selection
            // We want the final order to match 'refs'.

            // 2. Separate existing tabs that are NOT involved in this new set
            // We'll keep them as they are.
            const otherTabs = prev.filter(t =>
                !refs.some(ref => ref.book === t.reference.book && ref.chapter === t.reference.chapter)
            );

            // 3. Create the new list of tabs for these refs specifically, IN ORDER
            const newGroupTabs = refs.map((ref, index) => {
                // Check if this ref ALREADY existed in the previous state (to preserve ID/state)
                const existingTab = prev.find(t =>
                    t.reference.book === ref.book && t.reference.chapter === ref.chapter
                );

                if (existingTab) {
                    // Update existing tab to join the new group if provided
                    return {
                        ...existingTab,
                        groupId: groupId || existingTab.groupId, // Adopt new group if provided
                        reference: ref // Update ref in case verse/endVerse changed
                    };
                } else {
                    // Create NEW tab
                    return {
                        id: `tab-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
                        reference: ref,
                        groupId: groupId
                    };
                }
            });

            const finalTabs = [...otherTabs, ...newGroupTabs];

            // 4. Determine the ID to activate (FIRST one in the new sequence)
            let idToActivate = activeTabId;
            if (newGroupTabs.length > 0) {
                // Activate the FIRST tab so the user starts at the beginning of the lesson/sermon
                idToActivate = newGroupTabs[0].id;
            }

            // Side-effect: Switch tab. 
            // Note: Calling setState inside setState updater is generally discouraged but works for this specific interaction 
            // where we need the *generated* ID.
            if (idToActivate !== activeTabId) {
                // Defer strict mode warning by using setTimeout or just accept it as it often works in event handlers.
                // Better: we can't easily extract this logic without double-rendering or complex Ref usage.
                // Current pattern is "good enough" for this app's architecture.
                setTimeout(() => setActiveTabId(idToActivate), 0);
            }

            return finalTabs;
        });
        // Remove auto-open of sidebar, let the caller decide context (e.g. Study Modal vs Sidebar)
        // setIsOpen(true); 
    }, [activeTabId]);

    const setActiveTab = useCallback((id: string) => setActiveTabId(id), []);

    // Shim setReference to update ACTIVE tab
    const setReference = useCallback((ref: BibleReference) => {
        setTabs(prev => prev.map(tab =>
            tab.id === activeTabId ? { ...tab, reference: ref } : tab
        ));
    }, [activeTabId]);

    // Derived reference for backward compatibility
    const reference = tabs.find(t => t.id === activeTabId)?.reference || { book: 'John', chapter: 3, verse: 16 };

    const closeBible = useCallback(() => {
        setIsOpen(false);
    }, []);

    const openStudy = useCallback(() => setIsStudyOpen(true), []);

    const closeStudy = useCallback(() => {
        setIsStudyOpen(false);
        // Reset note context when closing
        setActiveNoteId(null);
        setCollaborationId(null);
        setCollaborationInitialContent(null);
        setNoteTitle('General Bible Study');
        setActiveVideo(null);
    }, [setCollaborationId]);

    const openVideo = useCallback((video: VideoData) => {
        setActiveVideo(video);
        setIsStudyOpen(true);
    }, []);

    const closeVideo = useCallback(() => {
        setActiveVideo(null);
    }, []);

    const openNote = useCallback((noteId: string, title?: string) => {
        setActiveNoteId(noteId);
        setCollaborationId(null); // Ensure we are not colliding
        setCollaborationInitialContent(null);
        if (title) setNoteTitle(title);
        setIsStudyOpen(true);
    }, [setCollaborationId]);

    const openCollaboration = useCallback((collabId: string, title?: string, initialContent?: string) => {
        setCollaborationId(collabId);
        setCollaborationInitialContent(initialContent || null);
        setActiveNoteId(null); // Ensure we are not in personal note mode
        if (title) setNoteTitle(title);
        setIsStudyOpen(true);
    }, [setCollaborationId]);

    const [initialSearchQuery, setInitialSearchQuery] = useState<string | null>(null);
    const [pendingNoteContent, setPendingNoteContent] = useState<string | null>(null);
    const [pendingNoteTitle, setPendingNoteTitle] = useState<string | null>(null);

    const openStudyWithSearch = useCallback((query: string) => {
        setInitialSearchQuery(query);
        setIsStudyOpen(true);
    }, []);

    const registerInsertHandler = useCallback((handler: ((text: string) => void) | null) => {
        setOnInsertNote(() => handler);
    }, []);

    // Load tabs from Firestore
    useEffect(() => {
        if (!user) return;
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'settings', 'bible-tabs'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.tabs) setTabs(data.tabs);
                if (data.activeTabId) setActiveTabId(data.activeTabId);
                if (data.groups) setGroups(data.groups);
                // Also restore search version if saved
                if (data.searchVersion) setSearchVersion(data.searchVersion);
                // Resore collaboration ID if it exists
                if (data.activeCollaborationId) {
                    _setCollaborationId(data.activeCollaborationId);
                    // State is restored but study modal stays closed - user opens it explicitly
                }
                if (data.activeNoteId) {
                    setActiveNoteId(data.activeNoteId);
                    if (data.noteTitle) setNoteTitle(data.noteTitle);
                    // State is restored but study modal stays closed - user opens it explicitly
                }
            }
        }, (err) => {
            console.error('[BibleContext] Bible tabs listener error:', err);
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
                groupId: tab.groupId || null,
                scrollPosition: tab.scrollPosition ?? 0
            }));

            const sanitizedGroups = groups.map(g => ({
                ...g,
                isCollapsed: g.isCollapsed ?? false
            }));

            // Ensure searchVersion is never undefined
            const safeSearchVersion = searchVersion || 'kjv';

            setDoc(doc(db, 'users', user.uid, 'settings', 'bible-tabs'), {
                tabs: sanitizedTabs,
                groups: sanitizedGroups,
                activeTabId: activeTabId || '1', // Ensure activeTabId is never undefined
                searchVersion: safeSearchVersion,
                activeCollaborationId: collaborationId || null,
                activeNoteId: activeNoteId || null,
                noteTitle: noteTitle || 'General Bible Study'
            }, { merge: true }).catch(err => console.error('Error saving bible tabs:', err));
        }, 1000);
        return () => clearTimeout(saveState);
    }, [tabs, activeTabId, user, searchVersion]);


    const closeNote = useCallback(() => {
        setActiveNoteId(null);
        setNoteTitle('General Bible Study');
    }, []);

    const value = React.useMemo(() => ({
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
        activeVideo,
        openVideo,
        closeVideo,
        onInsertNote,
        registerInsertHandler,
        tabs,
        activeTabId,
        addTab,
        closeTab,
        setActiveTab,
        searchVersion,
        setSearchVersion,
        activeNoteId,
        collaborationId,
        setCollaborationId,
        collaborationInitialContent,
        setCollaborationInitialContent,
        noteTitle,
        openNote,
        pendingNoteContent,
        setPendingNoteContent,
        pendingNoteTitle,
        setPendingNoteTitle,
        closeNote,
        openCollaboration,
        groups,
        createTabGroup,
        toggleGroupCollapse,
        closeGroup,
        openMultipleTabs,
        initialSearchQuery,
        openStudyWithSearch
    }), [
        isOpen, isStudyOpen, reference, version, openBible, closeBible, openStudy, closeStudy,
        setReference, setVersion, onInsertNote, registerInsertHandler, tabs, activeTabId,
        addTab, closeTab, setActiveTab, searchVersion, setSearchVersion, activeNoteId,
        collaborationId, setCollaborationId, collaborationInitialContent, setCollaborationInitialContent,
        noteTitle, openNote, closeNote, openCollaboration, groups, createTabGroup, toggleGroupCollapse, closeGroup,
        pendingNoteContent, setPendingNoteContent, pendingNoteTitle, setPendingNoteTitle,
        openMultipleTabs, activeVideo, openVideo, closeVideo, initialSearchQuery, openStudyWithSearch
    ]);

    return (
        <BibleContext.Provider value={value}>
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
