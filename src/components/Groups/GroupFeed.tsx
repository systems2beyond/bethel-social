'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Post, GroupMember } from '@/types';
import { GroupsService } from '@/lib/groups';
import { PostCard } from '../Feed/PostCard'; // Assuming passing post prop
import { PostComposer } from '../Feed/PostComposer';
import { useAuth } from '@/context/AuthContext';
import { Loader2, PenSquare, User } from 'lucide-react';
import { useFeed } from '@/context/FeedContext';

interface GroupFeedProps {
    groupId: string;
    membership: GroupMember | null;
}

export function GroupFeed({ groupId, membership }: GroupFeedProps) {
    const { user } = useAuth();
    const { refreshTrigger } = useFeed();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isComposerOpen, setIsComposerOpen] = useState(false);

    // Intersection Observer for Infinite Scroll
    const observerTarget = useRef<HTMLDivElement>(null);

    const fetchPosts = useCallback(async (isInitial = false) => {
        try {
            if (isInitial) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const result = await GroupsService.getGroupPosts(
                groupId,
                isInitial ? null : lastVisible
            );

            if (isInitial) {
                setPosts(result.posts);
            } else {
                // Filter duplicates
                const newPosts = result.posts.filter(p => !posts.some(existing => existing.id === p.id));
                setPosts(prev => [...prev, ...newPosts]);
            }

            setLastVisible(result.lastVisible);
            setHasMore(result.posts.length === 10); // Assuming limit is 10
        } catch (error) {
            console.error('Error fetching group posts:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [groupId, lastVisible, posts]);

    // Initial load and refresh
    useEffect(() => {
        fetchPosts(true);
    }, [groupId, refreshTrigger]); // dependencies

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    fetchPosts(false);
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, fetchPosts]);

    const canPost = membership && membership.status === 'active';

    if (loading && posts.length === 0) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Create Post Trigger */}
            {canPost && (
                <button
                    onClick={() => setIsComposerOpen(true)}
                    className="w-full bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all duration-200 border border-gray-100 dark:border-zinc-800 text-left group"
                >
                    <div className="flex items-center space-x-4">
                        <div className="flex-1">
                            <div className="w-full h-11 bg-gray-100 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700/50 group-hover:border-gray-200 dark:group-hover:border-zinc-600 border border-transparent rounded-full flex items-center px-5 text-gray-500 dark:text-gray-400 transition-all duration-200">
                                <span className="text-base">Write something...</span>
                            </div>
                        </div>
                        <div className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors">
                            <PenSquare className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                    </div>
                </button>
            )}

            {/* Posts List */}
            <div className="space-y-6">
                {posts.length > 0 ? (
                    posts.map(post => (
                        <PostCard key={post.id} post={post} />
                    ))
                ) : (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>No posts yet. Be the first to share something!</p>
                    </div>
                )}
            </div>

            {/* Loading More Indicator */}
            {hasMore && (
                <div ref={observerTarget} className="flex justify-center p-4">
                    {loadingMore && <Loader2 className="w-6 h-6 animate-spin text-blue-600" />}
                </div>
            )}

            {/* Post Composer Modal */}
            <PostComposer
                isOpen={isComposerOpen}
                onClose={() => setIsComposerOpen(false)}
                groupId={groupId}
            />
        </div>
    );
}
