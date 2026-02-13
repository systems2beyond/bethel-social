import { TaskAttachment, TaskAttachmentSource } from '@/types';
import { serverTimestamp } from 'firebase/firestore';

const APP_FOLDER_NAME = 'Bethel Social Tasks';

export interface DriveUploadResult {
    fileId: string;
    webViewLink: string;
    name: string;
    mimeType: string;
    size: number;
    thumbnailLink?: string;
}

export class DriveApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'DriveApiError';
        this.status = status;
    }
}

export class GoogleDriveUploadService {
    /**
     * Upload a file to the user's personal Google Drive
     * Uses the user's OAuth access token from sign-in
     */
    static async uploadToUserDrive(
        file: File,
        accessToken: string,
        onProgress?: (percent: number) => void
    ): Promise<DriveUploadResult> {
        if (!accessToken) {
            throw new Error('Google access token required. Please sign in with Google.');
        }

        try {
            // 1. Get or create app folder
            const folderId = await this.getOrCreateAppFolder(accessToken);

            // 2. Initiate resumable upload
            const uploadUrl = await this.initiateResumableUpload(
                file.name,
                file.type,
                folderId,
                accessToken
            );

            // 3. Upload file with progress tracking
            const fileData = await this.uploadWithProgress(uploadUrl, file, onProgress);

            // 4. Make file publicly accessible
            await this.makeFilePublic(fileData.id, accessToken);

            console.log('[GoogleDriveUploadService] Upload complete:', fileData.name);

            return {
                fileId: fileData.id,
                webViewLink: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`,
                name: fileData.name,
                mimeType: file.type,
                size: file.size,
                thumbnailLink: fileData.thumbnailLink
            };
        } catch (error) {
            console.error('[GoogleDriveUploadService] Upload error:', error);
            throw error;
        }
    }

    /**
     * Get or create the app folder in user's Drive
     */
    static async getOrCreateAppFolder(accessToken: string): Promise<string> {
        // Search for existing folder
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;

        const searchResponse = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!searchResponse.ok) {
            const msg = searchResponse.status === 401
                ? 'Google Drive session expired. Please sign in with Google again.'
                : 'Failed to search for app folder';
            throw new DriveApiError(msg, searchResponse.status);
        }

        const searchData = await searchResponse.json();

        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }

        // Create folder if not exists
        const createUrl = 'https://www.googleapis.com/drive/v3/files';
        const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: APP_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        if (!createResponse.ok) {
            const msg = createResponse.status === 401
                ? 'Google Drive session expired. Please sign in with Google again.'
                : 'Failed to create app folder';
            throw new DriveApiError(msg, createResponse.status);
        }

        const folderData = await createResponse.json();
        console.log('[GoogleDriveUploadService] Created app folder:', folderData.id);
        return folderData.id;
    }

    /**
     * Initiate a resumable upload session
     */
    static async initiateResumableUpload(
        filename: string,
        contentType: string,
        folderId: string,
        accessToken: string
    ): Promise<string> {
        const initiationUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';

        const response = await fetch(initiationUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': contentType
            },
            body: JSON.stringify({
                name: filename,
                parents: [folderId]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GoogleDriveUploadService] Initiation error:', errorText);
            const msg = response.status === 401
                ? 'Google Drive session expired. Please sign in with Google again.'
                : 'Failed to initiate upload';
            throw new DriveApiError(msg, response.status);
        }

        const uploadUrl = response.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('No upload URL returned');
        }

        return uploadUrl;
    }

    /**
     * Upload file to the resumable session with progress tracking
     */
    static async uploadWithProgress(
        uploadUrl: string,
        file: File,
        onProgress?: (percent: number) => void
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch {
                        reject(new Error('Invalid response from Drive'));
                    }
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.ontimeout = () => reject(new Error('Upload timed out'));

            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
        });
    }

    /**
     * Make a file publicly accessible via link
     */
    static async makeFilePublic(fileId: string, accessToken: string): Promise<void> {
        const permissionUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;

        const response = await fetch(permissionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: 'reader',
                type: 'anyone'
            })
        });

        if (!response.ok) {
            console.warn('[GoogleDriveUploadService] Failed to set public permission, file may not be shareable');
        }
    }

    /**
     * Get file metadata from Drive
     */
    static async getFileMetadata(fileId: string, accessToken: string): Promise<DriveUploadResult | null> {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,webViewLink,thumbnailLink`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return {
            fileId: data.id,
            webViewLink: data.webViewLink,
            name: data.name,
            mimeType: data.mimeType,
            size: parseInt(data.size || '0'),
            thumbnailLink: data.thumbnailLink
        };
    }

    /**
     * Convert Drive upload result to TaskAttachment
     */
    static toTaskAttachment(
        result: DriveUploadResult,
        userId: string
    ): TaskAttachment {
        return {
            type: result.mimeType.startsWith('image/') ? 'image' :
                result.mimeType.startsWith('video/') ? 'video' : 'file',
            url: result.webViewLink,
            name: result.name,
            mimeType: result.mimeType,
            size: result.size,
            source: 'google_drive_upload' as TaskAttachmentSource,
            uploadedBy: userId,
            uploadedAt: serverTimestamp(),
            driveFileId: result.fileId,
            isPublicLink: true,
            thumbnailUrl: result.thumbnailLink
        };
    }

    /**
     * Check if user has Google Drive access
     * This checks if the access token can read Drive
     */
    static async hasAccess(accessToken: string): Promise<boolean> {
        if (!accessToken) return false;

        try {
            const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Delete a file from user's Drive
     */
    static async deleteFile(fileId: string, accessToken: string): Promise<boolean> {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.ok || response.status === 404;
        } catch {
            return false;
        }
    }
}
