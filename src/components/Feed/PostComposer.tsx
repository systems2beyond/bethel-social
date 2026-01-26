'use client';

import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, Send } from 'lucide-react';
import { uploadMedia } from '@/lib/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFeed } from '@/context/FeedContext';
import { GroupsService } from '@/lib/groups';

interface PostComposerProps {
    isOpen: boolean;
    onClose: () => void;
    initialContent?: string;
    groupId?: string;
}

export function PostComposer({ isOpen, onClose, initialContent = '', groupId }: PostComposerProps) {
    const { user, userData } = useAuth();
    const { triggerRefresh } = useFeed();
    const [content, setContent] = useState(initialContent);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [members, setMembers] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);

    React.useEffect(() => {
        setContent(initialContent);
    }, [initialContent]);

    React.useEffect(() => {
        if (groupId && isOpen) {
            GroupsService.getGroupMembers(groupId).then(setMembers).catch(console.error);
        }
    }, [groupId, isOpen]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        const newPosition = e.target.selectionStart;
        setContent(newContent);
        setCursorPosition(newPosition);

        // Check for mention trigger
        const textBeforeCursor = newContent.slice(0, newPosition);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            setMentionQuery(mentionMatch[1].toLowerCase());
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectMention = (member: any) => {
        const textBeforeCursor = content.slice(0, cursorPosition);
        const textAfterCursor = content.slice(cursorPosition);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            const matchIndex = mentionMatch.index!;
            const memberName = member.user?.displayName || 'User';
            // Insert name with space after
            const newContent = content.slice(0, matchIndex) + `@${memberName} ` + textAfterCursor;
            setContent(newContent);
            setShowSuggestions(false);
            // Ideally we'd set cursor position after the validation but React state update is basic here
        }
    };

    const filteredMembers = members.filter(m =>
        m.user?.displayName?.toLowerCase().includes(mentionQuery)
    ).slice(0, 5); // Limit to 5 suggestions

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setMediaFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim() && !mediaFile) return;
        if (!user) return;

        setIsSubmitting(true);
        try {
            let mediaUrl: string | null = null;
            let mediaType: string | null = null;

            if (mediaFile) {
                mediaUrl = await uploadMedia(mediaFile);
                mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
            }

            if (groupId) {
                await GroupsService.createGroupPost(groupId, {
                    content,
                    mediaUrl: mediaUrl || null,
                    mediaType: mediaType || null,
                    author: {
                        name: userData?.displayName || user.displayName || 'Anonymous',
                        avatarUrl: userData?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                        uid: user.uid
                    },
                    type: 'user_post'
                });
            } else {
                const postData: any = {
                    content,
                    mediaUrl: mediaUrl || null,
                    mediaType: mediaType || null,
                    // [Modified] Prioritize userData for consistent avatar
                    author: {
                        name: userData?.displayName || user.displayName || 'Anonymous',
                        avatarUrl: userData?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`
                    },
                    timestamp: Date.now(),
                    createdAt: serverTimestamp(),
                    likes: 0,
                    comments: 0,
                    type: 'user_post',
                    churchId: userData?.churchId || 'bethel-metro' // Fallback for safety
                };

                // Remove any key with undefined value to satisfy Firestore
                Object.keys(postData).forEach(key => {
                    if (postData[key] === undefined) delete postData[key];
                });

                await addDoc(collection(db, 'posts'), postData);
            }

            setContent('');
            setMediaFile(null);
            setMediaPreview(null);
            setMediaPreview(null);
            console.log('Post created, triggering refresh in 1s...');
            setTimeout(() => {
                console.log('Triggering refresh now');
                triggerRefresh();
            }, 1000);
            onClose();
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
                    <h2 className="font-semibold text-gray-900 dark:text-white">Create Post</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    <textarea
                        value={content}
                        onChange={handleContentChange}
                        placeholder="What's on your mind?"
                        className="w-full h-32 p-3 rounded-lg bg-gray-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-900 dark:text-white placeholder-gray-400"
                        disabled={isSubmitting}
                    />

                    {/* Mention Suggestions */}
                    {showSuggestions && (
                        <div className="absolute z-10 w-64 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 max-h-48 overflow-y-auto mt-1 mx-3">
                            {filteredMembers.map((member: any) => (
                                <button
                                    key={member.userId}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                                    onClick={() => selectMention(member)}
                                >
                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                        {member.user?.photoURL ? (
                                            <img src={member.user.photoURL} alt={member.user.displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-xs">
                                                {member.user?.displayName?.[0] || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-sm text-gray-900 dark:text-white truncate">
                                        {member.user?.displayName || 'Unknown'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Media Preview */}
                    {mediaPreview && (
                        <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-800 aspect-video">
                            <img src={mediaPreview} alt="Preview" className="w-full h-full object-contain" />
                            <button
                                onClick={() => {
                                    setMediaFile(null);
                                    setMediaPreview(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*,video/*"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            disabled={isSubmitting}
                        >
                            <ImageIcon className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium">Add Media</span>
                        </button>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!content.trim() && !mediaFile)}
                        className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        <span>Post</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
