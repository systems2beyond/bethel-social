'use client';

import React, { useState, useEffect } from 'react';
import { Post } from '@/types';
import { PostCard } from './PostCard';
import { collection, query, orderBy, limit, getDocs, startAfter, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LiveStreamBanner } from './LiveStreamBanner';

export const SocialFeed: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = React.useRef<HTMLDivElement>(null);

    const [error, setError] = useState<string | null>(null);

    const [livePost, setLivePost] = useState<Post | null>(null);

    // Fetch Live Post
    useEffect(() => {
        const fetchLivePost = async () => {
            try {
                const q = query(collection(db, 'posts'), where('isLive', '==', true), limit(1));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    setLivePost({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Post);
                } else {
                    setLivePost(null);
                }
            } catch (e) {
                console.error("Error fetching live post:", e);
            }
        };

        fetchLivePost();
        // Poll for live status every minute
        const interval = setInterval(fetchLivePost, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchPosts = React.useCallback(async (isInitial = false) => {
        if ((!isInitial && loading) || loadingMore || (!isInitial && !hasMore)) return;

        try {
            setError(null);
            const postsRef = collection(db, 'posts');
            // Use stable sort with secondary ID field
            let q = query(postsRef, orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), limit(10));

            if (!isInitial && lastVisible) {
                setLoadingMore(true);
                // Use explicit field values for cursor
                q = query(postsRef, orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'), startAfter(lastVisible.timestamp, lastVisible.id), limit(10));
            } else {
                setLoading(true);
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setHasMore(false);
                setLoading(false);
                setLoadingMore(false);
                return;
            }

            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Post[];

            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            // Store explicit cursor values instead of snapshot
            setLastVisible({
                timestamp: lastDoc.data().timestamp,
                id: lastDoc.id
            });

            if (isInitial) {
                setPosts(fetchedPosts);
            } else {
                // Filter out duplicates just in case
                setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newPosts = fetchedPosts.filter(p => !existingIds.has(p.id));
                    return [...prev, ...newPosts];
                });
            }

            if (snapshot.docs.length < 10) {
                setHasMore(false);
            }

        } catch (error: any) {
            console.error("Error fetching posts:", error);
            setError(error.message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [lastVisible, hasMore, loading, loadingMore]);

    useEffect(() => {
        fetchPosts(true);
    }, []); // Initial load only

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    fetchPosts(false);
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [fetchPosts, hasMore, loading, loadingMore]);

    // Filter posts to remove duplicates of the live stream
    const filteredPosts = posts.filter(p => {
        if (!livePost) return true;
        // Remove the live post itself if it appears in the feed
        if (p.id === livePost.id) return false;
        // Remove posts that have the same media URL as the live post (e.g. Facebook cross-post)
        if (p.mediaUrl && livePost.mediaUrl && p.mediaUrl === livePost.mediaUrl) return false;
        // Also check if Facebook post content contains the YouTube link
        if (livePost.mediaUrl && p.content.includes(livePost.mediaUrl)) return false;
        return true;
    });

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Community Feed</h1>
                <p className="text-gray-500 dark:text-gray-400">Stay connected with Bethel Metropolitan</p>
            </div>

            {livePost && <LiveStreamBanner post={livePost} />}

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <div className="space-y-6">
                {filteredPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                ))}

                {/* Loading State & Infinite Scroll Target */}
                <div ref={observerTarget} className="h-10 flex justify-center items-center mt-4">
                    {(loading || loadingMore) && (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    )}
                </div>

                {/* Fallback Load More Button */}
                {hasMore && !loading && !loadingMore && (
                    <div className="text-center mt-4">
                        <button
                            onClick={() => fetchPosts(false)}
                            className="text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                            Load More
                        </button>
                    </div>
                )}

                {!hasMore && filteredPosts.length > 0 && (
                    <div className="text-center text-gray-500 mt-8">
                        No more posts to load
                    </div>
                )}
            </div>

        </div>
    );
};
