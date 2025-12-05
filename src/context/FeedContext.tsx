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
        if (activePostId === id) {
            setActivePostId(null);
            setActivePost(null);
        }
    }, [activePostId]);

    const reportVisibility = useCallback((id: string, ratio: number, rect: DOMRectReadOnly) => {
        const post = posts.current.get(id);
        if (!post) return;

        post.ratio = ratio;
        post.rect = rect;

        recalculateActivePost();
    }, []);

    const recalculateActivePost = () => {
        const viewportHeight = window.innerHeight;
        const viewportCenter = viewportHeight / 2;

        let closestDistance = Infinity;
        let bestId: string | null = null;

        posts.current.forEach((p, pid) => {
            // Must be somewhat visible to be considered (e.g. 30%)
            // And must have a rect
            if (p.ratio < 0.3 || !p.rect) return;

            const postCenter = p.rect.top + (p.rect.height / 2);
            const distance = Math.abs(viewportCenter - postCenter);

            if (distance < closestDistance) {
                closestDistance = distance;
                bestId = pid;
            }
        });

        setActivePostId((prevId) => {
            if (prevId === bestId) return prevId;

            // Aggressively pause ALL other videos to ensure strict single playback
            posts.current.forEach((p, pid) => {
                if (pid !== bestId && p.play) {
                    p.pause?.();
                }
            });

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

            return bestId;
        });
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
