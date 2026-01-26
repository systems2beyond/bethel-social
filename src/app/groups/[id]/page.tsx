'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GroupsService } from '@/lib/groups';
import { GroupFeed } from '@/components/Groups/GroupFeed';
import { GroupMembersList } from '@/components/Groups/GroupMembersList';
import { GroupSettings } from '@/components/Groups/GroupSettings';
import { GroupEventsTab } from '@/components/Groups/GroupEventsTab';
import { Group, GroupMember } from '@/types';
import { Loader2, Users, MapPin, Globe, Lock, Shield, Settings, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { InviteMembersModal } from '@/components/Groups/InviteMembersModal';

export default function GroupDetailsPage() {
    const { id } = useParams() as { id: string };
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [group, setGroup] = useState<Group | null>(null);
    const [membership, setMembership] = useState<GroupMember | any | null>(null);
    const [activeTab, setActiveTab] = useState<'feed' | 'about' | 'members' | 'settings' | 'events'>('feed');
    const [actionLoading, setActionLoading] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    useEffect(() => {
        if (authLoading || !id) return;

        const fetchGroupData = async () => {
            setLoading(true);
            try {
                // Fetch group regardless of auth
                const groupData = await GroupsService.getGroup(id);

                if (!groupData) {
                    toast.error('Group not found');
                    return router.push('/groups');
                }

                setGroup(groupData);

                // Only fetch membership if logged in
                if (user) {
                    const memberData = await GroupsService.getGroupMembership(id, user.uid);
                    setMembership(memberData);
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to load group');
            } finally {
                setLoading(false);
            }
        };
        fetchGroupData();
    }, [id, user, authLoading, router]);

    const handleJoin = async () => {
        if (!user || !group) return;
        setActionLoading(true);
        try {
            await GroupsService.joinGroup(group.id, user.uid);
            toast.success('Joined group!');
            // Refresh membership
            const memberData = await GroupsService.getGroupMembership(group.id, user.uid);
            setMembership(memberData);
            // Increment local member count
            setGroup(prev => prev ? ({ ...prev, memberCount: (prev.memberCount || 0) + 1 }) : null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to join group');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeave = async () => {
        if (!user || !group) return;
        if (!confirm('Are you sure you want to leave this group?')) return;

        setActionLoading(true);
        try {
            await GroupsService.leaveGroup(group.id, user.uid);
            toast.success('Left group');
            setMembership(null);
            setGroup(prev => prev ? ({ ...prev, memberCount: (prev.memberCount || 0) - 1 }) : null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to leave group');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRespondToInvite = async (accept: boolean) => {
        if (!user || !group) return;
        setActionLoading(true);
        try {
            await GroupsService.respondToInvite(group.id, user.uid, accept);
            toast.success(accept ? 'Welcome to the group!' : 'Invite declined');

            if (accept) {
                // Refresh membership to show Active status
                const memberData = await GroupsService.getGroupMembership(group.id, user.uid);
                setMembership(memberData);
                // Increment member count
                setGroup(prev => prev ? ({ ...prev, memberCount: (prev.memberCount || 0) + 1 }) : null);
            } else {
                setMembership(null); // Clear invited status
            }
        } catch (error) {
            console.error('Failed to respond to invite', error);
            toast.error('Failed to process invite');
        } finally {
            setActionLoading(false);
        }
    };


    if (loading) {
        return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" /></div>;
    }

    if (!group) return null;

    // Privacy Check
    const isMember = !!membership;
    const isPrivate = group.privacy === 'private';
    const canView = !isPrivate || isMember;

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Cover Image */}
            <div className="h-48 md:h-64 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 relative">
                {group.bannerImage && (
                    <img
                        src={group.bannerImage}
                        alt={group.name}
                        className="w-full h-full object-cover"
                    />
                )}
            </div>

            {/* Header Content */}
            <div className="px-4 md:px-8">
                <div className="relative -mt-12 mb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                    <div className=" bg-white dark:bg-zinc-900 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 overflow-hidden">
                            {group.icon ? (
                                <img
                                    src={group.icon}
                                    alt={group.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Users className="w-10 h-10" />
                            )}
                        </div>
                    </div>

                    <div className="flex-1 pb-2">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{group.name}</h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            {group.privacy === 'public' ? (
                                <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> Public Group</span>
                            ) : (
                                <span className="flex items-center gap-1"><Lock className="w-4 h-4" /> Private Group</span>
                            )}
                            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {group.memberCount} members</span>
                            {group.location && (
                                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {group.location}</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pb-2">
                        {membership?.status === 'invited' ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleRespondToInvite(true)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon />}
                                    Accept Invite
                                </button>
                                <button
                                    onClick={() => handleRespondToInvite(false)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Decline
                                </button>
                            </div>
                        ) : isMember ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsInviteModalOpen(true)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Invite
                                </button>
                                <button
                                    onClick={handleLeave}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm"
                                >
                                    {membership.role === 'admin' ? 'Leave (Admin)' : 'Leave Group'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleJoin}
                                disabled={actionLoading}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircleIcon />}
                                Join Group
                            </button>
                        )}
                    </div>
                </div>

                {/* Navigation Tabs */}
                {canView && (
                    <div className="flex items-center border-b border-gray-100 dark:border-zinc-800 mb-6 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('feed')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'feed'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Discussion
                        </button>
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'about'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            About
                        </button>
                        <button
                            onClick={() => setActiveTab('members')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'members'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Members
                        </button>
                        <button
                            onClick={() => setActiveTab('events')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'events'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            Events
                        </button>
                        {membership?.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'settings'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                Settings
                            </button>
                        )}
                    </div>
                )}

                {/* Tab Content */}
                <div className="min-h-[400px]">
                    {!canView ? (
                        <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 rounded-2xl p-12 text-center">
                            <div className="w-16 h-16 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-8 h-8 text-gray-400" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">This Group is Private</h2>
                            <p className="text-gray-500">Join this group to view its posts and members.</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'feed' && (
                                <React.Suspense fallback={<div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>}>
                                    <GroupFeed groupId={group.id} membership={membership} />
                                </React.Suspense>
                            )}

                            {activeTab === 'about' && (
                                <div className="prose dark:prose-invert max-w-none">
                                    <h3 className="text-lg font-semibold mb-2">About this Group</h3>
                                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {group.description || "No description provided."}
                                    </p>

                                    {group.tags && group.tags.length > 0 && (
                                        <div className="mt-6">
                                            <h4 className="text-sm font-semibold mb-2 text-gray-500 uppercase tracking-wider">Tags</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {group.tags.map(tag => (
                                                    <span key={tag} className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full text-sm">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'members' && (
                                <GroupMembersList groupId={group.id} currentUserRole={membership?.role || null} />
                            )}

                            {activeTab === 'events' && (
                                <GroupEventsTab
                                    group={group}
                                    isAdmin={membership?.role === 'admin'}
                                />
                            )}

                            {activeTab === 'settings' && (
                                <GroupSettings
                                    group={group}
                                    onUpdate={setGroup}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
            {group && (
                <InviteMembersModal
                    isOpen={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    group={group}
                />
            )}
        </div>
    );
}

// The original TabButton component is no longer used due to the new tab structure.
// Keeping it here for reference if needed, but it's effectively replaced by the inline buttons.
function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${active
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
        >
            {label}
        </button>
    );
}

// Icon helper
function PlusCircleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
        </svg>
    )
}

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}
