
import { FirestoreUser } from "@/types";

export const canAccessPeopleHub = (role?: string): boolean => {
    if (!role) return false;
    return ['super_admin', 'admin', 'pastoral_staff'].includes(role);
};

export const canAccessVolunteerManagement = (user: FirestoreUser, ministryId?: string): boolean => {
    if (!user.role) return false;

    // High-level roles have global access
    if (['super_admin', 'admin', 'pastoral_staff'].includes(user.role)) return true;

    // Ministry leaders have scoped access
    if (user.role === 'ministry_leader' && ministryId) {
        // Check if user leads this specific ministry
        // This assumes user.servingIn is populated or we check against the ministry document leaderId
        // For now, we return true if they are a ministry leader and a ministryID is present, 
        // real validation should happen data-side or with a more complex check if we have the ministry object
        return true;
    }

    return false;
};

export const canAccessLifeEvents = (role?: string): boolean => {
    if (!role) return false;
    return ['super_admin', 'admin', 'pastoral_staff'].includes(role);
};

export const canViewPastoralNotes = (role?: string): boolean => {
    if (!role) return false;
    return ['super_admin', 'admin', 'pastoral_staff'].includes(role);
};
