import React, { useState } from 'react';
import { Group } from '@/types';
import { GroupsService } from '@/lib/groups';
import { toast } from 'sonner';
import { Loader2, Save, Trash2, AlertTriangle, Shield, Globe, Lock, Camera, Wand2, ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/cropImage';
import { X, Check } from 'lucide-react';

interface GroupSettingsProps {
    group: Group;
    onUpdate: (updatedGroup: Group) => void;
}

export function GroupSettings({ group, onUpdate }: GroupSettingsProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: group.name,
        description: group.description,
        location: group.location || '',
        privacy: group.privacy,
        settings: {
            postingPermission: group.settings?.postingPermission || 'everyone',
            invitePermission: group.settings?.invitePermission || 'everyone',
            joinPolicy: group.settings?.joinPolicy || 'open'
        }
    });

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [bannerFile, setBannerFile] = React.useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = React.useState<string | null>(group.bannerImage || null);

    const fileInputIconRef = React.useRef<HTMLInputElement>(null);
    const [iconFile, setIconFile] = React.useState<File | null>(null);
    const [iconPreview, setIconPreview] = React.useState<string | null>(group.icon || null);
    const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);

    // Crop State
    const [isCropping, setIsCropping] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [tempImgSrc, setTempImgSrc] = useState<string | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setTempImgSrc(reader.result?.toString() || null);
                setIsCropping(true);
            });
            reader.readAsDataURL(file);
            e.target.value = ''; // Reset input
        }
    };

    const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    const handleGenerateIcon = async () => {
        if (formData.description.length < 10) {
            toast.error('Please add a longer description to generate an icon');
            return;
        }

        setIsGeneratingIcon(true);
        try {
            const res = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: `Icon for a group named "${formData.name}". Description: ${formData.description}` })
            });

            if (!res.ok) throw new Error('Failed to generate');

            const data = await res.json();
            if (data.image) {
                const imageRes = await fetch(data.image);
                const blob = await imageRes.blob();
                const extension = blob.type.split('/')[1] || 'jpeg';
                const file = new File([blob], `ai-icon.${extension}`, { type: blob.type });

                setIconFile(file);
                setIconPreview(URL.createObjectURL(file));
                toast.success('AI Icon generated!');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate icon');
        } finally {
            setIsGeneratingIcon(false);
        }
    };

    const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleCropConfirm = async () => {
        if (!tempImgSrc || !croppedAreaPixels) return;

        try {
            const croppedImageBlob = await getCroppedImg(tempImgSrc, croppedAreaPixels);
            if (croppedImageBlob) {
                const file = new File([croppedImageBlob], "banner.jpg", { type: "image/jpeg" });
                setBannerFile(file);
                setBannerPreview(URL.createObjectURL(file));
                setIsCropping(false);
                setTempImgSrc(null);
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to crop image');
        }
    };

    const handleCropCancel = () => {
        setIsCropping(false);
        setTempImgSrc(null);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            let bannerUrl = group.bannerImage;

            // Upload new banner if selected
            if (bannerFile) {
                bannerUrl = await GroupsService.uploadGroupBanner(group.id, bannerFile);
            }

            let iconUrl = group.icon;
            if (iconFile) {
                iconUrl = await GroupsService.uploadGroupIcon(group.id, iconFile);
            }

            const updatedData = { ...formData, bannerImage: bannerUrl, icon: iconUrl };
            await GroupsService.updateGroup(group.id, updatedData);

            onUpdate({ ...group, ...updatedData });
            toast.success('Group settings updated');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update settings');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure? This action cannot be undone.')) return;
        const confirmName = prompt(`Type "${group.name}" to confirm deletion:`);
        if (confirmName !== group.name) {
            return toast.error('Group name did not match');
        }

        setLoading(true);
        try {
            await GroupsService.deleteGroup(group.id);
            toast.success('Group deleted');
            router.push('/groups');
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete group');
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 space-y-8">
            {/* General Settings */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-500" />
                    General Information
                </h3>

                <div className="space-y-6">
                    {/* Banner Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cover Image</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative w-full h-48 rounded-xl bg-gray-100 dark:bg-zinc-800 overflow-hidden cursor-pointer group border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-blue-500 transition-colors"
                        >
                            {bannerPreview ? (
                                <img
                                    src={bannerPreview}
                                    alt="Group Banner"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center mb-2">
                                        <Camera className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm">Click to upload cover image</span>
                                </div>
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white font-medium flex items-center gap-2">
                                    <Camera className="w-5 h-5" />
                                    Change Cover
                                </span>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>
                    </div>

                    {/* Group Icon (Avatar) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group Icon</label>
                        <div className="flex items-start gap-6">
                            <div
                                onClick={() => fileInputIconRef.current?.click()}
                                className="relative w-24 h-24 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden cursor-pointer group border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-blue-500 transition-colors flex-shrink-0"
                            >
                                {iconPreview ? (
                                    <img
                                        src={iconPreview}
                                        alt="Group Icon"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                        <ImageIcon className="w-8 h-8" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Camera className="w-5 h-5 text-white" />
                                </div>
                                <input
                                    ref={fileInputIconRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleIconSelect}
                                />
                            </div>

                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Upload a custom icon or generate one using AI based on your group description.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => fileInputIconRef.current?.click()}
                                        className="px-4 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        Upload Image
                                    </button>
                                    <button
                                        onClick={handleGenerateIcon}
                                        disabled={isGeneratingIcon}
                                        className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isGeneratingIcon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                        Generate with AI
                                    </button>
                                </div>
                                {formData.description.length < 10 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Add a description to enable AI generation
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Privacy</label>
                            <select
                                value={formData.privacy}
                                onChange={(e) => setFormData({ ...formData, privacy: e.target.value as 'public' | 'private' })}
                                className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="public">Public (Visible to all)</option>
                                <option value="private">Private (Members only)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location (Optional)</label>
                            <input
                                type="text"
                                value={formData.location}
                                placeholder="e.g. Main Hall"
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Permissions */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-500" />
                    Permissions
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Who can post?</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800 cursor-pointer flex-1">
                                <input
                                    type="radio"
                                    name="posting"
                                    checked={formData.settings.postingPermission === 'everyone'}
                                    onChange={() => setFormData(prev => ({ ...prev, settings: { ...prev.settings, postingPermission: 'everyone' } }))}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium">Everyone</span>
                            </label>
                            <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800 cursor-pointer flex-1">
                                <input
                                    type="radio"
                                    name="posting"
                                    checked={formData.settings.postingPermission === 'admins_only'}
                                    onChange={() => setFormData(prev => ({ ...prev, settings: { ...prev.settings, postingPermission: 'admins_only' } }))}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium">Admins Only</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Who can invite members?</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800 cursor-pointer flex-1">
                                <input
                                    type="radio"
                                    name="inviting"
                                    checked={formData.settings.invitePermission === 'everyone'}
                                    onChange={() => setFormData(prev => ({ ...prev, settings: { ...prev.settings, invitePermission: 'everyone' } }))}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium">Everyone</span>
                            </label>
                            <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800 cursor-pointer flex-1">
                                <input
                                    type="radio"
                                    name="inviting"
                                    checked={formData.settings.invitePermission === 'admins_only'}
                                    onChange={() => setFormData(prev => ({ ...prev, settings: { ...prev.settings, invitePermission: 'admins_only' } }))}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium">Admins Only</span>
                            </label>
                        </div>
                    </div>
                </div>
            </section>

            {/* Save Button */}
            <div className="flex justify-end sticky bottom-6 z-10">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Changes
                </button>
            </div>

            {/* Danger Zone */}
            <section className="mt-12 pt-12 border-t border-gray-200 dark:border-zinc-800">
                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-900/20">
                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Danger Zone
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Permanently delete this group and all its content. This action cannot be undone.
                    </p>
                    <button
                        onClick={handleDelete}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 text-red-600 border border-red-200 dark:border-red-900/30 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Group
                    </button>
                </div>
            </section>

            {/* Crop Modal */}
            {
                isCropping && tempImgSrc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                                <h3 className="font-bold text-lg">Adjust Cover Image</h3>
                                <button onClick={handleCropCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="relative h-[400px] w-full bg-black">
                                <Cropper
                                    image={tempImgSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={3 / 1} // Banner aspect ratio
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                />
                            </div>

                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Zoom</label>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        aria-labelledby="Zoom"
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={handleCropCancel}
                                        className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCropConfirm}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
