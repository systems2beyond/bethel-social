'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Play, Radio, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useBible } from '@/context/BibleContext';
import { Post } from '@/types';

interface LiveStreamBannerProps {
    post: Post;
    onDismiss?: () => void;
}

export const LiveStreamBanner = ({ post, onDismiss }: LiveStreamBannerProps) => {
    const { openVideo } = useBible();

    const { userData } = useAuth();
    const [isEnding, setIsEnding] = React.useState(false);

    const handleEndLive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to end this live stream? This will remove the banner for everyone.')) return;

        setIsEnding(true);
        try {
            const postRef = doc(db, 'posts', post.id);
            await updateDoc(postRef, {
                isLive: false,
                pinned: false
            });
            if (onDismiss) onDismiss();
        } catch (error) {
            console.error('Error ending live stream:', error);
            alert('Failed to end live stream');
        } finally {
            setIsEnding(false);
        }
    };

    const handleWatch = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        openVideo({
            url: post.mediaUrl!,
            title: post.content ? post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '') : 'Live Stream',
            provider: post.type === 'youtube' ? 'youtube' : 'native'
        });
    };

    if (!post.mediaUrl) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-red-800 text-white shadow-xl cursor-pointer group"
            onClick={() => handleWatch()}
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
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-3">
                        <div className="inline-flex items-center gap-2 bg-red-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                            <Radio className="w-3 h-3" />
                            Live Now
                        </div>
                        {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
                            <button
                                onClick={handleEndLive}
                                disabled={isEnding}
                                className="px-3 py-1 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white text-xs rounded-lg transition-colors flex items-center gap-2 border border-white/10 z-10"
                            >
                                <XCircle className="w-3 h-3" />
                                {isEnding ? 'Ending...' : 'End Live Stream'}
                            </button>
                        )}
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
                        {post.content.split('\n')[0]} {/* Use first line as title */}
                    </h2>

                    <p className="text-red-100 line-clamp-2 text-sm md:text-base">
                        Join us for worship and fellowship. Click to watch live.
                    </p>

                    <button
                        onClick={handleWatch}
                        className="mt-4 flex items-center space-x-2 bg-white text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-md"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        <span>Watch Live</span>
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
