
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    increment,
    setDoc,
    deleteDoc,
    runTransaction,
    collectionGroup,
    startAfter,
    onSnapshot
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { Group, GroupType, GroupPrivacy, GroupMember, GroupRole, Post } from '@/types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const GROUPS_COLLECTION = 'groups';

export interface CreateGroupData {
    name: string;
    description: string;
    type: GroupType;
    privacy: GroupPrivacy;
    tags: string[];
    location?: string;
    createdBy: string;
}

export const GroupsService = {
    /**
     * Creates a new group.
     * Public groups are 'pending' approval. Private are 'active' immediately.
     */
    createGroup: async (data: CreateGroupData, bannerFile?: File, iconFile?: File) => {
        try {
            const status = data.privacy === 'public' ? 'pending' : 'active';

            // Sanitize data to remove undefined values
            const cleanData = Object.entries(data).reduce((acc, [key, value]) => ({
                ...acc,
                [key]: value === undefined ? null : value
            }), {} as CreateGroupData);

            // 1. Create the Group Document
            const groupRef = await addDoc(collection(db, GROUPS_COLLECTION), {
                ...cleanData,
                status,
                memberCount: 1, // Creator is first member
                lastActivityAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                bannerImage: null, // Placeholder
                icon: null // Placeholder
            });

            // 2. Upload Banner if exists
            let bannerUrl = null;
            if (bannerFile) {
                const storageRef = ref(storage, `groups/${groupRef.id}/banner_${Date.now()}`);
                await uploadBytes(storageRef, bannerFile);
                bannerUrl = await getDownloadURL(storageRef);
                await updateDoc(groupRef, { bannerImage: bannerUrl });
            }

            // 3. Upload Icon if exists
            if (iconFile) {
                const storageRef = ref(storage, `groups/${groupRef.id}/icon_${Date.now()}`);
                await uploadBytes(storageRef, iconFile);
                const iconUrl = await getDownloadURL(storageRef);
                await updateDoc(groupRef, { icon: iconUrl });
            }

            // 3. Add Creator as Admin Member
            const membersRef = collection(db, GROUPS_COLLECTION, groupRef.id, 'members');
            await setDoc(doc(membersRef, data.createdBy), {
                userId: data.createdBy,
                role: 'admin',
                status: 'active',
                joinedAt: serverTimestamp()
            });

            return { id: groupRef.id, status };
        } catch (error) {
            console.error('Error creating group:', error);
            throw error;
        }
    },

    /**
     * Gets a single group by ID
     */
    getGroup: async (groupId: string): Promise<Group | null> => {
        const docRef = doc(db, GROUPS_COLLECTION, groupId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() || {} } as Group;
        }
        return null;
    },

    /**
     * Get Public Groups (Active)
     */
    getPublicGroups: async (churchId?: string) => {
        let constraints: any[] = [
            where('privacy', '==', 'public'),
            where('status', '==', 'active'),
            orderBy('lastActivityAt', 'desc'),
            limit(20)
        ];

        if (churchId) {
            constraints.unshift(where('churchId', '==', churchId));
        }

        const q = query(collection(db, GROUPS_COLLECTION), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) } as Group));
    },

    /**
     * Get Pending Groups (For Admin)
     */
    getPendingGroups: async (churchId?: string) => {
        try {
            let constraints: any[] = [
                where('status', '==', 'pending'),
                orderBy('createdAt', 'desc')
            ];

            if (churchId) {
                constraints.unshift(where('churchId', '==', churchId));
            }

            const q = query(collection(db, GROUPS_COLLECTION), ...constraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) } as Group));
        } catch (error: any) {
            console.error("Error fetching pending groups (likely missing index):", error);
            // Fallback: Try without sorting if index is missing
            if (error.code === 'failed-precondition') {
                let constraints: any[] = [where('status', '==', 'pending')];
                if (churchId) constraints.unshift(where('churchId', '==', churchId));

                const q = query(collection(db, GROUPS_COLLECTION), ...constraints);
                const snapshot = await getDocs(q);
                // Sort manually in client
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) } as Group));
                return docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            }
            throw error;
        }
    },

    /**
     * Approve a Group (Admin)
     */
    approveGroup: async (groupId: string) => {
        const docRef = doc(db, GROUPS_COLLECTION, groupId);
        await updateDoc(docRef, { status: 'active' });
    },

    /**
     * Reject (Delete) a Pending Group
     */
    rejectGroup: async (groupId: string) => {
        const docRef = doc(db, GROUPS_COLLECTION, groupId);
        await deleteDoc(docRef);
    },

    /**
     * Get User's Groups
     */
    getUserGroups: async (userId: string) => {
        // collectionGroup query requires an index on 'members' collection 'userId' field
        const q = query(
            collectionGroup(db, 'members'),
            where('userId', '==', userId),
            where('status', '==', 'active')
        );
        const snapshot = await getDocs(q);

        // Get parent group refs
        const groupProms = snapshot.docs
            .map(d => d.ref.parent.parent)
            .filter(ref => ref?.type === 'document') // Ensure it's a doc ref
            .map(ref => getDoc(ref as any));

        const docs = await Promise.all(groupProms);

        return docs
            .filter(d => d.exists())
            .map(d => ({ id: d.id, ...(d.data() || {}) } as Group));
    },

    /**
     * Check if user is a member (and return member data if so)
     */
    getGroupMembership: async (groupId: string, userId: string) => {
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);
        const snapshot = await getDoc(memberRef);
        return snapshot.exists() ? snapshot.data() : null;
    },

    /**
     * Join a Public Group
     */
    joinGroup: async (groupId: string, userId: string) => {
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);

        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group does not exist");

            const memberDoc = await transaction.get(memberRef);
            if (memberDoc.exists()) throw new Error("Already a member");

            transaction.set(memberRef, {
                userId,
                role: 'member',
                status: 'active',
                joinedAt: serverTimestamp()
            });

            transaction.update(groupRef, {
                memberCount: increment(1)
            });
        });
    },

    /**
     * Leave a Group
     */
    leaveGroup: async (groupId: string, userId: string) => {
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);

        await runTransaction(db, async (transaction) => {
            const memberDoc = await transaction.get(memberRef);
            if (!memberDoc.exists()) throw new Error("Not a member");

            transaction.delete(memberRef);
            transaction.update(groupRef, {
                memberCount: increment(-1)
            });
        });
    },

    /**
     * Group Feed: Create Post
     */
    createGroupPost: async (groupId: string, data: any) => {
        const postsRef = collection(db, GROUPS_COLLECTION, groupId, 'posts');

        // Remove undefined values
        const cleanData = Object.entries(data).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: value === undefined ? null : value
        }), {});

        const postRef = await addDoc(postsRef, {
            ...cleanData,
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
            groupId, // explicit reference
            isPinned: false, // Required for sorting by isPinned
        });

        // Update lastActivityAt on group
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        await updateDoc(groupRef, { lastActivityAt: serverTimestamp() });

        // [NOTIFICATION LOGIC] - Scan for mentions and notify
        try {
            const content = data.content || '';
            const mentionRegex = /@(\w+)/g;
            const mentionedNames = new Set<string>();
            let match;
            while ((match = mentionRegex.exec(content)) !== null) {
                mentionedNames.add(match[1].toLowerCase());
            }

            if (mentionedNames.size > 0) {
                // Fetch group data for name
                const groupSnap = await getDoc(groupRef);
                const groupName = groupSnap.exists() ? groupSnap.data().name : 'Group';

                // Fetch all members to match names (this could be optimized with a query if we stored normalized usernames)
                // For now, fetching members is okay for smaller groups, but we should be careful with large groups.
                // Better approach: Query users collection by displayName? NO, we only want to notify MEMBERS.

                // Let's use the helper we already have: getGroupMembers (which hydrates user data)
                const members = await GroupsService.getGroupMembers(groupId);

                const notificationsBatch: Promise<any>[] = [];

                members.forEach(member => {
                    const memberName = member.user?.displayName?.toLowerCase();
                    // Don't notify the author
                    if (member.userId === (data.author.uid || data.author.id)) return;
                    // PostComposer passes: author: { name, avatarUrl } for group posts... 
                    // Actually checking PostComposer again... 
                    // It seems the `userId` isn't passed in `author` object for group posts in the code I just read?
                    // Let's check PostComposer Step 8094.
                    // Lines 65-68: author: { name, avatarUrl }... NO UID!
                    // This is a problem. We need the UID to know who sent it to avoid self-notification.
                    // But `createGroupPost` call in PostComposer doesn't pass UID. 
                    // However, we can probably assume the current auth user is the sender? 
                    // `GroupsService` is client-side, so `auth.currentUser` is available but `GroupsService` is just an object.
                    // Let's just default to checking if we can find the sender.

                    if (memberName && mentionedNames.has(memberName.split(' ')[0].toLowerCase())) { // Match first name for simplicity or full name? 
                        // The regex `@(\w+)` matches single word. So we match against first name or full name if no spaces.
                        notificationsBatch.push(
                            addDoc(collection(db, 'notifications'), {
                                type: 'mention',
                                fromUserId: data.author.uid || data.author.id || 'unknown', // Robust fallback
                                fromUser: {
                                    displayName: data.author.name,
                                    photoURL: data.author.avatarUrl
                                },
                                toUserId: member.userId,
                                postId: postRef.id,
                                groupId,
                                groupName,
                                content: content, // Save snippet of content
                                message: `${data.author.name} mentioned you in ${groupName}`, // Explicit message
                                createdAt: serverTimestamp(),
                                viewed: false,
                                read: false,
                                resourceTitle: groupName, // Reuse field for UI
                                // resourceId removed to prevent ActivityPanel from treating it as a shared resource
                            })
                        );
                    }
                });

                await Promise.all(notificationsBatch);
            }
        } catch (error) {
            console.error('Error sending mention notifications:', error);
            // Don't block the post creation if notifications fail
        }
    },

    /**
     * Group Feed: Get Posts
     */
    getGroupPosts: async (groupId: string, lastVisible: any = null) => {
        const postsRef = collection(db, GROUPS_COLLECTION, groupId, 'posts');
        let q = query(
            postsRef,
            orderBy('isPinned', 'desc'), // Pinned first
            orderBy('timestamp', 'desc'),
            limit(10)
        );

        if (lastVisible) {
            q = query(
                postsRef,
                orderBy('isPinned', 'desc'),
                orderBy('timestamp', 'desc'),
                startAfter(lastVisible),
                limit(10)
            );
        }

        const snapshot = await getDocs(q);
        console.log('GroupsService: getGroupPosts snapshot', {
            size: snapshot.size,
            empty: snapshot.empty,
            docs: snapshot.docs.map(d => ({ id: d.id, isPinned: d.data().isPinned }))
        });
        return {
            posts: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)),
            lastVisible: snapshot.docs[snapshot.docs.length - 1]
        };
    },

    /**
     * Members: Get All Members (with user data)
     */
    getGroupMembers: async (groupId: string) => {
        const membersRef = collection(db, GROUPS_COLLECTION, groupId, 'members');
        const q = query(membersRef, where('status', '==', 'active')); // Only active members
        const snapshot = await getDocs(q);
        const members = snapshot.docs.map(doc => ({ ...doc.data() } as GroupMember));

        // Hydrate with user profile data
        const membersWithUserData = await Promise.all(members.map(async (member) => {
            try {
                const userDoc = await getDoc(doc(db, 'users', member.userId));
                if (userDoc.exists()) {
                    return {
                        ...member,
                        user: {
                            displayName: userDoc.data().displayName || 'Unknown',
                            photoURL: userDoc.data().photoURL
                        }
                    };
                }
            } catch (e) {
                console.error('Error fetching user for member', member.userId, e);
            }
            return member;
        }));

        return membersWithUserData;
    },

    /**
     * Members: Update Role (Admin only)
     */
    updateMemberRole: async (groupId: string, userId: string, role: GroupRole) => {
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);
        await updateDoc(memberRef, { role });
    },

    /**
     * Members: Remove Member (Kick/Ban)
     */
    removeMember: async (groupId: string, userId: string) => {
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);

        await runTransaction(db, async (transaction) => {
            const memberDoc = await transaction.get(memberRef);
            if (!memberDoc.exists()) throw new Error("Member not found");

            transaction.delete(memberRef);
            transaction.update(groupRef, {
                memberCount: increment(-1)
            });
        });
    },
    /**
     * Settings: Update Group Data
     */
    updateGroup: async (groupId: string, data: Partial<Group>) => {
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        // Clean undefined values
        const cleanData = Object.entries(data).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: value === undefined ? null : value
        }), {} as any);

        await updateDoc(groupRef, cleanData);

        // If updating banner, delete old one? (TODO: Optimization)
    },

    deleteGroup: async (groupId: string) => {
        // This is a complex operation requiring recursive delete of subcollections (posts, members)
        // For now, we'll simple mark as deleted or rely on cloud functions
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        await deleteDoc(groupRef);
    },

    uploadGroupBanner: async (groupId: string, file: File) => {
        const storageRef = ref(storage, `groups/${groupId}/banner_${Date.now()}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    uploadGroupIcon: async (groupId: string, file: File) => {
        const storageRef = ref(storage, `groups/${groupId}/icon_${Date.now()}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    /**
     * Events: Create Event
     */
    createGroupEvent: async (groupId: string, data: any) => {
        const eventsRef = collection(db, GROUPS_COLLECTION, groupId, 'events');
        await addDoc(eventsRef, {
            ...data,
            createdAt: serverTimestamp()
        });
    },

    /**
     * Events: Get Events
     */
    getGroupEvents: async (groupId: string) => {
        const eventsRef = collection(db, GROUPS_COLLECTION, groupId, 'events');
        const q = query(
            eventsRef,
            orderBy('startDate', 'asc') // Upcoming first
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    inviteMember: async (groupId: string, userId: string, invitedBy?: { uid: string, displayName: string, photoURL?: string | null }, groupName?: string) => {
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);

        // Check if already a member
        const memberDoc = await getDoc(memberRef);
        if (memberDoc.exists()) {
            const data = memberDoc.data();
            if (data.status === 'active') throw new Error('User is already a member');
            if (data.status === 'invited') throw new Error('User is already invited');
        }

        await setDoc(memberRef, {
            userId,
            groupId, // Added for easier querying
            role: 'member',
            status: 'invited',
            invitedAt: serverTimestamp()
        });

        // Create Invitation Document for Activity Feed
        if (invitedBy) {
            await addDoc(collection(db, 'invitations'), {
                type: 'group_invite',
                groupId,
                groupName: groupName || 'Group',
                fromUser: invitedBy,
                toUserId: userId,
                createdAt: serverTimestamp(),
                invitedBy: invitedBy.uid, // Required by security rules
                status: 'pending'
            });
        }
    },

    /**
     * Get User's Pending Invites
     */
    getUserInvites: async (userId: string) => {
        const q = query(
            collectionGroup(db, 'members'),
            where('userId', '==', userId),
            where('status', '==', 'invited')
        );
        const snapshot = await getDocs(q);

        const groupProms = snapshot.docs
            .map(d => d.ref.parent.parent)
            .filter(ref => ref?.type === 'document')
            .map(ref => getDoc(ref as any));

        const docs = await Promise.all(groupProms);

        return docs
            .filter(d => d.exists())
            .map(d => ({ id: d.id, ...(d.data() || {}) } as Group));
    },

    /**
     * Respond to an Invite (Accept/Decline)
     */
    respondToInvite: async (groupId: string, userId: string, accept: boolean) => {
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);

        await runTransaction(db, async (transaction) => {
            const memberDoc = await transaction.get(memberRef);
            if (!memberDoc.exists()) throw new Error("Invite not found");
            if (memberDoc.data().status !== 'invited') throw new Error("Invite no longer valid");

            if (accept) {
                transaction.update(memberRef, {
                    status: 'active',
                    joinedAt: serverTimestamp()
                });
                transaction.update(groupRef, {
                    memberCount: increment(1)
                });
            } else {
                transaction.delete(memberRef);
            }
        });
    },

    /**
     * Add Member Directly (for ministry integration)
     * Adds a user to a group immediately with 'active' status
     * Used when adding members to ministries with linked groups
     */
    addMemberDirectly: async (
        groupId: string,
        userId: string,
        role: GroupRole = 'member'
    ): Promise<void> => {
        const groupRef = doc(db, GROUPS_COLLECTION, groupId);
        const memberRef = doc(db, GROUPS_COLLECTION, groupId, 'members', userId);

        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group does not exist");

            const memberDoc = await transaction.get(memberRef);
            if (memberDoc.exists()) {
                // Already a member, just update status to active if needed
                const data = memberDoc.data();
                if (data.status !== 'active') {
                    transaction.update(memberRef, {
                        status: 'active',
                        role,
                        joinedAt: serverTimestamp()
                    });
                    transaction.update(groupRef, {
                        memberCount: increment(1)
                    });
                }
                return; // Already active member, no action needed
            }

            // Add new member
            transaction.set(memberRef, {
                userId,
                groupId,
                role,
                status: 'active',
                joinedAt: serverTimestamp()
            });

            transaction.update(groupRef, {
                memberCount: increment(1)
            });
        });
    },

    /**
     * Get Ministry Groups for a User
     * Returns groups that are linked to ministries the user belongs to (as member OR leader)
     */
    getMinistryGroups: async (userId: string): Promise<Group[]> => {
        try {
            const ministryIds = new Set<string>();

            // 1. Get user's ministry memberships
            const membershipQuery = query(
                collection(db, 'ministryMembers'),
                where('userId', '==', userId),
                where('status', '==', 'active')
            );
            const membershipsSnapshot = await getDocs(membershipQuery);
            membershipsSnapshot.docs.forEach(d => ministryIds.add(d.data().ministryId));

            // 2. Get ministries where user is leader (may not be in ministryMembers)
            const leaderQuery = query(
                collection(db, 'ministries'),
                where('leaderId', '==', userId)
            );
            const leaderSnapshot = await getDocs(leaderQuery);
            leaderSnapshot.docs.forEach(d => ministryIds.add(d.id));

            if (ministryIds.size === 0) {
                return [];
            }

            // 3. Get ministries with linked groups
            const groups: Group[] = [];
            const seenGroupIds = new Set<string>();

            for (const ministryId of ministryIds) {
                try {
                    const ministryDoc = await getDoc(doc(db, 'ministries', ministryId));
                    if (ministryDoc.exists()) {
                        const ministry = ministryDoc.data();
                        if (ministry.linkedGroupId && !seenGroupIds.has(ministry.linkedGroupId)) {
                            seenGroupIds.add(ministry.linkedGroupId);
                            const groupDoc = await getDoc(doc(db, 'groups', ministry.linkedGroupId));
                            if (groupDoc.exists()) {
                                const groupData = groupDoc.data();
                                groups.push({
                                    ...groupData,
                                    id: groupDoc.id,
                                } as Group);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching ministry ${ministryId}:`, error);
                }
            }

            return groups;
        } catch (error) {
            console.error('Error fetching ministry groups:', error);
            return [];
        }
    },

    /**
     * Auto-join a group if the user is a member of the ministry linked to this group.
     * This handles the case where ministry members were added before the auto-join feature.
     * Returns true if the user was auto-joined, false otherwise.
     */
    autoJoinIfMinistryMember: async (groupId: string, userId: string): Promise<boolean> => {
        try {
            // First, find the ministry that has this group as its linkedGroupId
            const ministryQuery = query(
                collection(db, 'ministries'),
                where('linkedGroupId', '==', groupId)
            );
            const ministrySnapshot = await getDocs(ministryQuery);

            if (ministrySnapshot.empty) {
                // No ministry linked to this group
                return false;
            }

            const ministry = ministrySnapshot.docs[0];
            const ministryId = ministry.id;
            const ministryData = ministry.data();

            // Check if user is the ministry leader
            if (ministryData.leaderId === userId) {
                // Auto-add the leader to the group
                await GroupsService.addMemberDirectly(groupId, userId, 'admin');
                return true;
            }

            // Check if user is a member of this ministry
            const memberQuery = query(
                collection(db, 'ministryMembers'),
                where('ministryId', '==', ministryId),
                where('userId', '==', userId),
                where('status', '==', 'active')
            );
            const memberSnapshot = await getDocs(memberQuery);

            if (!memberSnapshot.empty) {
                // User is a ministry member, auto-add them to the group
                await GroupsService.addMemberDirectly(groupId, userId, 'member');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error in autoJoinIfMinistryMember:', error);
            return false;
        }
    },

    /**
     * Sync ALL ministry members to the linked group.
     * This ensures the group member list matches the ministry member list.
     * Returns the number of members synced.
     */
    syncMinistryMembersToGroup: async (groupId: string): Promise<number> => {
        try {
            // Find the ministry linked to this group
            const ministryQuery = query(
                collection(db, 'ministries'),
                where('linkedGroupId', '==', groupId)
            );
            const ministrySnapshot = await getDocs(ministryQuery);

            if (ministrySnapshot.empty) {
                return 0;
            }

            const ministry = ministrySnapshot.docs[0];
            const ministryId = ministry.id;
            const ministryData = ministry.data();
            let syncedCount = 0;

            // Add the ministry leader as admin (if exists)
            if (ministryData.leaderId) {
                try {
                    await GroupsService.addMemberDirectly(groupId, ministryData.leaderId, 'admin');
                    syncedCount++;
                } catch {
                    // Already a member, that's fine
                }
            }

            // Get all active ministry members
            const membersQuery = query(
                collection(db, 'ministryMembers'),
                where('ministryId', '==', ministryId),
                where('status', '==', 'active')
            );
            const membersSnapshot = await getDocs(membersQuery);

            // Add each ministry member to the group
            for (const memberDoc of membersSnapshot.docs) {
                const memberData = memberDoc.data();
                try {
                    const role = memberData.role === 'Leader' ? 'admin' : 'member';
                    await GroupsService.addMemberDirectly(groupId, memberData.userId, role as any);
                    syncedCount++;
                } catch {
                    // Already a member, that's fine
                }
            }

            return syncedCount;
        } catch (error) {
            console.error('Error syncing ministry members to group:', error);
            return 0;
        }
    }
};
