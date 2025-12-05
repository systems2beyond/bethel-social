'use client';

import React from 'react';
import { Post } from '@/types';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Facebook, Youtube, Pin } from 'lucide-react';
import Image from 'next/image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { formatTextWithLinks } from '@/lib/utils';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PostCardProps {
    post: Post;
}

import { useFeed } from '@/context/FeedContext';
import { useLightbox } from '@/context/LightboxContext';

const VideoPlayer = ({ url, postId }: { url: string; postId: string }) => {
    const iframeRef = React.useRef<HTMLIFrameElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const { registerPost, unregisterPost, reportVisibility } = useFeed();

    React.useEffect(() => {
        // Register video with context
        registerPost(
            postId,
            {
                type: 'video',
                mediaUrl: url,
                play: () => {
                    if (iframeRef.current && iframeRef.current.contentWindow) {
                        iframeRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    }
                },
                pause: () => {
                    if (iframeRef.current && iframeRef.current.contentWindow) {
                        iframeRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    }
                }
            }
        );

        return () => unregisterPost(postId);
    }, [postId, registerPost, unregisterPost, url]);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    reportVisibility(postId, entry.intersectionRatio, entry.boundingClientRect);
                });
            },
            { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [postId, reportVisibility]);

    // Ensure enablejsapi=1 is present
    const embedUrl = url.includes('?')
        ? `${url}&enablejsapi=1`
        : `${url}?enablejsapi=1`;

    return (
        <div ref={containerRef} className="aspect-video">
            <iframe
                ref={iframeRef}
                src={embedUrl}
                title="Post video"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    );
};

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
    const { registerPost, unregisterPost, reportVisibility } = useFeed();
    const { openLightbox } = useLightbox();
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Register non-video posts too (for AI context)
    React.useEffect(() => {
        const isVideo = post.mediaUrl && (post.mediaUrl.includes('youtube.com') || post.mediaUrl.includes('youtu.be'));

        if (!isVideo) {
            registerPost(post.id, {
                content: post.content,
                mediaUrl: post.mediaUrl,
                type: post.mediaUrl ? 'image' : 'text'
            });
            return () => unregisterPost(post.id);
        }
    }, [post, registerPost, unregisterPost]);

    // Observe visibility for non-video posts
    React.useEffect(() => {
        const isVideo = post.mediaUrl && (post.mediaUrl.includes('youtube.com') || post.mediaUrl.includes('youtu.be'));
        if (isVideo) return; // VideoPlayer handles its own observation

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    reportVisibility(post.id, entry.intersectionRatio, entry.boundingClientRect);
                });
            },
            { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [post, reportVisibility]);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
        });
    };

    const getIcon = () => {
        switch (post.type) {
            case 'facebook':
                return <Facebook className="w-5 h-5 text-blue-600" />;
            case 'youtube':
                return <Youtube className="w-5 h-5 text-red-600" />;
            default:
                return null;
        }
    };

    const [isLiked, setIsLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(post.likes || 0);
    const [imageError, setImageError] = React.useState(false);

    const handleLike = () => {
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    };

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:shadow-md border border-gray-100 dark:border-zinc-800 overflow-hidden mb-6 transition-all duration-300",
                post.pinned && "border-l-4 border-l-blue-500"
            )}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative ring-2 ring-gray-50 dark:ring-zinc-800">
                        {post.author?.avatarUrl ? (
                            <Image
                                src={post.author.avatarUrl}
                                alt={post.author.name}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                {post.author?.name?.[0] || 'B'}
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{post.author?.name || 'Bethel Metropolitan'}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{formatDate(post.timestamp)}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {post.pinned && <Pin className="w-4 h-4 text-blue-500 rotate-45" />}
                    {getIcon()}
                </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-3">
                <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {formatTextWithLinks(post.content)}
                </p>
            </div>

            {/* Media */}
            {post.mediaUrl && !imageError && (
                <div className="relative w-full bg-gray-50 dark:bg-zinc-800 overflow-hidden">
                    {post.mediaUrl.includes('youtube.com') || post.mediaUrl.includes('youtu.be') ? (
                        <VideoPlayer url={post.mediaUrl} postId={post.id} />
                    ) : (
                        <div
                            className="relative aspect-[4/3] cursor-pointer group"
                            onClick={() => post.mediaUrl && openLightbox(post.mediaUrl)}
                        >
                            <Image
                                src={post.mediaUrl}
                                alt="Post content"
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={() => setImageError(true)}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">Click to expand</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Fallback for empty posts (no content + broken image) */}
            {(!post.content && (!post.mediaUrl || imageError)) && (
                <div className="px-4 pb-4">
                    <a
                        href={post.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                    >
                        <Facebook className="w-4 h-4" />
                        View original post on Facebook
                    </a>
                </div>
            )}

            {/* Actions */}
            <div className="p-4 flex items-center justify-between border-t border-gray-50 dark:border-zinc-800">
                <div className="flex items-center space-x-6">
                    <button
                        onClick={handleLike}
                        className={cn(
                            "flex items-center space-x-2 transition-colors group",
                            isLiked ? "text-red-500" : "text-gray-600 dark:text-gray-400 hover:text-red-500"
                        )}
                    >
                        <motion.div
                            whileTap={{ scale: 0.8 }}
                            animate={isLiked ? { scale: [1, 1.2, 1] } : {}}
                        >
                            <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
                        </motion.div>
                        <span className="text-sm font-medium">{likeCount}</span>
                    </button>
                    <button className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors">
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-sm font-medium">{post.comments || 0}</span>
                    </button>
                </div>
                <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    <Share2 className="w-6 h-6" />
                </button>
            </div>
        </motion.div>
    );
};
