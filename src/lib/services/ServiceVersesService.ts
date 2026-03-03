import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const SERVICE_VERSE_COLORS = {
    sundayService: '#6366f1',
    bibleStudy:    '#10b981',
    sundaySchool:  '#f59e0b',
} as const;

export const SERVICE_VERSE_LABELS = {
    sundayService: 'Sunday Service',
    bibleStudy:    'Bible Study',
    sundaySchool:  'Sunday School',
} as const;

export type SessionKey = 'sundayService' | 'bibleStudy' | 'sundaySchool';

export interface SessionVerses {
    enabled: boolean;
    verses: string[];
    expiresAt?: any;
}

export interface ServiceVersesData {
    sundayService: SessionVerses;
    bibleStudy:    SessionVerses;
    sundaySchool:  SessionVerses;
    updatedAt?: any;
    updatedBy?: string;
}

const DEFAULT_SESSION: SessionVerses = { enabled: false, verses: [] };

export const DEFAULT_SERVICE_VERSES_DATA: ServiceVersesData = {
    sundayService: { ...DEFAULT_SESSION },
    bibleStudy:    { ...DEFAULT_SESSION },
    sundaySchool:  { ...DEFAULT_SESSION },
};

export class ServiceVersesService {
    static docRef(churchId: string) {
        return doc(db, 'churches', churchId, 'settings', 'serviceVerses');
    }

    static async get(churchId: string): Promise<ServiceVersesData> {
        const snap = await getDoc(this.docRef(churchId));
        return snap.exists() ? (snap.data() as ServiceVersesData) : { ...DEFAULT_SERVICE_VERSES_DATA };
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
            callback(
                snap.exists()
                    ? (snap.data() as ServiceVersesData)
                    : { ...DEFAULT_SERVICE_VERSES_DATA }
            );
        });
    }
}
