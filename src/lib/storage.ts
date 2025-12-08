import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';

const storage = getStorage(app);

export const uploadMedia = async (file: File, path: string = 'posts'): Promise<string> => {
    try {
        const timestamp = Date.now();
        const uniqueName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, `${path}/${uniqueName}`);

        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading media:', error);
        throw error;
    }
};
