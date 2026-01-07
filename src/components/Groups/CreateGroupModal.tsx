'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Users, Upload, MapPin, Tag, Wand2, ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { GroupsService, CreateGroupData } from '@/lib/groups';
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

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setName('');
            setDescription('');
            setType('community');
            setPrivacy('private');
            setLocation('');
            setTagsInput('');
            setTagsInput('');
            setBannerFile(null);
            setIconFile(null);
            setIconPreview(null);
        }
    }, [isOpen]);

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

            if (result.status === 'pending') {
                toast.success('Group created! It is awaiting admin approval to become public.');
                onClose();
            } else {
                toast.success('Group created successfully!');
                onClose();
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
                                        Create Group
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
