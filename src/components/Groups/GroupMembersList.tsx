'use client';

import React, { useEffect, useState } from 'react';
import { GroupMember, GroupRole } from '@/types';
import { GroupsService } from '@/lib/groups';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Shield, UserX, MoreVertical, Check, User } from 'lucide-react';
import { toast } from 'sonner';

interface GroupMembersListProps {
    groupId: string;
    currentUserRole: GroupRole | null;
}

export function GroupMembersList({ groupId, currentUserRole }: GroupMembersListProps) {
    const { user } = useAuth();
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null); // userId of open menu

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const data = await GroupsService.getGroupMembers(groupId);
            setMembers(data);
        } catch (error) {
            console.error('Error fetching members:', error);
            toast.error('Failed to load members');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, [groupId]);

    const handleUpdateRole = async (memberId: string, newRole: GroupRole) => {
        try {
            await GroupsService.updateMemberRole(groupId, memberId, newRole);
            setMembers(prev => prev.map(m =>
                m.userId === memberId ? { ...m, role: newRole } : m
            ));
            toast.success(`Role updated to ${newRole}`);
            setActionMenuOpen(null);
        } catch (error) {
            console.error('Error updating role:', error);
            toast.error('Failed to update role');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            await GroupsService.removeMember(groupId, memberId);
            setMembers(prev => prev.filter(m => m.userId !== memberId));
            toast.success('Member removed');
            setActionMenuOpen(null);
        } catch (error) {
            console.error('Error removing member:', error);
            toast.error('Failed to remove member');
        }
    };

    const filteredMembers = members.filter(m =>
        (m.user?.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isAdmin = currentUserRole === 'admin';

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />

            {/* List */}
            <div className="space-y-2">
                {filteredMembers.map(member => (
                    <div key={member.userId} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                                {member.user?.photoURL ? (
                                    <img src={member.user.photoURL} alt={member.user.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        <span className="text-xl">{member.user?.displayName?.[0] || '?'}</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white">
                                    {member.user?.displayName || 'Unknown User'}
                                </h3>
                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                    <span className="capitalize">{member.role}</span>
                                    {member.role === 'admin' && <Shield className="w-3 h-3 text-blue-500" />}
                                </div>
                            </div>
                        </div>

                        {/* Actions (Only for Admins, excluding self) */}
                        {isAdmin && member.userId !== user?.uid && (
                            <div className="relative">
                                <button
                                    onClick={() => setActionMenuOpen(actionMenuOpen === member.userId ? null : member.userId)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
                                >
                                    <MoreVertical className="w-4 h-4 text-gray-500" />
                                </button>

                                {actionMenuOpen === member.userId && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-100 dark:border-zinc-800 z-10 overflow-hidden">
                                        {member.role !== 'admin' && (
                                            <button
                                                onClick={() => handleUpdateRole(member.userId, 'admin')}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center space-x-2"
                                            >
                                                <Shield className="w-3 h-3" />
                                                <span>Make Admin</span>
                                            </button>
                                        )}
                                        {member.role !== 'moderator' && (
                                            <button
                                                onClick={() => handleUpdateRole(member.userId, 'moderator')}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center space-x-2"
                                            >
                                                <Shield className="w-3 h-3" />
                                                <span>Make Moderator</span>
                                            </button>
                                        )}
                                        {member.role !== 'member' && (
                                            <button
                                                onClick={() => handleUpdateRole(member.userId, 'member')}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center space-x-2"
                                            >
                                                <User className="w-3 h-3" />
                                                <span>Demote to Member</span>
                                            </button>
                                        )}
                                        <div className="border-t border-gray-100 dark:border-zinc-800 my-1"></div>
                                        <button
                                            onClick={() => handleRemoveMember(member.userId)}
                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                                        >
                                            <UserX className="w-3 h-3" />
                                            <span>Remove from Group</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Background Click to Close Menu */}
                        {actionMenuOpen && (
                            <div
                                className="fixed inset-0 z-0 bg-transparent"
                                onClick={() => setActionMenuOpen(null)}
                            ></div>
                        )}
                    </div>
                ))}

                {filteredMembers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No members found.
                    </div>
                )}
            </div>
        </div>
    );
}
