import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const SERVICE_VERSE_COLORS = {
    sundayService: '#6366f1',  // Indigo
    sermon:        '#ec4899',  // Pink
    bibleStudy:    '#10b981',  // Emerald
    sundaySchool:  '#f59e0b',  // Amber
} as const;

export const SERVICE_VERSE_LABELS = {
    sundayService: 'Sunday Service',
    sermon:        'Sermon',
    bibleStudy:    'Bible Study',
    sundaySchool:  'Sunday School',
} as const;

export type SessionKey = 'sundayService' | 'sermon' | 'bibleStudy' | 'sundaySchool';

export interface SessionVerses {
    enabled: boolean;
    verses: string[];
    expiresAt?: any;
}

export interface ServiceVersesData {
    sundayService: SessionVerses;
    sermon:        SessionVerses;
    bibleStudy:    SessionVerses;
    sundaySchool:  SessionVerses;
    updatedAt?: any;
    updatedBy?: string;
}

const DEFAULT_SESSION: SessionVerses = { enabled: false, verses: [] };

export const DEFAULT_SERVICE_VERSES_DATA: ServiceVersesData = {
    sundayService: { ...DEFAULT_SESSION },
    sermon:        { ...DEFAULT_SESSION },
    bibleStudy:    { ...DEFAULT_SESSION },
    sundaySchool:  { ...DEFAULT_SESSION },
};

export class ServiceVersesService {
    static docRef(churchId: string) {
        return doc(db, 'churches', churchId, 'settings', 'serviceVerses');
    }

    static async get(churchId: string): Promise<ServiceVersesData> {
        const snap = await getDoc(this.docRef(churchId));
        if (!snap.exists()) return { ...DEFAULT_SERVICE_VERSES_DATA };

        // Merge with defaults to handle new fields like 'sermon'
        const data = snap.data() as Partial<ServiceVersesData>;
        return {
            sundayService: data.sundayService || { ...DEFAULT_SESSION },
            sermon:        data.sermon || { ...DEFAULT_SESSION },
            bibleStudy:    data.bibleStudy || { ...DEFAULT_SESSION },
            sundaySchool:  data.sundaySchool || { ...DEFAULT_SESSION },
            updatedAt:     data.updatedAt,
            updatedBy:     data.updatedBy,
        };
    }

    static async save(
        churchId: string,
        userId: string,
        data: ServiceVersesData
    ): Promise<void> {
        await setDoc(
            this.docRef(churchId),
            {
                ...data,
                updatedAt: Timestamp.now(),
                updatedBy: userId,
            },
            { merge: true }
        );
    }

    static subscribe(
        churchId: string,
        callback: (data: ServiceVersesData) => void
    ): () => void {
        return onSnapshot(this.docRef(churchId), (snap) => {
            if (!snap.exists()) {
                callback({ ...DEFAULT_SERVICE_VERSES_DATA });
                return;
            }

            // Merge with defaults to handle new fields like 'sermon'
            const data = snap.data() as Partial<ServiceVersesData>;
            callback({
                sundayService: data.sundayService || { ...DEFAULT_SESSION },
                sermon:        data.sermon || { ...DEFAULT_SESSION },
                bibleStudy:    data.bibleStudy || { ...DEFAULT_SESSION },
                sundaySchool:  data.sundaySchool || { ...DEFAULT_SESSION },
                updatedAt:     data.updatedAt,
                updatedBy:     data.updatedBy,
            });
        });
    }
}
