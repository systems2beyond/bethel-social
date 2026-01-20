export interface CommunicationSettings {
    host: string;
    port: number;
    user: string;
    pass: string; // Stored insecurely in Firestore for now (simulated encrypted), should be Secret Manager in real ent-grade
    fromName: string;
    fromEmail: string;
    secure: boolean;
}

export const DEFAULT_COMMUNICATION_SETTINGS: CommunicationSettings = {
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    pass: '',
    fromName: 'Bethel Social',
    fromEmail: '',
    secure: false,
};
