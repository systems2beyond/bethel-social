
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ChurchConfig {
    name?: string;
    stripeAccountStatus?: string;
    stripeAccountId?: string;
    features?: {
        giving?: boolean;
        groups?: boolean;
        events?: boolean;
    };
    campaigns?: Array<{
        id: string;
        name: string;
        description?: string;
        isActive: boolean;
    }>;
}

export function useChurchConfig(churchId: string = 'default_church') {
    const [config, setConfig] = useState<ChurchConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!churchId) return;

        const unsubscribe = onSnapshot(
            doc(db, 'churches', churchId),
            (doc) => {
                if (doc.exists()) {
                    setConfig(doc.data() as ChurchConfig);
                } else {
                    setConfig(null); // Or default config
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching church config:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [churchId]);

    return { config, loading, error };
}
