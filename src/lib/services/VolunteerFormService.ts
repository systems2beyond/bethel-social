import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { VolunteerFormConfig, VolunteerFormField } from '@/types';

const COLLECTION = 'volunteer_signup_config';

// Default fields for a new volunteer signup form
export const DEFAULT_FIELDS: VolunteerFormField[] = [
    {
        id: 'name',
        type: 'name',
        label: 'Full Name',
        placeholder: 'John Doe',
        required: true,
        enabled: true,
        order: 0
    },
    {
        id: 'email',
        type: 'email',
        label: 'Email Address',
        placeholder: 'john@example.com',
        required: true,
        enabled: true,
        order: 1
    },
    {
        id: 'phone',
        type: 'phone',
        label: 'Phone Number',
        placeholder: '(555) 123-4567',
        required: false,
        enabled: true,
        order: 2
    },
    {
        id: 'ministryInterests',
        type: 'ministry_interests',
        label: 'Ministry Interests',
        required: false,
        enabled: true,
        order: 3
    },
    {
        id: 'availability',
        type: 'availability',
        label: 'Availability',
        required: false,
        enabled: true,
        order: 4
    },
    {
        id: 'skills',
        type: 'short_answer',
        label: 'Skills & Experience',
        placeholder: 'e.g., Teaching, Music, Technology, Cooking',
        required: false,
        enabled: true,
        order: 5
    },
    {
        id: 'message',
        type: 'paragraph',
        label: 'Anything else you\'d like us to know?',
        placeholder: 'Share any additional information...',
        required: false,
        enabled: true,
        order: 6
    }
];

// Default configuration
export const getDefaultConfig = (churchId: string): Omit<VolunteerFormConfig, 'id' | 'updatedAt' | 'updatedBy'> => ({
    churchId,
    branding: {
        formTitle: 'Volunteer With Us',
        tagline: 'Join our team and make a difference in our community.',
        primaryColor: '#10b981', // emerald-500
        backgroundColor: '#09090b' // zinc-950
    },
    fields: DEFAULT_FIELDS,
    successMessage: {
        title: 'Thank You!',
        subtitle: 'We\'ve received your volunteer interest form. A member of our team will be in touch soon.'
    },
    settings: {
        enabled: true,
        notifyAdmins: true
    }
});

export const VolunteerFormService = {
    /**
     * Get the volunteer form config for a church
     * Returns default config if none exists
     */
    async getConfig(churchId: string): Promise<VolunteerFormConfig> {
        try {
            const docRef = doc(db, COLLECTION, churchId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { ...docSnap.data(), id: docSnap.id } as VolunteerFormConfig;
            }

            // Return default config if none exists
            return {
                id: churchId,
                ...getDefaultConfig(churchId),
                updatedAt: null,
                updatedBy: ''
            };
        } catch (error) {
            console.error('Error fetching volunteer form config:', error);
            throw error;
        }
    },

    /**
     * Save the volunteer form config
     */
    async saveConfig(
        churchId: string,
        config: Partial<Omit<VolunteerFormConfig, 'id' | 'churchId' | 'updatedAt' | 'updatedBy'>>,
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
            console.error('Error saving volunteer form config:', error);
            throw error;
        }
    },

    /**
     * Get config for public form (no auth required)
     * Uses a simplified query that works without authentication
     */
    async getPublicConfig(churchId: string): Promise<VolunteerFormConfig | null> {
        try {
            const docRef = doc(db, COLLECTION, churchId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Only return if enabled
                if (data.settings?.enabled !== false) {
                    return { ...data, id: docSnap.id } as VolunteerFormConfig;
                }
            }

            // Return null to trigger default fallback
            return null;
        } catch (error) {
            console.error('Error fetching public volunteer form config:', error);
            return null;
        }
    }
};
