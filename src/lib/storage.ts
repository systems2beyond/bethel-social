import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';

const storage = getStorage(app);

export const uploadMedia = async (file: File | Blob, path: string = 'posts', fileName?: string): Promise<string> => {
    try {
        const timestamp = Date.now();
        const actualFileName = fileName || (file as File).name || `upload_${timestamp}.png`;
        const uniqueName = `${timestamp}-${actualFileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, `${path}/${uniqueName}`);

        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading media:', error);
        throw error;
    }
};

/**
 * Converts a data URL (base64) to a Blob.
 * Useful for uploading generated images or processed stickers.
 */
export function dataURLtoBlob(dataurl: string): Blob {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}
