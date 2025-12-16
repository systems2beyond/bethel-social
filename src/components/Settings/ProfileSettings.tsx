'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Upload, User, Camera } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

export default function ProfileSettings() {
    const { user, userData } = useAuth();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(userData?.photoURL || user?.photoURL || null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validations
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File size must be less than 5MB.');
            return;
        }

        // Preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        setUploading(true);
        try {
            const storage = getStorage();
            const storageRef = ref(storage, `profile_photos/${user?.uid}/${Date.now()}_${file.name}`);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update Firebase Auth Profile
            if (user) {
                await updateProfile(user, { photoURL: downloadURL });
            }

            // Update Firestore User Doc
            if (user?.uid) {
                await updateDoc(doc(db, 'users', user.uid), {
                    photoURL: downloadURL
                });
            }

            // Success feedback
            // Ideally use a toast here, but alert works for now if no toast provider
            // alert('Profile photo updated successfully!'); 

        } catch (error) {
            console.error("Error uploading profile photo:", error);
            alert('Failed to update profile photo. Please try again.');
            // Revert preview on error
            setPreviewUrl(userData?.photoURL || user?.photoURL || null);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Photo</h3>

            <div className="flex items-center gap-6">
                <div className="relative group">
                    <div className={cn(
                        "w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center",
                        uploading && "opacity-50"
                    )}>
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <User className="w-10 h-10 text-gray-400" />
                        )}
                    </div>

                    {/* Overflow loading spinner */}
                    {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    )}

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors disabled:opacity-50"
                        title="Upload new photo"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {userData?.displayName || user?.displayName || 'User'}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {user?.email}
                    </p>

                    <div className="flex gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            Upload New Photo
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Recommended: Square image, at least 400x400px.
                    </p>
                </div>
            </div>
        </div>
    );
}
