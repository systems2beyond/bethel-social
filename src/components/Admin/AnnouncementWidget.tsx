'use client';

import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Video, FileText, X, Loader2, CheckCircle, Paperclip } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadMedia } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

interface Attachment {
    file: File;
    id: string;
    type: 'image' | 'video' | 'file';
    previewUrl?: string;
}

export default function AnnouncementWidget() {
    const { user, userData } = useAuth();
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [postStatus, setPostStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
        if (e.target.files && e.target.files.length > 0) {
            const newAttachments: Attachment[] = Array.from(e.target.files).map(file => ({
                file,
                id: Math.random().toString(36).substring(7),
                type,
                previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined
            }));
            setAttachments(prev => [...prev, ...newAttachments]);
        }
        // Reset input so same file can be selected again if needed
        if (e.target) e.target.value = '';
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => {
            const newAttachments = prev.filter(a => a.id !== id);
            // Revoke object URLs to avoid memory leaks
            const removed = prev.find(a => a.id === id);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return newAttachments;
        });
    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && attachments.length === 0) return;

        setIsSubmitting(true);
        setPostStatus('idle');

        try {
            // 1. Upload Attachments
            const uploadedAttachments = await Promise.all(attachments.map(async (att) => {
                const downloadURL = await uploadMedia(att.file, `posts/${att.type}s`);
                return {
                    type: att.type,
                    url: downloadURL,
                    name: att.file.name,
                    mimeType: att.file.type,
                    size: att.file.size
                };
            }));

            // 2. Create Post Document
            await addDoc(collection(db, 'posts'), {
                type: 'manual',
                content: content,
                timestamp: Date.now(),
                pinned: false,
                author: {
                    name: userData?.displayName || user?.displayName || 'Bethel Admin',
                    avatarUrl: userData?.photoURL || user?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
                },
                createdAt: serverTimestamp(),
                attachments: uploadedAttachments,
                churchId: userData?.churchId || 'bethel-metro'
            });

            // 3. Reset State
            setContent('');
            setAttachments([]);
            setPostStatus('success');
            setTimeout(() => setPostStatus('idle'), 3000);
        } catch (error) {
            console.error('Error adding post:', error);
            setPostStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg">
            <h3 className="text-lg font-bold mb-2">New Announcement</h3>
            <p className="text-blue-100 text-sm mb-4">Post updates directly to the main feed.</p>

            <form onSubmit={handleCreatePost} className="space-y-4">
                <div className="relative">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="What's happening at Bethel?"
                        className="w-full h-32 p-4 rounded-xl bg-white/10 border border-white/20 placeholder-blue-100 text-white focus:ring-2 focus:ring-white/50 focus:border-transparent resize-none text-sm transition-all focus:bg-white/20 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                        disabled={isSubmitting}
                    />

                    {/* Attachment Previews */}
                    {attachments.length > 0 && (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            {attachments.map((att) => (
                                <div key={att.id} className="relative group bg-black/20 rounded-lg overflow-hidden border border-white/10 aspect-square flex items-center justify-center">
                                    {att.type === 'image' && att.previewUrl ? (
                                        <Image src={att.previewUrl} alt="Preview" fill className="object-cover" />
                                    ) : att.type === 'video' ? (
                                        <Video className="w-8 h-8 text-white/70" />
                                    ) : (
                                        <FileText className="w-8 h-8 text-white/70" />
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(att.id)}
                                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>

                                    {/* File Name Overlay for non-images */}
                                    {att.type !== 'image' && (
                                        <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-[10px] truncate px-2">
                                            {att.file.name}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Toolbar */}
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="p-2 rounded-lg hover:bg-white/10 text-blue-100 hover:text-white transition-colors"
                        title="Add Image"
                    >
                        <ImageIcon className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="p-2 rounded-lg hover:bg-white/10 text-blue-100 hover:text-white transition-colors"
                        title="Add Video"
                    >
                        <Video className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-lg hover:bg-white/10 text-blue-100 hover:text-white transition-colors"
                        title="Add File"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>

                    {/* Hidden Inputs */}
                    <input
                        type="file"
                        ref={imageInputRef}
                        onChange={(e) => handleFileSelect(e, 'image')}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />
                    <input
                        type="file"
                        ref={videoInputRef}
                        onChange={(e) => handleFileSelect(e, 'video')}
                        accept="video/*"
                        className="hidden"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFileSelect(e, 'file')}
                        accept=".pdf,.doc,.docx,.xls,.xlsx" // Common docs
                        className="hidden"
                    />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className="text-xs">
                        {postStatus === 'success' && (
                            <span className="bg-green-500/20 text-green-100 px-2 py-1 rounded-full flex items-center border border-green-500/30">
                                <CheckCircle className="w-3 h-3 mr-1" /> Posted
                            </span>
                        )}
                        {postStatus === 'error' && (
                            <span className="text-red-200 bg-red-500/20 px-2 py-1 rounded-full text-xs">
                                Error posting
                            </span>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-white text-blue-600 rounded-xl hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-bold shadow-sm"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Publish</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
