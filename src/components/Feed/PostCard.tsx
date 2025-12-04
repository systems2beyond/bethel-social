'use client';

import React from 'react';
import { Post } from '@/types';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Facebook, Youtube, Pin } from 'lucide-react';
import Image from 'next/image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PostCardProps {
    post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
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

    const handleLike = () => {
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden mb-6 transition-shadow duration-300",
                post.pinned && "border-l-4 border-l-blue-500"
            )}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden relative ring-2 ring-gray-50">
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
                        <h3 className="font-semibold text-gray-900 tracking-tight">{post.author?.name || 'Bethel Metropolitan'}</h3>
                        <p className="text-xs text-gray-500 font-medium">{formatDate(post.timestamp)}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {post.pinned && <Pin className="w-4 h-4 text-blue-500 rotate-45" />}
                    {getIcon()}
                </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-3">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            </div>

            {/* Media */}
            {post.mediaUrl && (
                <div className="relative w-full aspect-[4/3] bg-gray-50">
                    <Image
                        src={post.mediaUrl}
                        alt="Post content"
                        fill
                        className="object-cover"
                    />
                </div>
            )}

            {/* Actions */}
            <div className="p-4 flex items-center justify-between border-t border-gray-50">
                <div className="flex items-center space-x-6">
                    <button
                        onClick={handleLike}
                        className={cn(
                            "flex items-center space-x-2 transition-colors group",
                            isLiked ? "text-red-500" : "text-gray-600 hover:text-red-500"
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
                    <button className="flex items-center space-x-2 text-gray-600 hover:text-blue-500 transition-colors">
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-sm font-medium">{post.comments || 0}</span>
                    </button>
                </div>
                <button className="text-gray-600 hover:text-gray-900 transition-colors">
                    <Share2 className="w-6 h-6" />
                </button>
            </div>
        </motion.div>
    );
};
