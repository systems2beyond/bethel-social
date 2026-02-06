import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    arrayUnion
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    MemberRegistrationFormConfig,
    MemberRegistrationField,
    MemberRegistrationSubmission,
    FamilyMemberEntry,
    FirestoreUser,
    Family
} from '@/types';
import { FamilyService } from './FamilyService';

const CONFIG_COLLECTION = 'member_registration_config';
const USERS_COLLECTION = 'users';
const SUBMISSIONS_COLLECTION = 'member_registrations';

// Default fields for a new member registration form
export const DEFAULT_REGISTRATION_FIELDS: MemberRegistrationField[] = [
    {
        id: 'firstName',
        type: 'name',
        label: 'First Name',
        placeholder: 'John',
        required: true,
        enabled: true,
        order: 0,
        mapsTo: 'firstName'
    },
    {
        id: 'lastName',
        type: 'name',
        label: 'Last Name',
        placeholder: 'Doe',
        required: true,
        enabled: true,
        order: 1,
        mapsTo: 'lastName'
    },
    {
        id: 'email',
        type: 'email',
        label: 'Email Address',
        placeholder: 'john@example.com',
        required: true,
        enabled: true,
        order: 2,
        mapsTo: 'email'
    },
    {
        id: 'phone',
        type: 'phone',
        label: 'Mobile Phone',
        placeholder: '(555) 123-4567',
        required: false,
        enabled: true,
        order: 3,
        mapsTo: 'phone'
    },
    {
        id: 'dateOfBirth',
        type: 'date',
        label: 'Date of Birth',
        required: false,
        enabled: true,
        order: 4,
        mapsTo: 'dateOfBirth'
    },
    {
        id: 'street1',
        type: 'short_answer',
        label: 'Street Address',
        placeholder: '123 Main St',
        required: false,
        enabled: true,
        order: 5,
        mapsTo: 'address'
    },
    {
        id: 'city',
        type: 'short_answer',
        label: 'City',
        placeholder: 'Springfield',
        required: false,
        enabled: true,
        order: 6,
        mapsTo: 'address'
    },
    {
        id: 'state',
        type: 'short_answer',
        label: 'State',
        placeholder: 'IL',
        required: false,
        enabled: true,
        order: 7,
        mapsTo: 'address'
    },
    {
        id: 'postalCode',
        type: 'short_answer',
        label: 'ZIP Code',
        placeholder: '62701',
        required: false,
        enabled: true,
        order: 8,
        mapsTo: 'address'
    },
    {
        id: 'howDidYouHear',
        type: 'select',
        label: 'How did you hear about us?',
        placeholder: 'Select an option',
        required: false,
        enabled: true,
        order: 9,
        options: [
            'Friend or Family',
            'Social Media',
            'Website',
            'Drive By',
            'Community Event',
            'Other'
        ],
        mapsTo: 'custom'
    }
];

// Default configuration
export const getDefaultRegistrationConfig = (churchId: string): Omit<MemberRegistrationFormConfig, 'id' | 'updatedAt' | 'updatedBy'> => ({
    churchId,
    branding: {
        formTitle: 'Member Registration',
        tagline: 'Join our church family today!',
        primaryColor: '#d97706', // amber-600 (copper theme)
        backgroundColor: '#09090b' // zinc-950
    },
    fields: DEFAULT_REGISTRATION_FIELDS,
    familyIntake: {
        enabled: true,
        askAboutSpouse: true,
        askAboutChildren: true,
        askAboutOtherFamily: false,
        maxFamilyMembers: 10
    },
    ministrySettings: {
        enabled: true,
        allowMultiple: true,
        ministryOptions: [] // Will be populated from church's ministries
    },
    successMessage: {
        title: 'Welcome to the Family!',
        subtitle: 'Thank you for registering. We\'re excited to have you join our church community.',
        showNextSteps: true,
        nextStepsContent: 'A member of our team will reach out to you soon to help you get connected.'
    },
    settings: {
        enabled: true,
        notifyAdmins: true,
        autoAssignToDistrict: false,
        defaultMembershipStage: 'visitor',
        requireEmailVerification: false,
        createUserAccount: false
    }
});

export class MemberRegistrationService {
    /**
     * Get the registration form config for a church
     */
    static async getConfig(churchId: string): Promise<MemberRegistrationFormConfig> {
        try {
            const docRef = doc(db, CONFIG_COLLECTION, churchId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return { ...docSnap.data(), id: docSnap.id } as MemberRegistrationFormConfig;
            }

            // Return default config if none exists
            return {
                id: churchId,
                ...getDefaultRegistrationConfig(churchId),
                updatedAt: null,
                updatedBy: ''
            };
        } catch (error) {
            console.error('Error fetching registration form config:', error);
            throw error;
        }
    }

    /**
     * Save the registration form config
     */
    static async saveConfig(
        churchId: string,
        config: Partial<Omit<MemberRegistrationFormConfig, 'id' | 'churchId' | 'updatedAt' | 'updatedBy'>>,
        userId: string
    ): Promise<void> {
        try {
            const docRef = doc(db, CONFIG_COLLECTION, churchId);

            await setDoc(docRef, {
                ...config,
                churchId,
                updatedAt: serverTimestamp(),
                updatedBy: userId
            }, { merge: true });
        } catch (error) {
            console.error('Error saving registration form config:', error);
            throw error;
        }
    }

    /**
     * Get config for public form (no auth required)
     */
    static async getPublicConfig(churchId: string): Promise<MemberRegistrationFormConfig | null> {
        try {
            const docRef = doc(db, CONFIG_COLLECTION, churchId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.settings?.enabled !== false) {
                    return { ...data, id: docSnap.id } as MemberRegistrationFormConfig;
                }
            }

            return null;
        } catch (error) {
            console.error('Error fetching public registration form config:', error);
            return null;
        }
    }

    /**
     * Search for existing members by email or phone
     */
    static async searchExistingMembers(
        churchId: string,
        searchTerm: string
    ): Promise<FirestoreUser[]> {
        try {
            const normalizedSearch = searchTerm.toLowerCase().trim();
            const results: FirestoreUser[] = [];

            // Search by email
            const emailQuery = query(
                collection(db, USERS_COLLECTION),
                where('churchId', '==', churchId),
                where('email', '==', normalizedSearch)
            );
            const emailSnap = await getDocs(emailQuery);
            emailSnap.docs.forEach(d => {
                results.push({ uid: d.id, ...d.data() } as FirestoreUser);
            });

            // Search by phone (normalized)
            const phoneNormalized = searchTerm.replace(/[^0-9]/g, '');
            if (phoneNormalized.length >= 10) {
                const phoneQuery = query(
                    collection(db, USERS_COLLECTION),
                    where('churchId', '==', churchId),
                    where('phoneNumber', '==', phoneNormalized)
                );
                const phoneSnap = await getDocs(phoneQuery);
                phoneSnap.docs.forEach(d => {
                    if (!results.find(r => r.uid === d.id)) {
                        results.push({ uid: d.id, ...d.data() } as FirestoreUser);
                    }
                });
            }

            return results;
        } catch (error) {
            console.error('Error searching members:', error);
            return [];
        }
    }

    /**
     * Process a member registration submission
     * Creates member(s), family, ministry assignments
     */
    static async processSubmission(
        submission: MemberRegistrationSubmission,
        config: MemberRegistrationFormConfig
    ): Promise<{
        primaryMemberId: string;
        familyId?: string;
        additionalMemberIds: string[];
    }> {
        try {
            const { primaryMember, familyMembers, churchId } = submission;

            // 1. Create primary member
            const primaryMemberId = await this.createMember({
                displayName: `${primaryMember.firstName} ${primaryMember.lastName}`,
                email: primaryMember.email || '',
                phoneNumber: primaryMember.phone,
                address: primaryMember.address,
                churchId,
                role: 'member',
                membershipStage: config.settings.defaultMembershipStage,
                servingIn: primaryMember.ministryInterests?.map(ministryId => ({
                    ministryId,
                    ministryName: '', // Will be populated later
                    role: 'member' as const,
                    startDate: serverTimestamp(),
                    status: 'active' as const
                })),
                customFields: primaryMember.customFields,
                createdAt: serverTimestamp()
            });

            const additionalMemberIds: string[] = [];
            let familyId: string | undefined;

            // 2. Handle family logic - check if linking to existing family first
            if (familyMembers && familyMembers.length > 0) {
                // IMPORTANT: Check if any existing family member already has a family
                // If so, join THAT family instead of creating a new one
                // This prevents split families (e.g., wife joins husband's family, then son should join same family)
                for (const familyMember of familyMembers) {
                    if (familyMember.isExisting && familyMember.existingMemberId) {
                        // Check if this existing member already has a family
                        const existingMemberDoc = await getDoc(doc(db, USERS_COLLECTION, familyMember.existingMemberId));
                        if (existingMemberDoc.exists()) {
                            const existingMemberData = existingMemberDoc.data();
                            if (existingMemberData.familyId) {
                                // Use the existing family!
                                familyId = existingMemberData.familyId;
                                console.log(`Joining existing family: ${familyId} (from member ${familyMember.existingMemberId})`);
                                break; // Found a family, no need to check others
                            }
                        }
                    }
                }

                // If no existing family found, create a new one
                if (!familyId) {
                    familyId = await FamilyService.createFamily({
                        churchId,
                        familyName: `${primaryMember.lastName} Family`,
                        headOfHouseholdId: primaryMemberId,
                        address: primaryMember.address
                    }, 'system');
                }

                // Update primary member with familyId (joins the family)
                await updateDoc(doc(db, USERS_COLLECTION, primaryMemberId), {
                    familyId
                });

                // 3. Process family members
                for (const familyMember of familyMembers) {
                    if (familyMember.isExisting && familyMember.existingMemberId) {
                        // Check if this member already has a familyId
                        const existingMemberDoc = await getDoc(doc(db, USERS_COLLECTION, familyMember.existingMemberId));
                        const existingMemberData = existingMemberDoc.exists() ? existingMemberDoc.data() : null;

                        // Only link if they don't already have this family (avoid duplicate updates)
                        if (!existingMemberData?.familyId || existingMemberData.familyId !== familyId) {
                            await FamilyService.linkMemberToFamily(
                                familyMember.existingMemberId,
                                familyId,
                                this.mapRelationshipToRole(familyMember.relationship)
                            );
                        }
                        additionalMemberIds.push(familyMember.existingMemberId);
                    } else {
                        // Create new family member
                        const newMemberId = await this.createMember({
                            displayName: `${familyMember.firstName} ${familyMember.lastName}`,
                            email: familyMember.email || '',
                            phoneNumber: familyMember.phone,
                            churchId,
                            role: 'member',
                            membershipStage: config.settings.defaultMembershipStage,
                            familyId,
                            servingIn: familyMember.ministryInterests?.map(ministryId => ({
                                ministryId,
                                ministryName: '',
                                role: 'member' as const,
                                startDate: serverTimestamp(),
                                status: 'active' as const
                            })),
                            createdAt: serverTimestamp()
                        });

                        // Link to family with proper role
                        await FamilyService.linkMemberToFamily(
                            newMemberId,
                            familyId,
                            this.mapRelationshipToRole(familyMember.relationship)
                        );
                        additionalMemberIds.push(newMemberId);
                    }
                }
            }

            // 4. Save submission record for tracking (clean to remove undefined values)
            await addDoc(collection(db, SUBMISSIONS_COLLECTION), this.cleanObject({
                ...submission,
                primaryMemberId,
                familyId,
                additionalMemberIds,
                processedAt: serverTimestamp(),
                status: 'completed'
            }));

            return {
                primaryMemberId,
                familyId,
                additionalMemberIds
            };
        } catch (error) {
            console.error('Error processing registration submission:', error);
            throw error;
        }
    }

    /**
     * Remove undefined values from object (Firestore doesn't accept undefined)
     */
    private static cleanObject(obj: any): any {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => this.cleanObject(item));

        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = this.cleanObject(value);
            }
        }
        return cleaned;
    }

    /**
     * Create a member document (without auth account)
     */
    private static async createMember(
        memberData: Partial<FirestoreUser> & { email: string; churchId: string }
    ): Promise<string> {
        // Generate a unique ID for the member
        const memberRef = doc(collection(db, USERS_COLLECTION));
        const memberId = memberRef.id;

        // Clean data to remove undefined values
        const cleanedData = this.cleanObject({
            uid: memberId,
            ...memberData,
            createdAt: serverTimestamp()
        });

        await setDoc(memberRef, cleanedData);

        return memberId;
    }

    /**
     * Map relationship to family role
     */
    private static mapRelationshipToRole(
        relationship: FamilyMemberEntry['relationship']
    ): 'head' | 'spouse' | 'child' | 'other' {
        switch (relationship) {
            case 'spouse':
                return 'spouse';
            case 'child':
                return 'child';
            default:
                return 'other';
        }
    }

    /**
     * Get all submissions for a church
     */
    static async getSubmissions(churchId: string): Promise<MemberRegistrationSubmission[]> {
        const q = query(
            collection(db, SUBMISSIONS_COLLECTION),
            where('churchId', '==', churchId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as MemberRegistrationSubmission));
    }
}
