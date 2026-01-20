import * as nodemailer from 'nodemailer';

export interface EmailSettings {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName?: string;
    fromEmail?: string;
}

interface EmailOptions {
    to?: string | string[];
    bcc?: string | string[];
    cc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
}

export const createTransporter = (settings: EmailSettings) => {
    return nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.port === 465, // true for 465, false for other ports
        auth: {
            user: settings.user,
            pass: settings.pass,
        },
    });
};

export const sendEmail = async (settings: EmailSettings | null, options: EmailOptions) => {
    try {
        // Fallback or Mock Mode if settings are invalid/missing
        if (!settings || !settings.host || !settings.user || !settings.pass) {
            console.log('[MOCK EMAIL] Missing SMTP Settings. would send to:', options.to);
            console.log('[MOCK EMAIL] Subject:', options.subject);
            console.log('[MOCK EMAIL] Body:', options.text);
            return { success: true, mock: true };
        }

        const transporter = createTransporter(settings);
        const fromAddress = settings.fromEmail || settings.user;
        const fromName = settings.fromName || 'Church Admin';

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            to: options.to,
            bcc: options.bcc,
            cc: options.cc,
            subject: options.subject,
            text: options.text,
            html: options.html,
        });

        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't throw for individual failures in a batch, but let the caller handle it if needed
        return { success: false, error };
    }
};
