'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

export interface ActivityItem {
    id: string;
    type: 'invite' | 'notification';
    data: any;
    createdAt: Date;
}

interface ActivityContextType {
    isActivityPanelOpen: boolean;
    setActivityPanelOpen: (isOpen: boolean) => void;
    notifications: any[];
    invitations: any[];
    usersMap: Record<string, any>;
    selectedResource: any | null;
    setSelectedResource: (resource: any | null) => void;
    markAsViewed: (id: string, type: 'invite' | 'notification') => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [isActivityPanelOpen, setActivityPanelOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, any>>({});
    const [selectedResource, setSelectedResource] = useState<any | null>(null);

    const markAsViewed = useCallback(async (id: string, type: 'invite' | 'notification') => {
        if (!user?.uid) return;
        try {
            const collectionName = type === 'invite' ? 'invitations' : 'notifications';
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, collectionName, id), {
                viewed: true
            });
        } catch (e) {
            console.error(`Error marking ${type} as viewed:`, e);
        }
    }, [user?.uid]);

    // Fetch Invitations
    useEffect(() => {
        if (!user?.uid) return;
        const qInvites = query(
            collection(db, 'invitations'),
            where('toUserId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(qInvites, (snap) => {
            setInvitations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => {
            console.error('[ActivityContext] Invitations listener error:', err);
        });
        return () => unsub();
    }, [user?.uid]);

    // Fetch Notifications
    useEffect(() => {
        if (!user?.uid) return;
        const qNotifs = query(
            collection(db, 'notifications'),
            where('toUserId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(qNotifs, (snap) => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => {
            console.error('[ActivityContext] Notifications listener error:', err);
        });
        return () => unsub();
    }, [user?.uid]);

    // Fetch user details for names in activity feed
    useEffect(() => {
        const fetchUsers = async () => {
            const userIdsToFetch = new Set<string>();
            [...invitations, ...notifications].forEach(item => {
                const uid = item.fromUserId || item.fromUser?.uid;
                if (uid) userIdsToFetch.add(uid);
            });

            if (userIdsToFetch.size === 0) return;

            const newUsersMap = { ...usersMap };
            await Promise.all(Array.from(userIdsToFetch).map(async (uid) => {
                if (newUsersMap[uid] && newUsersMap[uid].displayName !== 'Searching...') return;
                try {
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        newUsersMap[uid] = userDoc.data();
                    } else {
                        // If we have fromUser.displayName in the item, use it as fallback
                        const itemWithUid = [...invitations, ...notifications].find(i => (i.fromUserId === uid || i.fromUser?.uid === uid) && i.fromUser?.displayName);
                        newUsersMap[uid] = { displayName: itemWithUid?.fromUser?.displayName || 'Unknown User' };
                    }
                } catch (e) {
                    console.error("Error fetching user", uid, e);
                    newUsersMap[uid] = { displayName: 'User' };
                }
            }));
            setUsersMap(newUsersMap);
        };

        if (invitations.length > 0 || notifications.length > 0) {
            fetchUsers();
        }
    }, [invitations, notifications]);

    return (
        <ActivityContext.Provider value={{
            isActivityPanelOpen,
            setActivityPanelOpen,
            notifications,
            invitations,
            usersMap,
            selectedResource,
            setSelectedResource,
            markAsViewed
        }}>
            {children}
        </ActivityContext.Provider>
    );
}

export function useActivity() {
    const context = useContext(ActivityContext);
    if (context === undefined) {
        throw new Error('useActivity must be used within an ActivityProvider');
    }
    return context;
}
