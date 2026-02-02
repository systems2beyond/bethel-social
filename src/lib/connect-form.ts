import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ConnectFormConfig, ConnectFormField } from '@/types';

const COLLECTION = 'connect_form_config';

// Default fields for a new connect form
export const DEFAULT_FIELDS: ConnectFormField[] = [
    {
        id: 'firstName',
        type: 'name',
        label: 'First Name',
        placeholder: 'John',
        required: true,
        enabled: true,
        order: 0
    },
    {
        id: 'lastName',
        type: 'name',
        label: 'Last Name',
        placeholder: 'Doe',
        required: true,
        enabled: true,
        order: 1
    },
    {
        id: 'phone',
        type: 'phone',
        label: 'Mobile Phone',
        placeholder: '(555) 123-4567',
        required: false,
        enabled: true,
        order: 2
    },
    {
        id: 'email',
        type: 'email',
        label: 'Email Address',
        placeholder: 'john@example.com',
        required: false,
        enabled: true,
        order: 3
    },
    {
        id: 'isFirstTime',
        type: 'checkbox',
        label: 'This is my first time visiting',
        required: false,
        enabled: true,
        order: 4
    },
    {
        id: 'prayerRequests',
        type: 'paragraph',
        label: 'How can we pray for you?',
        placeholder: 'Share a prayer request or just say hello...',
        required: false,
        enabled: true,
        order: 5
    }
];

// Default configuration
export const getDefaultConfig = (churchId: string): Omit<ConnectFormConfig, 'id' | 'updatedAt' | 'updatedBy'> => ({
    churchId,
    branding: {
        churchName: 'Bethel Metropolitan',
        tagline: "We're so glad you're here today.",
        primaryColor: '#2563eb', // blue-600
        backgroundColor: '#09090b' // zinc-950
    },
    fields: DEFAULT_FIELDS,
    successMessage: {
        title: 'Welcome Home!',
        subtitle: 'Thanks for connecting with us. Access your "Digital Connection Card" anytime.'
    },
    settings: {
        enabled: true,
        notifyAdmins: true
    }
});

export const ConnectFormService = {
    /**
     * Get the connect form config for a church
     * Returns default config if none exists
     */
    async getConfig(churchId: string): Promise<ConnectFormConfig> {
        try {
            const docRef = doc(db, COLLECTION, churchId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { ...docSnap.data(), id: docSnap.id } as ConnectFormConfig;
            }

            // Return default config if none exists
            return {
                id: churchId,
                ...getDefaultConfig(churchId),
                updatedAt: null,
                updatedBy: ''
            };
        } catch (error) {
            console.error('Error fetching connect form config:', error);
            throw error;
        }
    },

    /**
     * Save the connect form config
     */
    async saveConfig(
        churchId: string,
        config: Partial<Omit<ConnectFormConfig, 'id' | 'churchId' | 'updatedAt' | 'updatedBy'>>,
        userId: string
    ): Promise<void> {
        try {
            const docRef = doc(db, COLLECTION, churchId);

            await setDoc(docRef, {
                ...config,
                churchId,
                updatedAt: serverTimestamp(),
                updatedBy: userId
            }, { merge: true });
        } catch (error) {
            console.error('Error saving connect form config:', error);
            throw error;
        }
    },

    /**
     * Get config for public form (no auth required)
     * Uses a simplified query that works without authentication
     */
    async getPublicConfig(churchId: string): Promise<ConnectFormConfig | null> {
        try {
            const docRef = doc(db, COLLECTION, churchId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Only return if enabled
                if (data.settings?.enabled !== false) {
                    return { ...data, id: docSnap.id } as ConnectFormConfig;
                }
            }

            // Return null to trigger default fallback
            return null;
        } catch (error) {
            console.error('Error fetching public connect form config:', error);
            return null;
        }
    }
};
