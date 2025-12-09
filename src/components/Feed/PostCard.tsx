'use client';

import React from 'react';
import { Post } from '@/types';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Facebook, Youtube, Pin, Sparkles, Play } from 'lucide-react';
import { CommentsSection } from './CommentsSection';
import { ShareMenu } from './ShareMenu';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { formatTextWithLinks } from '@/lib/utils';
import { collection, doc, deleteDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

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

interface VideoPlayerRef {
    play: () => void;
    pause: () => void;
}

const NativeVideoPlayer = React.forwardRef<VideoPlayerRef, { url: string; poster?: string }>(({ url, poster }, ref) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);

    React.useImperativeHandle(ref, () => ({
        play: () => {
            if (videoRef.current) {
                videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
            }
        },
        pause: () => {
            if (videoRef.current) {
                videoRef.current.pause();
            }
        }
    }));

    React.useEffect(() => {
        const handleFullscreenChange = () => {
            const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement;
            console.log('[NativePlayer] Fullscreen change:', fsElement === videoRef.current, fsElement);

            const isFullscreen = fsElement === videoRef.current;
            if (isFullscreen && videoRef.current) {
                console.log('[NativePlayer] Unmuting...');
                videoRef.current.muted = false;
            }
        };

        const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        events.forEach(event => document.addEventListener(event, handleFullscreenChange));

        return () => events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
    }, []);

    return (
        <div className="aspect-video bg-black">
            <video
                ref={videoRef}
                src={url}
                poster={poster}
                className="w-full h-full object-contain"
                controls
                playsInline
                loop
                muted
            />
        </div>
    );
});
NativeVideoPlayer.displayName = 'NativeVideoPlayer';

const YouTubeFeedPlayer = React.forwardRef<VideoPlayerRef, { url: string }>(({ url }, ref) => {
    const iframeRef = React.useRef<HTMLIFrameElement>(null);
    const [origin, setOrigin] = React.useState('');

    React.useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    React.useImperativeHandle(ref, () => ({
        play: () => {
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'playVideo',
                    args: []
                }), '*');
            }
        },
        pause: () => {
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'pauseVideo',
                    args: []
                }), '*');
            }
        }
    }));

    const videoId = React.useMemo(() => {
        if (url.includes('embed/')) return url.split('embed/')[1].split('?')[0];
        if (url.includes('v=')) return url.split('v=')[1].split('&')[0];
        if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
        return null;
    }, [url]);

    if (!videoId) return null;

    React.useEffect(() => {
        const handleFullscreenChange = () => {
            const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement;
            console.log('[YouTubePlayer] Fullscreen change:', fsElement === iframeRef.current, fsElement);

            const isFullscreen = fsElement === iframeRef.current;
            if (isFullscreen && iframeRef.current?.contentWindow) {
                console.log('[YouTubePlayer] Unmuting...');
                iframeRef.current.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'unMute',
                    args: []
                }), '*');
                iframeRef.current.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'setVolume',
                    args: [100]
                }), '*');
            }
        };

        const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        events.forEach(event => document.addEventListener(event, handleFullscreenChange));

        return () => events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
    }, []);

    return (
        <div className="aspect-video bg-black">
            <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&mute=1&controls=1&playsinline=1&rel=0&origin=${origin}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    );
});
YouTubeFeedPlayer.displayName = 'YouTubeFeedPlayer';

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
    const { registerPost, unregisterPost, reportVisibility } = useFeed();
    const { openLightbox } = useLightbox();
    const router = useRouter();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const videoPlayerRef = React.useRef<VideoPlayerRef>(null);

    // Register post with FeedContext
    React.useEffect(() => {
        registerPost(post.id, {
            content: post.content,
            mediaUrl: post.mediaUrl,
            type: post.type === 'video' || post.type === 'youtube' ? 'video' : (post.mediaUrl ? 'image' : 'text'),
            play: () => {
                console.log(`[PostCard] Playing video ${post.id}`, videoPlayerRef.current);
                videoPlayerRef.current?.play();
            },
            pause: () => {
                console.log(`[PostCard] Pausing video ${post.id}`);
                videoPlayerRef.current?.pause();
            }
        });
        return () => unregisterPost(post.id);
    }, [post, registerPost, unregisterPost]);

    // Observe visibility for ALL posts
    React.useEffect(() => {
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
    }, [post.id, reportVisibility]);

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
            case 'video':
                return <Facebook className="w-5 h-5 text-blue-600" />;
            default:
                return null;
        }
    };

    const { user, userData } = useAuth();
    const [isLiked, setIsLiked] = React.useState(false);
    const [likeCount, setLikeCount] = React.useState(post.likes || 0);
    const [showComments, setShowComments] = React.useState(false);

    // Real-time likes listener
    React.useEffect(() => {
        console.log(`[PostCard] Setting up likes listener for ${post.id}`);
        const likesRef = collection(db, 'posts', post.id, 'likes');
        const unsubscribe = onSnapshot(likesRef, (snapshot) => {
            console.log(`[PostCard] Likes update for ${post.id}: count=${snapshot.size}, user=${user?.uid}`);
            setLikeCount(snapshot.size);
            if (user) {
                const isLikedByMe = snapshot.docs.some(doc => doc.id === user.uid);
                console.log(`[PostCard] Is liked by me: ${isLikedByMe}`);
                setIsLiked(isLikedByMe);
            }
        }, (error) => {
            console.error(`[PostCard] Likes listener error for ${post.id}:`, error);
        });

        return () => unsubscribe();
    }, [post.id, user]);

    const handleLike = async () => {
        if (!user) {
            console.log('[PostCard] User not logged in, cannot like');
            // TODO: Trigger auth modal
            return;
        }

        console.log(`[PostCard] Toggling like for ${post.id}. Current state: ${isLiked}`);
        const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
        try {
            if (isLiked) {
                await deleteDoc(likeRef);
                console.log('[PostCard] Like removed');
            } else {
                await setDoc(likeRef, {
                    timestamp: serverTimestamp(),
                    userId: user.uid,
                    userName: userData?.displayName || user.displayName,
                    userPhoto: user.photoURL
                });
                console.log('[PostCard] Like added');
            }
        } catch (error) {
            console.error('[PostCard] Error updating like:', error);
        }
    };

    const handleAskAI = () => {
        const context = `[Context: Post by ${post.author?.name || 'Unknown'}\nContent: "${post.content}"\n${post.mediaUrl ? `Media URL: ${post.mediaUrl}` : ''}]`;
        const query = `Tell me about this post ${context}`;
        router.push(`/chat?q=${encodeURIComponent(query)}&postId=${post.id}`);
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
            {post.mediaUrl && (
                <div className="mt-2 relative aspect-video bg-black group">
                    {post.type === 'youtube' ? (
                        <YouTubeFeedPlayer ref={videoPlayerRef} url={post.mediaUrl} />
                    ) : post.type === 'video' ? (
                        <NativeVideoPlayer ref={videoPlayerRef} url={post.mediaUrl} poster={post.thumbnailUrl} />
                    ) : (
                        <div
                            className="w-full h-full cursor-pointer"
                            onClick={() => openLightbox(post.mediaUrl!, 'image')}
                        >
                            <img
                                src={post.mediaUrl}
                                alt="Post content"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <button
                    onClick={handleLike}
                    className={cn(
                        "flex items-center space-x-2 transition-colors group",
                        isLiked ? "text-red-500" : "text-gray-500 dark:text-gray-400 hover:text-red-500"
                    )}
                >
                    <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
                    <span className="text-sm font-medium">{likeCount}</span>
                </button>

                <button
                    onClick={() => setShowComments(!showComments)}
                    className={`flex items-center space-x-2 transition-colors ${showComments ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'}`}
                >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">
                        {post.comments && post.comments > 0 ? `${post.comments} Comments` : 'Comment'}
                    </span>
                </button>

                <button
                    onClick={handleAskAI}
                    className="flex items-center space-x-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full"
                >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Ask AI</span>
                </button>

                <ShareMenu post={post} />
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                    <CommentsSection post={post} />
                </div>
            )}
        </motion.div>
    );
};
