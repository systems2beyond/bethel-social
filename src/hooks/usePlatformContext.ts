import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBible } from '@/context/BibleContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';

export function usePlatformContext() {
    const { user } = useAuth();
    const { reference, tabs, activeTabId } = useBible();

    const [contextData, setContextData] = useState({
        events: [] as string[],
        posts: [] as string[],
        notes: [] as string[],
        groups: [] as string[],
        notifications: 0,
        bible: ''
    });

    // 1. Bible Context (Immediate)
    useEffect(() => {
        if (!tabs || tabs.length === 0) {
            setContextData(prev => ({ ...prev, bible: 'No active bible tabs.' }));
            return;
        }

        const activeTab = tabs.find(t => t.id === activeTabId);
        const activeRef = activeTab?.reference || reference;

        const openTabsList = tabs.map(t =>
            `${t.reference.book} ${t.reference.chapter}${t.reference.verse ? `:${t.reference.verse}` : ''}`
        ).join(', ');

        const bibleString = `Current Active Tab: ${activeRef.book} ${activeRef.chapter}${activeRef.verse ? `:${activeRef.verse}` : ''}. Open Tabs: ${openTabsList}`;

        setContextData(prev => ({ ...prev, bible: bibleString }));
    }, [tabs, activeTabId, reference]);

    // 2. Firestore Subscriptions (Events, Posts, Groups, Notifications, Notes)
    useEffect(() => {
        if (!user) return;

        // Events: Next 5 upcoming
        const eventsQ = query(
            collection(db, 'events'),
            where('startDate', '>=', new Date().toISOString()),
            orderBy('startDate', 'asc'),
            limit(5)
        );

        // Posts: Latest 3
        const postsQ = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(3)
        );

        // Notes: Latest 3 modified by user
        const notesQ = query(
            collection(db, 'users', user.uid, 'notes'),
            orderBy('updatedAt', 'desc'),
            limit(3)
        );

        // Notifications: Unread count (Root Collection)
        const notifsQ = query(
            collection(db, 'notifications'),
            where('toUserId', '==', user.uid),
            where('viewed', '==', false), // 'viewed' is the field used in ActivityContext, 'read' might be wrong? ActivityContext uses 'viewed'.
            limit(10)
        );

        // Groups: Member of
        const groupsQ = query(
            collection(db, 'groups'),
            where('members', 'array-contains', user.uid),
            limit(5)
        );

        const unsubEvents = onSnapshot(eventsQ, (snap) => {
            const events = snap.docs.map(d => {
                const data = d.data();
                return `${data.title} (${new Date(data.startDate).toLocaleDateString()})`;
            });
            setContextData(prev => ({ ...prev, events }));
        }, (err) => console.error("Err fetching events context:", err));

        const unsubPosts = onSnapshot(postsQ, (snap) => {
            const posts = snap.docs.map(d => `${d.data().content?.substring(0, 50)}...`);
            setContextData(prev => ({ ...prev, posts }));
        }, (err) => console.error("Err fetching posts context:", err));

        const unsubNotes = onSnapshot(notesQ, (snap) => {
            const notes = snap.docs.map(d => `"${d.data().title}" (edited ${d.data().updatedAt?.toDate ? d.data().updatedAt.toDate().toLocaleDateString() : 'recently'})`);
            setContextData(prev => ({ ...prev, notes }));
        }, (err) => console.error("Err fetching notes context:", err));

        const unsubNotifs = onSnapshot(notifsQ, (snap) => {
            setContextData(prev => ({ ...prev, notifications: snap.size }));
        }, (err) => console.error("Err fetching notifications context:", err));

        const unsubGroups = onSnapshot(groupsQ, (snap) => {
            const groups = snap.docs.map(d => d.data().name);
            setContextData(prev => ({ ...prev, groups }));
        }, (err) => console.error("Err fetching groups context:", err));

        return () => {
            unsubEvents();
            unsubPosts();
            unsubNotes();
            unsubNotifs();
            unsubGroups();
        };
    }, [user]);

    // Construct the final system string
    const contextString = `
[STATE_ISOLATION_NOTICE]
Only items under [USER_ACTIVE_VIEW] are currently on the user's screen.
Items under [CHURCH_REFERENCE_DATA] are just available info, the user is NOT looking at them.
[/STATE_ISOLATION_NOTICE]

[USER_ACTIVE_VIEW]
Bible Tabs: ${contextData.bible}
Current Time: ${new Date().toLocaleString()}
[/USER_ACTIVE_VIEW]

[CHURCH_REFERENCE_DATA]
UPCOMING EVENTS:
${contextData.events.length > 0 ? contextData.events.join('\n') : 'None.'}

RECENT POSTS:
${contextData.posts.length > 0 ? contextData.posts.join('\n') : 'None.'}

YOUR RECENT NOTES:
${contextData.notes.length > 0 ? contextData.notes.join('\n') : 'None.'}

USER GROUPS: ${contextData.groups.join(', ') || 'None.'}
UNREAD NOTIFICATIONS: ${contextData.notifications}
[/CHURCH_REFERENCE_DATA]

[INSTRUCTIONS]
You are Matthew, a church assistant. 
- Tone: Warm, helpful, concise.
- ACTIVE VIEW vs REFERENCE: Never say "I see you have X open" or "You are looking at Y" unless X or Y is in the [USER_ACTIVE_VIEW] section. Items in [CHURCH_REFERENCE_DATA] are just things you know about; do NOT claim the user is viewing them.
- Hallucination Rule: You do NOT see any flyers, images, or documents unless they are explicitly described in [USER_ACTIVE_VIEW].
- Relevance: If the user asks about a verse, focus on that verse. Do NOT pivot to an event just because that event mentions the verse, unless the user specifically asks for events.
- Greetings: Skip "Hello" on follow-ups. dive straight in.
- Tools: Use [ACTION:CREATE_NOTE | Title | Content] to trigger the note tool.
[/INSTRUCTIONS]
    `.trim();

    return { contextString, contextData };
}
