'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Ministry, MinistryRole } from '@/types';
import { VolunteerService } from '@/lib/volunteer-service';
import { useAuth } from '@/context/AuthContext';

interface MinistryContextType {
    ministries: Ministry[];
    loading: boolean;
    refreshMinistries: () => Promise<void>;
    addMinistry: (ministry: Omit<Ministry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateMinistry: (id: string, updates: Partial<Ministry>) => Promise<void>;
    addRole: (ministryId: string, role: Omit<MinistryRole, 'id'>) => Promise<void>;
}

const MinistryContext = createContext<MinistryContextType | undefined>(undefined);

export function MinistryProvider({ children }: { children: React.ReactNode }) {
    const { userData } = useAuth();
    const churchId = userData?.churchId;
    const [ministries, setMinistries] = useState<Ministry[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshMinistries = async () => {
        if (!churchId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await VolunteerService.getMinistries(churchId);
            setMinistries(data);
        } catch (error) {
            console.error('Error loading ministries:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshMinistries();
    }, [churchId]);

    const addMinistry = async (ministry: Omit<Ministry, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (!churchId) return;
        const id = await VolunteerService.createMinistry({ ...ministry, churchId });
        await refreshMinistries(); // Or optimistically update
    };

    const updateMinistry = async (id: string, updates: Partial<Ministry>) => {
        await VolunteerService.updateMinistry(id, updates);
        await refreshMinistries();
    };

    const addRole = async (ministryId: string, role: Omit<MinistryRole, 'id'>) => {
        await VolunteerService.addMinistryRole(ministryId, role);
        await refreshMinistries();
    };

    return (
        <MinistryContext.Provider value={{
            ministries,
            loading,
            refreshMinistries,
            addMinistry,
            updateMinistry,
            addRole
        }}>
            {children}
        </MinistryContext.Provider>
    );
}

export function useMinistry() {
    const context = useContext(MinistryContext);
    if (context === undefined) {
        throw new Error('useMinistry must be used within a MinistryProvider');
    }
    return context;
}
