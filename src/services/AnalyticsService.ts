import { getAnalytics, logEvent, Analytics } from 'firebase/analytics';
import { app } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

// Initialize Analytics (safely for server-side)
let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
    try {
        analytics = getAnalytics(app);
    } catch (e) {
        console.warn('Analytics initialization failed:', e);
    }
}

export type EventSeverity = 'critical' | 'high' | 'medium' | 'low';

export const AnalyticsService = {
    // 1. Core GA4 Events (Internal Wrapper)
    logEvent: (eventName: string, params?: Record<string, any>) => {
        if (analytics) {
            logEvent(analytics, eventName, params);
        }
    },

    // 2. Daily Stats Aggregation (Firebase Console Dashboard)
    _incrementDailyStat: async (updates: Record<string, any>) => {
        const dateStr = new Date().toISOString().split('T')[0];
        const statsRef = doc(db, 'analytics_stats', `daily_summary_${dateStr}`);
        const costPerWrite = 0.0000018;

        try {
            await setDoc(statsRef, {
                ...updates,
                date: dateStr,
                last_updated: serverTimestamp(),
                estimated_cost_usd: increment(updates.estimated_cost_usd ? 0 : costPerWrite) // Avoid double counting if passed
            }, { merge: true });
        } catch (e) {
            console.error('Failed to update daily stats', e);
        }
    },

    // -------------------------------------------------------------------------
    // 3. PAGE VIEW EVENTS (page_view)
    // -------------------------------------------------------------------------
    logPageLoad: (path: string, route?: string, userRole: string = 'guest') => {
        AnalyticsService.logEvent('page_view', {
            page_path: path,
            route_name: route || path,
            user_role: userRole
        });
    },

    // -------------------------------------------------------------------------
    // 4. BIBLE INTERACTION EVENTS (bible_*)
    // -------------------------------------------------------------------------
    logBibleInteraction: async (
        action: 'view' | 'search' | 'share' | 'copy' | 'highlight' | 'note_add',
        metadata: { book?: string, chapter?: string, verse?: string, translation?: string, plan_id?: string }
    ) => {
        // Strict Naming: bible_view, bible_highlight, etc.
        const eventName = `bible_${action}`;
        AnalyticsService.logEvent(eventName, metadata);

        // Trending Stats Aggregation (only for views/highlights)
        if (action === 'view' && metadata.book && metadata.chapter) {
            await AnalyticsService._incrementDailyStat({
                [`trending_verses.${metadata.book} ${metadata.chapter}`]: increment(1),
                total_bible_views: increment(1)
            });
        }
    },

    // -------------------------------------------------------------------------
    // 5. COLLABORATION EVENTS (collab_*)
    // -------------------------------------------------------------------------
    logCollabSession: async (
        action: 'created' | 'joined' | 'note_added' | 'note_edited' | 'closed',
        sessionId: string,
        metadata?: { participants_count?: number }
    ) => {
        const eventName = `collab_${action}`;
        AnalyticsService.logEvent(eventName, { session_id: sessionId, ...metadata });

        if (action === 'created') {
            await AnalyticsService._incrementDailyStat({
                total_sessions_started: increment(1)
            });
        }
    },

    // -------------------------------------------------------------------------
    // 6. SYSTEM & ERROR EVENTS (error_*, app_*)
    // -------------------------------------------------------------------------
    logError: async (
        message: string,
        severity: EventSeverity = 'medium',
        context?: { feature_area?: string, stack?: string, fatal?: boolean }
    ) => {
        // 1. GA4 Exception (Standard)
        AnalyticsService.logEvent('exception', {
            description: message,
            fatal: context?.fatal || false
        });

        // 2. Custom Error Event (Detailed Analysis)
        AnalyticsService.logEvent('error_event', {
            message,
            severity,
            feature_area: context?.feature_area || 'unknown',
            stack_hash: context?.stack ? btoa(context.stack).substring(0, 16) : 'none',
            is_blocking: severity === 'critical'
        });

        // 3. Update Daily Error Stats
        await AnalyticsService._incrementDailyStat({
            total_errors: increment(1),
            [`errors_by_severity.${severity}`]: increment(1)
        });
    }
};
