'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { GroupsService } from '@/lib/groups';
import { Group } from '@/types';
import { Loader2, Plus, Users, Search, Globe, Lock } from 'lucide-react';
import CreateGroupModal from '@/components/Groups/CreateGroupModal';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default function GroupsPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [publicGroups, setPublicGroups] = useState<Group[]>([]);
    const [activeTab, setActiveTab] = useState<'my_groups' | 'discover'>('my_groups');
    const [invites, setInvites] = useState<Group[]>([]);
    const [processingInvite, setProcessingInvite] = useState<string | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        const fetchGroups = async () => {
            if (!user) return;
            setLoading(true);
            setInviteError(null);

            try {
                // Fetch groups first (Critical path)
                const [userGrps, pubGrps] = await Promise.all([
                    GroupsService.getUserGroups(user.uid),
                    GroupsService.getPublicGroups()
                ]);
                setMyGroups(userGrps);
                setPublicGroups(pubGrps);
            } catch (error) {
                console.error('Failed to fetch groups', error);
            } finally {
                setLoading(false);
            }

            // Fetch invites separately (Non-critical path, likely to fail on first run due to index)
            try {
                const userInvites = await GroupsService.getUserInvites(user.uid);
                setInvites(userInvites);
            } catch (error: any) {
                console.error('Failed to fetch invites', error);
                // Capture ALL errors for debugging
                if (error?.message?.includes('index')) {
                    const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                    const url = match ? match[0] : null;
                    setInviteError(url || 'Missing Index');
                } else {
                    setInviteError(error?.message || 'Unknown Error Fetching Invites');
                }
            }
        };

        fetchGroups();
    }, [user, activeTab]);

    const handleRespondToInvite = async (groupId: string, accept: boolean) => {
        if (!user) return;
        setProcessingInvite(groupId);
        try {
            await GroupsService.respondToInvite(groupId, user.uid, accept);
            // Optimistic update
            setInvites(prev => prev.filter(g => g.id !== groupId));
            if (accept) {
                // Determine group to move to 'myGroups'
                const acceptedGroup = invites.find(g => g.id === groupId);
                if (acceptedGroup) {
                    setMyGroups(prev => [acceptedGroup, ...prev]);
                }
            }
        } catch (error) {
            console.error('Failed to respond to invite', error);
            alert('Failed to process invite. Please try again.');
        } finally {
            setProcessingInvite(null);
        }
    };

    // Group Card Component
    const GroupCard = ({ group }: { group: Group }) => (
        <Link href={`/groups/${group.id}`} className="block group">
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-lg transition-all hover:border-blue-200 dark:hover:border-blue-900/30 h-full flex flex-col">
                {/* Banner / Cover */}
                <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 relative">
                    {group.bannerImage ? (
                        <img
                            src={group.bannerImage}
                            alt={group.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-blue-200 dark:text-blue-800/30">
                            <Users className="w-12 h-12" />
                        </div>
                    )}
                    <div className="absolute top-3 right-3">
                        {group.privacy === 'public' ?
                            <span className="bg-white/90 dark:bg-black/50 backdrop-blur text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium text-gray-600 dark:text-gray-300">
                                <Globe className="w-3 h-3" /> Public
                            </span>
                            :
                            <span className="bg-white/90 dark:bg-black/50 backdrop-blur text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium text-gray-600 dark:text-gray-300">
                                <Lock className="w-3 h-3" /> Private
                            </span>
                        }
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col">
                    <div className="mb-4 flex-1">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 transition-colors">
                            {group.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                            {group.description}
                        </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-50 dark:border-zinc-800 pt-4">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" /> {group.memberCount} members
                            </span>
                        </div>
                        {group.lastActivityAt && (
                            <span>
                                Active {formatDistanceToNow(group.lastActivityAt.toDate(), { addSuffix: true })}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Groups</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Connect with others in ministry and fellowship.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" /> Create Group
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-zinc-800 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('my_groups')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'my_groups'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    My Groups
                </button>
                <button
                    onClick={() => setActiveTab('discover')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'discover'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Discover
                </button>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <>
                    {activeTab === 'my_groups' && (
                        <div className="space-y-8">
                            {/* Invite Error (Missing Index) */}
                            {inviteError && (
                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-6">
                                    <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-2">
                                        Action Required: Enable Invites
                                    </h3>
                                    <p className="text-amber-700 dark:text-amber-300 text-sm mb-4">
                                        To see your invitations, you need to create a database index in Firebase. This is a one-time setup.
                                    </p>
                                    {inviteError !== 'Missing Index' ? (
                                        <a
                                            href={inviteError}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Create Index &rarr;
                                        </a>
                                    ) : (
                                        <p className="text-sm font-mono bg-black/5 p-2 rounded">
                                            Please check the browser console (F12) for the creation link.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Pending Invitations Section */}
                            {invites.length > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-6">
                                    <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        Pending Invitations
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {invites.map(group => (
                                            <div key={group.id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 shadow-sm flex flex-col">
                                                <div className="flex items-center gap-3 mb-3">
                                                    {group.icon ? (
                                                        <img src={group.icon} className="w-10 h-10 rounded-lg object-cover bg-gray-100" alt="" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                                            <Users className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">{group.name}</h4>
                                                        <p className="text-xs text-gray-500">{group.memberCount} members</p>
                                                    </div>
                                                </div>
                                                <div className="mt-auto flex items-center gap-2 pt-2">
                                                    <button
                                                        onClick={() => handleRespondToInvite(group.id, true)}
                                                        disabled={processingInvite === group.id}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {processingInvite === group.id ? 'Accepting...' : 'Accept'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespondToInvite(group.id, false)}
                                                        disabled={processingInvite === group.id}
                                                        className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* My Groups List */}
                            {myGroups.length === 0 ? (
                                <div className="text-center py-20 bg-gray-50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-700">
                                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Users className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                                        You haven't joined any groups yet
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm max-w-sm mx-auto">
                                        Join a group to connect with others, or create your own community space.
                                    </p>
                                    <button
                                        onClick={() => setActiveTab('discover')}
                                        className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-sm"
                                    >
                                        Browse public groups &rarr;
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Your Groups</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {myGroups.map(group => (
                                            <GroupCard key={group.id} group={group} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'discover' && (
                        <div>
                            {publicGroups.length === 0 ? (
                                <div className="text-center py-20">
                                    <p className="text-gray-500">No public groups found.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {publicGroups.map(group => (
                                        <GroupCard key={group.id} group={group} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}



            <CreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
}
