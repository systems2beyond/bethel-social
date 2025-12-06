'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface LightboxContextType {
    openLightbox: (src: string, type?: 'image' | 'video') => void;
    closeLightbox: () => void;
}

const LightboxContext = createContext<LightboxContextType | undefined>(undefined);

export function LightboxProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSrc, setCurrentSrc] = useState<string | null>(null);
    const [currentType, setCurrentType] = useState<'image' | 'video'>('image');

    const openLightbox = useCallback((src: string, type: 'image' | 'video' = 'image') => {
        setCurrentSrc(src);
        setCurrentType(type);
        setIsOpen(true);
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }, []);

    const closeLightbox = useCallback(() => {
        setIsOpen(false);
        setCurrentSrc(null);
        document.body.style.overflow = 'unset';
    }, []);

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
                        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={closeLightbox}
                    >
                        <button
                            onClick={closeLightbox}
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
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
                                        alt="Enlarged view"
                                        fill
                                        className="object-contain"
                                        priority
                                    />
                                )}
                            </div>
                        </motion.div>
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
