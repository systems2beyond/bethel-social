
import { FirestoreUser, Ministry } from "@/types";

/**
 * Check if a role has admin or pastoral staff privileges
 */
export const isAdminOrPastoralStaff = (role?: string): boolean => {
    if (!role) return false;
    return ['super_admin', 'admin', 'pastoral_staff'].includes(role);
};

export const canAccessPeopleHub = (role?: string): boolean => {
    return isAdminOrPastoralStaff(role);
};

/**
 * Check if a user can access volunteer/ministry management for a specific ministry
 * - Admins/pastoral staff have global access
 * - Ministry leaders only have access to ministries they lead (leaderId === user.uid)
 */
export const canAccessVolunteerManagement = (user: FirestoreUser, ministry?: Ministry | null): boolean => {
    if (!user.role) return false;

    // High-level roles have global access
    if (isAdminOrPastoralStaff(user.role)) return true;

    // Ministry leaders have scoped access - only to ministries they lead
    if (user.role === 'ministry_leader' && ministry) {
        return ministry.leaderId === user.uid;
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
