'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
    Image as ImageIcon,
    Video,
    FileText,
    X,
    Paperclip,
    Upload,
    Link,
    CloudUpload,
    AlertCircle,
    Loader2
} from 'lucide-react';
import Image from 'next/image';
import { TaskAttachment } from '@/types';
import { TaskAttachmentService } from '@/lib/services/TaskAttachmentService';
import { GoogleDriveUploadService, DriveUploadResult, DriveApiError } from '@/lib/services/GoogleDriveUploadService';
import { useAuth } from '@/context/AuthContext';

interface StagedAttachment {
    id: string;
    file?: File;
    type: 'image' | 'video' | 'file';
    previewUrl?: string;
    name: string;
    size: number;
    source: 'firebase' | 'google_drive_link' | 'google_drive_upload';
    // For Drive links
    driveUrl?: string;
    driveFileId?: string;
    // For already uploaded
    uploadedUrl?: string;
    // Upload state
    uploading?: boolean;
    uploadProgress?: number;
    error?: string;
}

interface TaskFileAttachmentSectionProps {
    attachments: TaskAttachment[];
    onAttachmentsChange: (attachments: TaskAttachment[]) => void;
    stagedAttachments: StagedAttachment[];
    onStagedAttachmentsChange: React.Dispatch<React.SetStateAction<StagedAttachment[]>>;
    mode: 'edit' | 'view' | 'complete';
    disabled?: boolean;
    maxFirebaseSize?: number;
    className?: string;
}

export function TaskFileAttachmentSection({
    attachments,
    onAttachmentsChange,
    stagedAttachments,
    onStagedAttachmentsChange,
    mode,
    disabled = false,
    maxFirebaseSize = TaskAttachmentService.MAX_FIREBASE_FILE_SIZE,
    className = ''
}: TaskFileAttachmentSectionProps) {
    const { googleAccessToken, user, signInWithGoogle } = useAuth();
    const [showDriveLinkInput, setShowDriveLinkInput] = useState(false);
    const [driveLinkUrl, setDriveLinkUrl] = useState('');
    const [driveLinkError, setDriveLinkError] = useState('');
    const [showLargeFilePrompt, setShowLargeFilePrompt] = useState(false);
    const [largeFile, setLargeFile] = useState<File | null>(null);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];

        // Validate file size
        const validation = TaskAttachmentService.validateFile(file, !!googleAccessToken);

        if (!validation.valid) {
            if (validation.suggestDriveLink || validation.suggestDriveUpload) {
                // Show large file prompt
                setLargeFile(file);
                setShowLargeFilePrompt(true);
            } else {
                // Just show error
                alert(validation.error);
            }
            e.target.value = '';
            return;
        }

        // Add to staged attachments (will be uploaded on submit)
        const newAttachment: StagedAttachment = {
            id: Math.random().toString(36).substring(7),
            file,
            type,
            previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined,
            name: file.name,
            size: file.size,
            source: 'firebase'
        };

        onStagedAttachmentsChange([...stagedAttachments, newAttachment]);
        e.target.value = '';
    }, [googleAccessToken, stagedAttachments, onStagedAttachmentsChange]);

    const handleDriveLinkSubmit = async () => {
        if (!driveLinkUrl.trim()) return;

        setDriveLinkError('');

        const fileId = TaskAttachmentService.extractDriveFileId(driveLinkUrl);
        if (!fileId) {
            setDriveLinkError('Invalid Google Drive URL');
            return;
        }

        // Add as staged attachment
        const newAttachment: StagedAttachment = {
            id: Math.random().toString(36).substring(7),
            type: 'file',
            name: 'Google Drive File',
            size: 0,
            source: 'google_drive_link',
            driveUrl: driveLinkUrl,
            driveFileId: fileId
        };

        onStagedAttachmentsChange([...stagedAttachments, newAttachment]);
        setDriveLinkUrl('');
        setShowDriveLinkInput(false);
    };

    const handleDriveUpload = async () => {
        if (!largeFile || !googleAccessToken || !user) return;

        const attachmentId = Math.random().toString(36).substring(7);

        // Add as uploading
        const uploadingAttachment: StagedAttachment = {
            id: attachmentId,
            file: largeFile,
            type: TaskAttachmentService.getAttachmentType(largeFile.type),
            name: largeFile.name,
            size: largeFile.size,
            source: 'google_drive_upload',
            uploading: true,
            uploadProgress: 0
        };

        onStagedAttachmentsChange([...stagedAttachments, uploadingAttachment]);
        setShowLargeFilePrompt(false);
        setLargeFile(null);

        try {
            const result = await GoogleDriveUploadService.uploadToUserDrive(
                uploadingAttachment.file!,
                googleAccessToken,
                (progress) => {
                    // Update progress
                    onStagedAttachmentsChange(prev =>
                        prev.map(a => a.id === attachmentId
                            ? { ...a, uploadProgress: progress }
                            : a
                        )
                    );
                }
            );

            // Update with completed upload
            onStagedAttachmentsChange(prev =>
                prev.map(a => a.id === attachmentId
                    ? {
                        ...a,
                        uploading: false,
                        uploadedUrl: result.webViewLink,
                        driveFileId: result.fileId
                    }
                    : a
                )
            );
        } catch (error: any) {
            // If token expired (401), auto re-auth and retry
            if (error instanceof DriveApiError && error.status === 401) {
                console.log('[TaskFileAttachmentSection] Token expired, re-authenticating...');
                try {
                    await signInWithGoogle();
                    // signInWithGoogle updates the token in context/sessionStorage,
                    // but we need to re-read it from sessionStorage since the state
                    // update won't be available synchronously
                    const freshToken = sessionStorage.getItem('googleAccessToken');
                    if (freshToken && uploadingAttachment.file) {
                        const result = await GoogleDriveUploadService.uploadToUserDrive(
                            uploadingAttachment.file,
                            freshToken,
                            (progress) => {
                                onStagedAttachmentsChange(prev =>
                                    prev.map(a => a.id === attachmentId
                                        ? { ...a, uploadProgress: progress }
                                        : a
                                    )
                                );
                            }
                        );
                        onStagedAttachmentsChange(prev =>
                            prev.map(a => a.id === attachmentId
                                ? {
                                    ...a,
                                    uploading: false,
                                    uploadedUrl: result.webViewLink,
                                    driveFileId: result.fileId
                                }
                                : a
                            )
                        );
                        return; // Success on retry
                    }
                } catch (reAuthError: any) {
                    console.error('[TaskFileAttachmentSection] Re-auth failed:', reAuthError);
                }
            }
            // Mark as error (original error or re-auth failure)
            onStagedAttachmentsChange(prev =>
                prev.map(a => a.id === attachmentId
                    ? { ...a, uploading: false, error: error.message }
                    : a
                )
            );
        }
    };

    const removeStagedAttachment = (id: string) => {
        onStagedAttachmentsChange(stagedAttachments.filter(a => {
            if (a.id === id) {
                // Revoke object URL if exists
                if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                return false;
            }
            return true;
        }));
    };

    const removeUploadedAttachment = (url: string) => {
        onAttachmentsChange(attachments.filter(a => a.url !== url));
    };

    if (mode === 'view') {
        if (attachments.length === 0) return null;

        return (
            <div className={`${className}`}>
                <p className="text-xs text-muted-foreground mb-2">Attachments</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {attachments.map((att, idx) => (
                        <AttachmentPreview key={idx} attachment={att} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Existing Attachments */}
            {attachments.length > 0 && (
                <div>
                    <p className="text-xs text-muted-foreground mb-2">Attached Files</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {attachments.map((att, idx) => (
                            <div key={idx} className="relative group">
                                <AttachmentPreview attachment={att} compact />
                                <button
                                    type="button"
                                    onClick={() => removeUploadedAttachment(att.url)}
                                    className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    disabled={disabled}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Staged Attachments (pending upload) */}
            {stagedAttachments.length > 0 && (
                <div>
                    <p className="text-xs text-muted-foreground mb-2">
                        Pending Upload ({stagedAttachments.length})
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {stagedAttachments.map(att => (
                            <div
                                key={att.id}
                                className="relative group aspect-square bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 flex items-center justify-center"
                            >
                                {att.type === 'image' && att.previewUrl ? (
                                    <Image
                                        src={att.previewUrl}
                                        alt={att.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : att.type === 'video' ? (
                                    <Video className="w-8 h-8 text-gray-400" />
                                ) : att.source === 'google_drive_link' || att.source === 'google_drive_upload' ? (
                                    <CloudUpload className="w-8 h-8 text-blue-400" />
                                ) : (
                                    <FileText className="w-8 h-8 text-gray-400" />
                                )}

                                {/* Upload Progress */}
                                {att.uploading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <div className="text-center">
                                            <Loader2 className="w-6 h-6 text-white animate-spin mx-auto" />
                                            <span className="text-white text-xs mt-1">
                                                {att.uploadProgress || 0}%
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Error State */}
                                {att.error && (
                                    <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-2">
                                        <span className="text-white text-xs text-center">{att.error}</span>
                                    </div>
                                )}

                                {/* Remove Button */}
                                {!att.uploading && (
                                    <button
                                        type="button"
                                        onClick={() => removeStagedAttachment(att.id)}
                                        className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                        disabled={disabled}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}

                                {/* File Name */}
                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-[10px] text-white truncate px-2">
                                    {att.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add Attachment Toolbar */}
            <div className="flex items-center gap-1 flex-wrap">
                <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    title="Add Image"
                    disabled={disabled}
                >
                    <ImageIcon className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    title="Add Video"
                    disabled={disabled}
                >
                    <Video className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    title="Add File"
                    disabled={disabled}
                >
                    <Paperclip className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    onClick={() => setShowDriveLinkInput(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    title="Add Google Drive Link"
                    disabled={disabled}
                >
                    <Link className="w-5 h-5" />
                </button>

                <span className="text-xs text-muted-foreground ml-2">
                    Max {TaskAttachmentService.formatFileSize(maxFirebaseSize)} per file
                </span>

                {/* Hidden Inputs */}
                <input
                    type="file"
                    ref={imageInputRef}
                    onChange={(e) => handleFileSelect(e, 'image')}
                    accept="image/*"
                    className="hidden"
                    disabled={disabled}
                />
                <input
                    type="file"
                    ref={videoInputRef}
                    onChange={(e) => handleFileSelect(e, 'video')}
                    accept="video/*"
                    className="hidden"
                    disabled={disabled}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileSelect(e, 'file')}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                    className="hidden"
                    disabled={disabled}
                />
            </div>

            {/* Drive Link Input */}
            {showDriveLinkInput && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700">
                    <Link className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <input
                        type="url"
                        value={driveLinkUrl}
                        onChange={(e) => setDriveLinkUrl(e.target.value)}
                        placeholder="Paste Google Drive share link..."
                        className="flex-1 bg-transparent border-0 text-sm focus:ring-0 p-0"
                        autoFocus
                    />
                    <button
                        type="button"
                        onClick={handleDriveLinkSubmit}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Add
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowDriveLinkInput(false);
                            setDriveLinkUrl('');
                            setDriveLinkError('');
                        }}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {driveLinkError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {driveLinkError}
                </p>
            )}

            {/* Large File Prompt */}
            {showLargeFilePrompt && largeFile && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                File too large for direct upload
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                                "{largeFile.name}" ({TaskAttachmentService.formatFileSize(largeFile.size)}) exceeds the 5MB limit.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                {googleAccessToken && (
                                    <button
                                        type="button"
                                        onClick={handleDriveUpload}
                                        className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <CloudUpload className="w-4 h-4" />
                                        Upload to My Drive
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowLargeFilePrompt(false);
                                        setLargeFile(null);
                                        setShowDriveLinkInput(true);
                                    }}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
                                >
                                    <Link className="w-4 h-4" />
                                    Use Drive Link Instead
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowLargeFilePrompt(false);
                                        setLargeFile(null);
                                    }}
                                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for displaying attachments
function AttachmentPreview({
    attachment,
    compact = false
}: {
    attachment: TaskAttachment;
    compact?: boolean;
}) {
    const isImage = attachment.type === 'image';
    const isDrive = attachment.source === 'google_drive_link' || attachment.source === 'google_drive_upload';

    return (
        <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block relative bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors ${compact ? 'aspect-square' : 'aspect-video'
                }`}
        >
            {isImage && !isDrive ? (
                <Image
                    src={attachment.thumbnailUrl || attachment.url}
                    alt={attachment.name}
                    fill
                    className="object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                    {isDrive ? (
                        <CloudUpload className="w-8 h-8 text-blue-400" />
                    ) : attachment.type === 'video' ? (
                        <Video className="w-8 h-8 text-gray-400" />
                    ) : (
                        <FileText className="w-8 h-8 text-gray-400" />
                    )}
                </div>
            )}

            {/* File Name Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-[10px] text-white truncate">{attachment.name}</p>
                {attachment.size > 0 && (
                    <p className="text-[9px] text-white/70">
                        {TaskAttachmentService.formatFileSize(attachment.size)}
                    </p>
                )}
            </div>

            {/* Drive Badge */}
            {isDrive && (
                <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-500 text-white text-[8px] rounded">
                    Drive
                </div>
            )}
        </a>
    );
}

export { type StagedAttachment };
