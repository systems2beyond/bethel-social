'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Users, Upload, MapPin, Tag, Wand2, ImageIcon, Search, UserPlus, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { GroupsService, CreateGroupData } from '@/lib/groups';
import { UsersService, UserProfile } from '@/lib/users';
import { toast } from 'sonner';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'community' | 'ministry'>('community');
    const [privacy, setPrivacy] = useState<'public' | 'private'>('private');
    const [location, setLocation] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(null);
    const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);

    // Invite State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setName('');
            setDescription('');
            setType('community');
            setPrivacy('private');
            setLocation('');
            setTagsInput('');
            setBannerFile(null);
            setIconFile(null);
            setIconPreview(null);
            // Reset invite state
            setSearchQuery('');
            setSearchResults([]);
            setSelectedUsers([]);
        }
    }, [isOpen]);

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

    const handleSelectUser = (user: UserProfile) => {
        if (!selectedUsers.some(u => u.uid === user.uid)) {
            setSelectedUsers([...selectedUsers, user]);
        }
        setSearchQuery(''); // Clear search after selecting
        setSearchResults([]);
    };

    const handleRemoveUser = (uid: string) => {
        setSelectedUsers(selectedUsers.filter(u => u.uid !== uid));
    };

    const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    const handleGenerateIcon = async () => {
        if (description.length < 10) return;
        setIsGeneratingIcon(true);
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Church group icon for: ${name}. ${description}`,
                    style: '3d-icon'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate image');
            }

            const data = await response.json();
            if (data.image) {
                // Fetch the Data URI to get a blob (standard way to convert Base64 -> Blob)
                const imageRes = await fetch(data.image);
                const blob = await imageRes.blob();
                const extension = blob.type.split('/')[1] || 'jpeg';
                const file = new File([blob], `generated-icon.${extension}`, { type: blob.type });

                setIconFile(file);
                setIconPreview(URL.createObjectURL(file));
                toast.success('Icon generated!');
            } else {
                throw new Error('No image returned');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate icon');
        } finally {
            setIsGeneratingIcon(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);

        try {
            const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

            const groupData: CreateGroupData = {
                name,
                description,
                type,
                privacy,
                location: location || undefined,
                tags,
                createdBy: user.uid
            };

            const result = await GroupsService.createGroup(groupData, bannerFile || undefined, iconFile || undefined);

            // Handle Invites
            if (selectedUsers.length > 0) {
                let inviteCount = 0;
                for (const invitedUser of selectedUsers) {
                    try {
                        await GroupsService.inviteMember(result.id, invitedUser.uid);
                        inviteCount++;
                    } catch (err) {
                        console.error(`Failed to invite ${invitedUser.displayName}`, err);
                    }
                }
                if (inviteCount > 0) {
                    toast.success(`Group created and ${inviteCount} invites sent!`);
                } else {
                    toast.success('Group created, but failed to send invites.');
                }
            } else {
                toast.success(result.status === 'pending'
                    ? 'Group created! It is awaiting admin approval.'
                    : 'Group created successfully!');
            }

            onClose();
            if (result.status === 'active') {
                router.push(`/groups/${result.id}`);
            }
        } catch (error) {
            console.error('Failed to create group:', error);
            toast.error('Failed to create group. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="relative z-[50000]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
                aria-hidden="true"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 text-left shadow-xl transition-all w-full max-w-lg border border-gray-100 dark:border-zinc-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                Create New Group
                            </h3>
                            <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                        Group Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        placeholder="e.g. Youth Hiking Club"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                        Description
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                                        placeholder="What is this group about?"
                                    />
                                </div>

                                {/* Privacy & Type Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Privacy *
                                        </label>
                                        <select
                                            value={privacy}
                                            onChange={(e) => setPrivacy(e.target.value as any)}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        >
                                            <option value="private">Private (Invite Only)</option>
                                            <option value="public">Public (Requires Approval)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Type
                                        </label>
                                        <select
                                            value={type}
                                            onChange={(e) => setType(e.target.value as any)}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        >
                                            <option value="community">Community</option>
                                            <option value="ministry">Ministry</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Location & Tags Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" /> Location
                                        </label>
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="e.g. Main Hall"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Tag className="w-3.5 h-3.5" /> Tags
                                        </label>
                                        <input
                                            type="text"
                                            value={tagsInput}
                                            onChange={(e) => setTagsInput(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            placeholder="comma, separated"
                                        />
                                    </div>
                                </div>

                                {/* Banner Image */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                        <Upload className="w-3.5 h-3.5" /> Banner Image (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setBannerFile(e.target.files[0]);
                                            }
                                        }}
                                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400 transition-all"
                                    />
                                </div>

                                {/* Group Icon Section */}
                                <div className="space-y-3 pt-2">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <ImageIcon className="w-3.5 h-3.5" /> Group Icon
                                    </label>

                                    <div className="flex items-start gap-4">
                                        {/* Preview Circle */}
                                        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex-shrink-0 flex items-center justify-center overflow-hidden relative group">
                                            {iconPreview ? (
                                                <img src={iconPreview} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <Users className="w-6 h-6 text-gray-400" />
                                            )}
                                        </div>

                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg cursor-pointer transition-colors">
                                                    <Upload className="w-3.5 h-3.5" />
                                                    Upload
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={handleIconSelect}
                                                    />
                                                </label>

                                                <span className="text-gray-300 dark:text-zinc-700">|</span>

                                                <button
                                                    type="button"
                                                    onClick={handleGenerateIcon}
                                                    disabled={description.length < 10 || isGeneratingIcon}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 text-xs font-medium rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet-500/20"
                                                >
                                                    {isGeneratingIcon ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Wand2 className="w-3.5 h-3.5" />
                                                    )}
                                                    Generate with AI
                                                </button>
                                            </div>

                                            {description.length < 10 && (
                                                <p className="text-[10px] text-orange-500 flex items-center gap-1">
                                                    * Add a description (10+ chars) to use AI generation
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Invite Members Section */}
                                <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 mt-4">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <UserPlus className="w-3.5 h-3.5" /> Invite Members (Optional)
                                    </label>

                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search users to invite..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        />
                                    </div>

                                    {/* Selected Users */}
                                    {selectedUsers.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {selectedUsers.map(user => (
                                                <div key={user.uid} className="flex items-center gap-1 pl-2 pr-1 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium border border-blue-100 dark:border-blue-800">
                                                    <span>{user.displayName}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveUser(user.uid)}
                                                        className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Search Results */}
                                    {searchQuery.length >= 2 && (
                                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700 max-h-48 overflow-y-auto shadow-lg">
                                            {isSearching ? (
                                                <div className="flex justify-center py-4">
                                                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                                </div>
                                            ) : searchResults.length === 0 ? (
                                                <div className="text-center py-4 text-xs text-gray-500">
                                                    No users found
                                                </div>
                                            ) : (
                                                <div className="p-1">
                                                    {searchResults.map(user => {
                                                        const isSelected = selectedUsers.some(u => u.uid === user.uid);
                                                        return (
                                                            <button
                                                                key={user.uid}
                                                                type="button"
                                                                onClick={() => handleSelectUser(user)}
                                                                disabled={isSelected}
                                                                className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${isSelected
                                                                    ? 'opacity-50 cursor-default'
                                                                    : 'hover:bg-gray-50 dark:hover:bg-zinc-700/50'
                                                                    }`}
                                                            >
                                                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 overflow-hidden flex-shrink-0">
                                                                    {user.photoURL ? (
                                                                        <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="font-medium text-xs">
                                                                            {user.displayName.substring(0, 2).toUpperCase()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                        {user.displayName}
                                                                    </p>
                                                                </div>
                                                                {isSelected && <Check className="w-4 h-4 text-blue-500" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Actions */}
                                <div className="pt-4 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Create Group {selectedUsers.length > 0 && `& Invite ${selectedUsers.length}`}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );

    // Ensure we are client-side before creating portal (though component is marked 'use client')
    if (typeof document === 'undefined') return null;

    return createPortal(modalContent, document.body);
}
