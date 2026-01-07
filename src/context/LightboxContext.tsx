'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface LightboxContextType {
    openLightbox: (src: string | string[], type?: 'image' | 'video', initialIndex?: number) => void;
    closeLightbox: () => void;
}

const LightboxContext = createContext<LightboxContextType | undefined>(undefined);

export function LightboxProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSrc, setCurrentSrc] = useState<string | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentType, setCurrentType] = useState<'image' | 'video'>('image');

    const openLightbox = useCallback((srcOrImages: string | string[], type: 'image' | 'video' = 'image', initialIndex = 0) => {
        if (Array.isArray(srcOrImages)) {
            setImages(srcOrImages);
            setCurrentIndex(initialIndex);
            setCurrentSrc(srcOrImages[initialIndex]);
        } else {
            setImages([srcOrImages]);
            setCurrentIndex(0);
            setCurrentSrc(srcOrImages);
        }
        setCurrentType(type);
        setIsOpen(true);
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }, []);

    const closeLightbox = useCallback(() => {
        setIsOpen(false);
        setCurrentSrc(null);
        setImages([]);
        setCurrentIndex(0);
        document.body.style.overflow = 'unset';
    }, []);

    const nextImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (images.length > 1) {
            const nextIndex = (currentIndex + 1) % images.length;
            setCurrentIndex(nextIndex);
            setCurrentSrc(images[nextIndex]);
        }
    }, [currentIndex, images]);

    const prevImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (images.length > 1) {
            const prevIndex = (currentIndex - 1 + images.length) % images.length;
            setCurrentIndex(prevIndex);
            setCurrentSrc(images[prevIndex]);
        }
    }, [currentIndex, images]);

    // Keyboard navigation
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextImage, prevImage, closeLightbox]);

    const iframeRef = React.useRef<HTMLIFrameElement>(null);

    React.useEffect(() => {
        if (isOpen && currentType === 'video' && currentSrc) {
            // Attempt to unmute multiple times to catch different load states
            const times = [500, 1000, 2000];
            const timeouts: NodeJS.Timeout[] = [];

            times.forEach(t => {
                timeouts.push(setTimeout(() => {
                    if (iframeRef.current?.contentWindow) {
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
                }, t));
            });

            return () => timeouts.forEach(clearTimeout);
        }
    }, [isOpen, currentType, currentSrc]);

    return (
        <LightboxContext.Provider value={{ openLightbox, closeLightbox }}>
            {children}
            <AnimatePresence>
                {isOpen && currentSrc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm group"
                        onClick={closeLightbox}
                    >
                        <button
                            onClick={closeLightbox}
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
                        >
                            <X className="w-8 h-8" />
                        </button>

                        {/* Navigation Buttons */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 hidden md:block"
                                >
                                    <ChevronLeft className="w-8 h-8" />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 hidden md:block"
                                >
                                    <ChevronRight className="w-8 h-8" />
                                </button>
                            </>
                        )}

                        <motion.div
                            key={currentSrc} // Key change triggers animation
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="relative w-full h-full max-w-5xl max-h-[90vh] flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative w-full h-full flex items-center justify-center">
                                {currentType === 'video' ? (
                                    <iframe
                                        ref={iframeRef}
                                        src={(() => {
                                            if (!currentSrc) return '';
                                            let newSrc = currentSrc;
                                            if (newSrc.includes('watch?v=')) {
                                                newSrc = newSrc.replace('watch?v=', 'embed/').split('&')[0];
                                            }

                                            const hasParams = newSrc.includes('?');
                                            const separator = hasParams ? '&' : '?';
                                            const params = [];

                                            if (!newSrc.includes('autoplay=')) params.push('autoplay=1');
                                            if (!newSrc.includes('mute=')) params.push('mute=0');
                                            if (!newSrc.includes('enablejsapi=')) params.push('enablejsapi=1');

                                            return params.length > 0 ? `${newSrc}${separator}${params.join('&')}` : newSrc;
                                        })()}
                                        className="w-full h-full max-w-4xl aspect-video rounded-lg"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <Image
                                        src={currentSrc || ''}
                                        alt={`View ${currentIndex + 1}`}
                                        fill
                                        className="object-contain"
                                        priority
                                    />
                                )}
                            </div>
                        </motion.div>

                        {/* Image Counter */}
                        {images.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-white text-sm font-medium">
                                {currentIndex + 1} / {images.length}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </LightboxContext.Provider>
    );
}

export function useLightbox() {
    const context = useContext(LightboxContext);
    if (context === undefined) {
        throw new Error('useLightbox must be used within a LightboxProvider');
    }
    return context;
}
