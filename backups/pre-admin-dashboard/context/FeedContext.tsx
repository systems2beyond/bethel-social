'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface ActivePost {
    id: string;
    content?: string;
    mediaUrl?: string;
    type?: 'video' | 'image' | 'text';
}

interface FeedContextType {
    registerPost: (id: string, data: { content?: string; mediaUrl?: string; type?: 'video' | 'image' | 'text'; play?: () => void; pause?: () => void }) => void;
    unregisterPost: (id: string) => void;
    reportVisibility: (id: string, ratio: number, rect: DOMRectReadOnly) => void;
    activePostId: string | null;
    activePost: ActivePost | null;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: React.ReactNode }) {
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [activePost, setActivePost] = useState<ActivePost | null>(null);

    const posts = useRef<Map<string, {
        content?: string;
        mediaUrl?: string;
        type?: 'video' | 'image' | 'text';
        play?: () => void;
        pause?: () => void;
        ratio: number;
        rect?: DOMRectReadOnly
    }>>(new Map());

    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
    const activePostIdRef = useRef<string | null>(null);

    const registerPost = useCallback((id: string, data: { content?: string; mediaUrl?: string; type?: 'video' | 'image' | 'text'; play?: () => void; pause?: () => void }) => {
        // Preserve existing ratio/rect if re-registering
        const existing = posts.current.get(id);
        posts.current.set(id, {
            ...data,
            ratio: existing?.ratio || 0,
            rect: existing?.rect
        });
    }, []);

    const unregisterPost = useCallback((id: string) => {
        posts.current.delete(id);
        if (activePostIdRef.current === id) {
            activePostIdRef.current = null;
            setActivePostId(null);
            setActivePost(null);
        }
    }, []);

    const reportVisibility = useCallback((id: string, ratio: number, rect: DOMRectReadOnly) => {
        const post = posts.current.get(id);
        if (!post) return;

        post.ratio = ratio;
        post.rect = rect;

        // Debounce the recalculation to prevent race conditions on load
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        debounceTimeout.current = setTimeout(() => {
            recalculateActivePost();
        }, 200);
    }, []);

    const recalculateActivePost = () => {
        const viewportHeight = window.innerHeight;

        let bestId: string | null = null;
        let maxScore = -1;

        posts.current.forEach((p, pid) => {
            if (!p.rect) return;

            // Score based primarily on visibility ratio (0 to 100)
            let score = p.ratio * 100;

            // Apply hysteresis: Give a significant bonus to the currently active post
            if (pid === activePostIdRef.current) {
                score += 50;
            }

            // Penalize very low visibility
            if (p.ratio < 0.2) {
                score = -1;
            }

            if (score > maxScore) {
                maxScore = score;
                bestId = pid;
            }
        });

        // Use ref for synchronous check to prevent race conditions
        if (activePostIdRef.current === bestId) return;

        // Aggressively pause ALL other videos to ensure strict single playback
        posts.current.forEach((p, pid) => {
            if (pid !== bestId && p.play) {
                p.pause?.();
            }
        });

        activePostIdRef.current = bestId;
        setActivePostId(bestId);

        // Play new video if it is a video
        if (bestId) {
            const newPost = posts.current.get(bestId);
            if (newPost) {
                if (newPost.play) {
                    newPost.play();
                }

                // Update active post data for AI context
                console.log('Setting active post:', bestId, newPost.mediaUrl);
                setActivePost({
                    id: bestId,
                    content: newPost.content,
                    mediaUrl: newPost.mediaUrl,
                    type: newPost.type
                });
            }
        } else {
            setActivePost(null);
        }
    };

    return (
        <FeedContext.Provider value={{ registerPost, unregisterPost, reportVisibility, activePostId, activePost }}>
            {children}
        </FeedContext.Provider>
    );
}

export function useFeed() {
    const context = useContext(FeedContext);
    if (context === undefined) {
        throw new Error('useFeed must be used within a FeedProvider');
    }
    return context;
}
