'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Ministry } from '@/types';
import { X, Search, UserPlus, Loader2, Users, Check } from 'lucide-react';
import { toast } from 'sonner';
import { UsersService, UserProfile } from '@/lib/users';
import { useAuth } from '@/context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GroupsService } from '@/lib/groups';

interface AddMinistryMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    ministry: Ministry;
    existingMemberIds: string[];
    onMemberAdded?: () => void;
}

export function AddMinistryMembersModal({
    isOpen,
    onClose,
    ministry,
    existingMemberIds,
    onMemberAdded
}: AddMinistryMembersModalProps) {
    const { userData } = useAuth();

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [addingUsers, setAddingUsers] = useState<Set<string>>(new Set());
    const [addedUsers, setAddedUsers] = useState<Set<string>>(new Set());

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setAddedUsers(new Set());
        }
    }, [isOpen]);

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2 && userData?.churchId) {
                setIsSearching(true);
                try {
                    // Search users in the same church
                    const results = await UsersService.searchUsers(searchQuery);
                    // Filter out existing members and users from other churches
                    const filtered = results.filter(user =>
                        !existingMemberIds.includes(user.uid) &&
                        !addedUsers.has(user.uid) &&
                        user.churchId === userData.churchId
                    );
                    setSearchResults(filtered);
                } catch (error) {
                    console.error("Search failed", error);
                    toast.error('Failed to search members');
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, existingMemberIds, addedUsers, userData?.churchId]);

    const handleAddMember = async (user: UserProfile) => {
        if (!ministry.id) return;

        setAddingUsers(prev => new Set(prev).add(user.uid));
        try {
            // Add to ministryMembers collection
            await addDoc(collection(db, 'ministryMembers'), {
                ministryId: ministry.id,
                userId: user.uid,
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL || null,
                role: 'Member',
                status: 'active',
                joinedAt: serverTimestamp(),
                addedBy: userData?.uid || null,
                addedByName: userData?.displayName || 'Unknown'
            });

            // Also add to the ministry's linked group (for Team Chat access)
            if (ministry.linkedGroupId) {
                try {
                    await GroupsService.addMemberDirectly(ministry.linkedGroupId, user.uid, 'member');
                } catch (groupError) {
                    // Don't fail the whole operation if group add fails
                    console.error('Failed to add to linked group:', groupError);
                }
            }

            // Mark as added
            setAddedUsers(prev => new Set(prev).add(user.uid));
            // Remove from search results
            setSearchResults(prev => prev.filter(u => u.uid !== user.uid));

            toast.success(`Added ${user.displayName} to ${ministry.name}`);

            // Notify parent to refresh
            onMemberAdded?.();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to add member');
        } finally {
            setAddingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(user.uid);
                return newSet;
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                        <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${ministry.color}15` }}
                        >
                            <Users className="w-5 h-5" style={{ color: ministry.color }} />
                        </div>
                        Add Members to {ministry.name}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 min-h-[300px]">
                    <div className="space-y-4">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search church members by name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        {/* Results */}
                        <div className="mt-4">
                            {isSearching ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                            ) : searchQuery.length < 2 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Search className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-zinc-700" />
                                    <p>Type at least 2 characters to search</p>
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-zinc-700" />
                                    <p>No members found matching "{searchQuery}"</p>
                                    <p className="text-sm mt-1">They may already be in this ministry</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                    {searchResults.map(user => (
                                        <div
                                            key={user.uid}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                                                    style={{ backgroundColor: `${ministry.color}20` }}
                                                >
                                                    {user.photoURL ? (
                                                        <img
                                                            src={user.photoURL}
                                                            alt={user.displayName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span
                                                            className="font-medium text-sm"
                                                            style={{ color: ministry.color }}
                                                        >
                                                            {user.displayName.substring(0, 2).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h5 className="font-medium text-gray-900 dark:text-white">
                                                        {user.displayName}
                                                    </h5>
                                                    {user.email && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {user.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleAddMember(user)}
                                                disabled={addingUsers.has(user.uid)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {addingUsers.has(user.uid) ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <UserPlus className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recently Added */}
                        {addedUsers.size > 0 && (
                            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    Added {addedUsers.size} member{addedUsers.size > 1 ? 's' : ''} to {ministry.name}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 text-center">
                    <button
                        onClick={onClose}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
