
import React, { useState, useEffect } from 'react';
import { Group } from '@/types';
import { X, Copy, Check, Link as LinkIcon, Users, Search, UserPlus, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { UsersService, UserProfile } from '@/lib/users';
import { GroupsService } from '@/lib/groups';
import { useAuth } from '@/context/AuthContext';

interface InviteMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: Group;
}

export function InviteMembersModal({ isOpen, onClose, group }: InviteMembersModalProps) {
    const [activeTab, setActiveTab] = useState<'link' | 'invite'>('invite');
    const [copied, setCopied] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [invitingUsers, setInvitingUsers] = useState<Set<string>>(new Set());

    // Construct the invite link 
    const inviteLink = typeof window !== 'undefined' ?
        `${window.location.origin}/groups/${group.id}` :
        '';

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setIsSearching(true);
                try {
                    const results = await UsersService.searchUsers(searchQuery);
                    setSearchResults(results);
                } catch (error) {
                    console.error("Search failed", error);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            toast.success('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    const { user: currentUser } = useAuth();

    // ...

    const handleInvite = async (user: UserProfile) => {
        setInvitingUsers(prev => new Set(prev).add(user.uid));
        try {
            await GroupsService.inviteMember(
                group.id,
                user.uid,
                currentUser ? {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || 'Someone',
                    photoURL: currentUser.photoURL
                } : undefined,
                group.name
            );
            toast.success(`Invited ${user.displayName}!`);
            // Optionally remove from list or mark as invited
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to invite user');
        } finally {
            setInvitingUsers(prev => {
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
                        <Users className="w-5 h-5 text-blue-500" />
                        Invite People
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('invite')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'invite'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        Direct Invite
                    </button>
                    <button
                        onClick={() => setActiveTab('link')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'link'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                    >
                        Copy Link
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 min-h-[300px]">
                    {activeTab === 'link' ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                    {group.icon ? (
                                        <img src={group.icon} alt={group.name} className="w-full h-full object-cover rounded-2xl" />
                                    ) : (
                                        <Users className="w-8 h-8 text-blue-500" />
                                    )}
                                </div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                                    Invite to {group.name}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Share this link with anyone you want to join this group.
                                </p>
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                    Group Link
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                            <LinkIcon className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="text"
                                            readOnly
                                            value={inviteLink}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-gray-600 dark:text-gray-300 text-sm focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 min-w-[100px] justify-center ${copied
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                                            }`}
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20"
                                    autoFocus
                                />
                            </div>

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
                                    <div className="text-center py-12 text-gray-500">
                                        <p>No users found matching "{searchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                        {searchResults.map(user => (
                                            <div key={user.uid} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 overflow-hidden">
                                                        {user.photoURL ? (
                                                            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="font-medium text-sm">
                                                                {user.displayName.substring(0, 2).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h5 className="font-medium text-gray-900 dark:text-white">
                                                            {user.displayName}
                                                        </h5>
                                                        {/* Optional: Show email if we have it and want to generic */}
                                                        {/* <p className="text-xs text-gray-500">{user.email}</p> */}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleInvite(user)}
                                                    disabled={invitingUsers.has(user.uid)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {invitingUsers.has(user.uid) ? (
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
                        </div>
                    )}
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
