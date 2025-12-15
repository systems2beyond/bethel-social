'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Radio } from 'lucide-react';
import Image from 'next/image';
import { useLightbox } from '@/context/LightboxContext';

import { Post } from '@/types';

interface LiveStreamBannerProps {
    post: Post;
}

export const LiveStreamBanner = ({ post }: LiveStreamBannerProps) => {
    const { openLightbox } = useLightbox();

    if (!post.mediaUrl) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-red-800 text-white shadow-xl cursor-pointer group"
            onClick={() => openLightbox(post.mediaUrl!, 'video')}
        >
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

            <div className="relative flex flex-col md:flex-row items-center p-6 gap-6">
                {/* Thumbnail Section */}
                <div className="relative w-full md:w-64 aspect-video rounded-lg overflow-hidden shadow-lg bg-black/50 flex-shrink-0">
                    {post.thumbnailUrl ? (
                        <Image
                            src={post.thumbnailUrl}
                            alt="Live Stream"
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-12 h-12 text-white/50" />
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 text-white fill-current" />
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-red-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 animate-pulse">
                        <Radio className="w-3 h-3" />
                        Live Now
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
                        {post.content.split('\n')[0]} {/* Use first line as title */}
                    </h2>

                    <p className="text-red-100 line-clamp-2 text-sm md:text-base">
                        Join us for worship and fellowship. Click to watch live.
                    </p>
                </div>
            </div>
        </motion.div>
    );
};
