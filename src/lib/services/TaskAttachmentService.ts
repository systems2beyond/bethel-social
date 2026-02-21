import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { TaskAttachment, TaskAttachmentSource } from '@/types';

const storage = getStorage(app);

export class TaskAttachmentService {
    // Constants
    static readonly MAX_FIREBASE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    static readonly MAX_USER_QUOTA = 50 * 1024 * 1024; // 50MB for non-Google users
    static readonly LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB - suggest Drive for larger

    /**
     * Validate a file before upload
     * Returns validation result with suggestions for large files
     */
    static validateFile(
        file: File,
        userHasGoogleAuth: boolean
    ): {
        valid: boolean;
        error?: string;
        suggestDriveLink?: boolean;
        suggestDriveUpload?: boolean;
    } {
        // Check if file exists
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }

        // Check file size
        if (file.size > this.MAX_FIREBASE_FILE_SIZE) {
            if (userHasGoogleAuth) {
                return {
                    valid: false,
                    error: `File size (${this.formatFileSize(file.size)}) exceeds the 5MB limit for direct upload.`,
                    suggestDriveLink: true,
                    suggestDriveUpload: true
                };
            } else {
                return {
                    valid: false,
                    error: `File size (${this.formatFileSize(file.size)}) exceeds the 5MB limit. Please use a Google Drive link for larger files.`,
                    suggestDriveLink: true
                };
            }
        }

        // File is valid for Firebase upload
        return { valid: true };
    }

    /**
     * Upload a file to Firebase Storage for task attachments
     */
    static async uploadToFirebase(
        file: File,
        taskType: 'ministry' | 'personal',
        taskId: string,
        userId: string,
        churchId?: string
    ): Promise<TaskAttachment> {
        // Validate file size
        if (file.size > this.MAX_FIREBASE_FILE_SIZE) {
            throw new Error(`File size exceeds ${this.formatFileSize(this.MAX_FIREBASE_FILE_SIZE)} limit`);
        }

        try {
            const timestamp = Date.now();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueName = `${timestamp}-${sanitizedName}`;

            // Storage path: task_attachments/{churchId}/{taskType}/{taskId}/{filename}
            const storagePath = churchId
                ? `task_attachments/${churchId}/${taskType}/${taskId}/${uniqueName}`
                : `task_attachments/${taskType}/${taskId}/${uniqueName}`;

            const storageRef = ref(storage, storagePath);

            // Upload file
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Create attachment object
            const attachment: TaskAttachment = {
                type: this.getAttachmentType(file.type),
                url: downloadURL,
                name: file.name,
                mimeType: file.type,
                size: file.size,
                source: 'firebase' as TaskAttachmentSource,
                uploadedBy: userId,
                uploadedAt: new Date()
            };

            console.log('[TaskAttachmentService] Uploaded file:', file.name, 'to', storagePath);
            return attachment;
        } catch (error) {
            console.error('[TaskAttachmentService] Upload error:', error);
            throw error;
        }
    }

    /**
     * Process and validate a Google Drive share link
     */
    static async processGoogleDriveLink(
        driveUrl: string,
        userId: string
    ): Promise<TaskAttachment> {
        // Extract file ID from various Google Drive URL formats
        const fileId = this.extractDriveFileId(driveUrl);

        if (!fileId) {
            throw new Error('Invalid Google Drive URL. Please use a valid share link.');
        }

        // Validate the link is accessible (basic check)
        // In production, you'd call the Drive API to verify access
        const isValid = await this.validateDriveLink(fileId);

        if (!isValid) {
            throw new Error('Unable to access this file. Make sure sharing is enabled ("Anyone with the link").');
        }

        // Create attachment object
        const attachment: TaskAttachment = {
            type: 'file', // Default to file, could be updated via API metadata
            url: driveUrl,
            name: 'Google Drive File', // Would be fetched from API in production
            mimeType: 'application/octet-stream',
            size: 0, // Would be fetched from API
            source: 'google_drive_link' as TaskAttachmentSource,
            uploadedBy: userId,
            uploadedAt: new Date(),
            driveFileId: fileId,
            isPublicLink: true
        };

        console.log('[TaskAttachmentService] Processed Drive link:', fileId);
        return attachment;
    }

    /**
     * Extract file ID from Google Drive URL
     * Supports various formats:
     * - https://drive.google.com/file/d/{fileId}/view
     * - https://drive.google.com/open?id={fileId}
     * - https://docs.google.com/document/d/{fileId}/edit
     */
    static extractDriveFileId(url: string): string | null {
        if (!url) return null;

        // Pattern 1: /d/{fileId}/
        const pattern1 = /\/d\/([a-zA-Z0-9_-]+)/;
        const match1 = url.match(pattern1);
        if (match1) return match1[1];

        // Pattern 2: ?id={fileId}
        const pattern2 = /[?&]id=([a-zA-Z0-9_-]+)/;
        const match2 = url.match(pattern2);
        if (match2) return match2[1];

        return null;
    }

    /**
     * Validate that a Drive link is accessible
     * In production, this would use the Drive API
     */
    static async validateDriveLink(fileId: string): Promise<boolean> {
        // For now, just check if fileId looks valid
        // In production, call /api/drive/metadata to verify access
        return fileId.length > 10;
    }

    /**
     * Get user's storage usage for quota enforcement
     * Used for non-Google users with Firebase Storage limits
     */
    static async getUserStorageUsage(userId: string, churchId?: string): Promise<{
        used: number;
        limit: number;
        remaining: number;
    }> {
        try {
            // List all files in user's task attachments
            const basePath = churchId
                ? `task_attachments/${churchId}`
                : 'task_attachments';

            // This would need to be done server-side for security
            // For now, we track usage in user document
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.data();
            const used = userData?.taskAttachmentStorageUsed || 0;

            return {
                used,
                limit: this.MAX_USER_QUOTA,
                remaining: Math.max(0, this.MAX_USER_QUOTA - used)
            };
        } catch (error) {
            console.error('[TaskAttachmentService] Error getting storage usage:', error);
            return {
                used: 0,
                limit: this.MAX_USER_QUOTA,
                remaining: this.MAX_USER_QUOTA
            };
        }
    }

    /**
     * Update user's storage usage after upload
     */
    static async updateUserStorageUsage(userId: string, bytesAdded: number): Promise<void> {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            const currentUsage = userDoc.data()?.taskAttachmentStorageUsed || 0;

            await updateDoc(userRef, {
                taskAttachmentStorageUsed: currentUsage + bytesAdded
            });
        } catch (error) {
            console.error('[TaskAttachmentService] Error updating storage usage:', error);
        }
    }

    /**
     * Delete an attachment from storage
     */
    static async deleteAttachment(
        attachment: TaskAttachment,
        taskType: 'ministry' | 'personal',
        taskId: string,
        userId: string
    ): Promise<void> {
        // Only delete from Firebase Storage
        if (attachment.source !== 'firebase') {
            console.log('[TaskAttachmentService] Skipping delete for non-Firebase attachment');
            return;
        }

        try {
            // Extract path from URL
            const url = new URL(attachment.url);
            const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
            if (pathMatch) {
                const encodedPath = pathMatch[1];
                const storagePath = decodeURIComponent(encodedPath);
                const storageRef = ref(storage, storagePath);
                await deleteObject(storageRef);

                // Update user storage usage
                await this.updateUserStorageUsage(userId, -attachment.size);

                console.log('[TaskAttachmentService] Deleted attachment:', attachment.name);
            }
        } catch (error) {
            console.error('[TaskAttachmentService] Error deleting attachment:', error);
            throw error;
        }
    }

    /**
     * Check if user can upload more files (quota check)
     */
    static async canUpload(userId: string, fileSize: number, churchId?: string): Promise<{
        allowed: boolean;
        reason?: string;
    }> {
        const usage = await this.getUserStorageUsage(userId, churchId);

        if (fileSize > usage.remaining) {
            return {
                allowed: false,
                reason: `Upload would exceed your storage quota. Used: ${this.formatFileSize(usage.used)}, Limit: ${this.formatFileSize(usage.limit)}`
            };
        }

        return { allowed: true };
    }

    /**
     * Determine attachment type from MIME type
     */
    static getAttachmentType(mimeType: string): 'image' | 'video' | 'file' {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        return 'file';
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Generate a thumbnail URL for images stored in Firebase Storage
     * Note: This requires Firebase Extensions or Cloud Functions for resizing
     */
    static getThumbnailUrl(url: string, width: number = 200): string {
        // If using Firebase Extensions (Image Resizing), modify URL
        // For now, return original URL
        return url;
    }

    /**
     * Check if a file type is allowed
     */
    static isAllowedFileType(mimeType: string): boolean {
        const allowedTypes = [
            // Images
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            // Videos
            'video/mp4', 'video/webm', 'video/quicktime',
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            // Text
            'text/plain', 'text/csv',
            // Archives
            'application/zip', 'application/x-rar-compressed'
        ];

        return allowedTypes.includes(mimeType);
    }
}
