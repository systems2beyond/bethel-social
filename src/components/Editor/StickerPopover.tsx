'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Upload, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadMedia, dataURLtoBlob } from '@/lib/storage';

interface StickerPopoverProps {
    onInsert: (url: string) => void;
    onClose: () => void;
}

export function StickerPopover({ onInsert, onClose, triggerRef }: StickerPopoverProps & { triggerRef?: React.RefObject<any> }) {
    const [activeTab, setActiveTab] = useState<'generate' | 'upload'>('generate');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [uploadUrl, setUploadUrl] = useState<string | null>(null);
    const [uploadFileObject, setUploadFileObject] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [position, setPosition] = useState<{ top: number, left: number } | null>(null);

    // Calculate position on mount if triggerRef is provided (Desktop)
    React.useEffect(() => {
        if (triggerRef?.current && window.innerWidth >= 640) { // sm breakpoint
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: rect.left
            });
        }
    }, [triggerRef]);

    // Toggle body class for mobile layering fix
    React.useEffect(() => {
        document.body.classList.add('modal-open');
        return () => document.body.classList.remove('modal-open');
    }, []);

    const processImage = (imageUrl: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                // Target a higher resolution for processing to ensure smooth edges
                const targetSize = 1024;
                const scale = Math.max(1, targetSize / Math.max(img.width, img.height));
                const width = Math.floor(img.width * scale);
                const height = Math.floor(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(imageUrl);
                    return;
                }
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                const totalPixels = width * height;

                // 1. Create a binary mask based on threshold
                const threshold = 250;
                const binaryMask = new Uint8Array(totalPixels);

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    if (r > threshold && g > threshold && b > threshold) {
                        binaryMask[i / 4] = 1;
                    } else {
                        binaryMask[i / 4] = 0;
                    }
                }

                // 2. Flood Fill from corners
                const visited = new Uint8Array(totalPixels);
                const queue: number[] = [];
                const corners = [0, width - 1, (height - 1) * width, (height - 1) * width + width - 1];
                corners.forEach(idx => {
                    if (binaryMask[idx] === 1) {
                        queue.push(idx);
                        visited[idx] = 1;
                    }
                });

                while (queue.length > 0) {
                    const idx = queue.shift()!;
                    const x = idx % width;
                    const y = Math.floor(idx / width);
                    const neighbors = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }];

                    for (const { dx, dy } of neighbors) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = ny * width + nx;
                            if (binaryMask[nIdx] === 1 && visited[nIdx] === 0) {
                                visited[nIdx] = 1;
                                queue.push(nIdx);
                            }
                        }
                    }
                }

                const subjectMask = new Uint8Array(totalPixels);
                for (let i = 0; i < totalPixels; i++) {
                    subjectMask[i] = visited[i] === 0 ? 1 : 0;
                }

                // 3. Dilate (Scaled Border)
                // 12px at 512 -> ~24px at 1024
                const baseBorderSize = 12;
                const borderSize = Math.floor(baseBorderSize * scale);

                let currentMask = new Uint8Array(subjectMask);
                let nextMask = new Uint8Array(subjectMask);

                // Optimization: Only run dilation if needed, but for stickers we always want border
                for (let p = 0; p < borderSize; p++) {
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = y * width + x;
                            if (currentMask[idx] === 1) {
                                if (x > 0) nextMask[idx - 1] = 1;
                                if (x < width - 1) nextMask[idx + 1] = 1;
                                if (y > 0) nextMask[idx - width] = 1;
                                if (y < height - 1) nextMask[idx + width] = 1;
                            }
                        }
                    }
                    currentMask.set(nextMask);
                }

                // 3.5. Smooth the edges (High Quality Blur)
                const smoothCanvas = document.createElement('canvas');
                smoothCanvas.width = width;
                smoothCanvas.height = height;
                const smoothCtx = smoothCanvas.getContext('2d');

                if (smoothCtx) {
                    const maskData = smoothCtx.createImageData(width, height);
                    for (let i = 0; i < totalPixels; i++) {
                        const val = currentMask[i] === 1 ? 255 : 0;
                        maskData.data[i * 4] = val;
                        maskData.data[i * 4 + 1] = val;
                        maskData.data[i * 4 + 2] = val;
                        maskData.data[i * 4 + 3] = 255;
                    }
                    smoothCtx.putImageData(maskData, 0, 0);

                    // Strong Blur for rounding (Scaled)
                    const blurRadius = Math.max(4, 6 * scale);
                    smoothCtx.filter = `blur(${blurRadius}px)`;
                    smoothCtx.globalCompositeOperation = 'copy';
                    smoothCtx.drawImage(smoothCanvas, 0, 0);
                    smoothCtx.filter = 'none';

                    // Threshold
                    let imageData = smoothCtx.getImageData(0, 0, width, height);
                    let data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const alpha = data[i];
                        const val = alpha > 128 ? 255 : 0;
                        data[i] = val;
                        data[i + 1] = val;
                        data[i + 2] = val;
                        data[i + 3] = 255;
                    }
                    smoothCtx.putImageData(imageData, 0, 0);

                    // Anti-aliasing Blur (Scaled)
                    // Use a slightly stronger AA blur for mobile smoothness
                    const aaBlur = Math.max(1, 1.5 * scale);
                    smoothCtx.filter = `blur(${aaBlur}px)`;
                    smoothCtx.drawImage(smoothCanvas, 0, 0);
                    smoothCtx.filter = 'none';

                    const finalData = smoothCtx.getImageData(0, 0, width, height).data;
                    for (let i = 0; i < totalPixels; i++) {
                        // Soft threshold for AA
                        if (finalData[i * 4] > 20) { // Lower threshold to catch soft edges
                            currentMask[i] = 1;
                        } else {
                            currentMask[i] = 0;
                        }
                    }
                }

                // 4. Apply to Image
                // We need to redraw the original image at the new scale first if we haven't
                // (We did at the start)

                // Get fresh image data from the scaled canvas
                const finalImageData = ctx.getImageData(0, 0, width, height);
                const finalPixels = finalImageData.data;

                for (let i = 0; i < finalPixels.length; i += 4) {
                    const idx = i / 4;
                    if (subjectMask[idx] === 1) {
                        // Subject - keep original
                    } else if (currentMask[idx] === 1) {
                        // Border - White
                        finalPixels[i] = 255;
                        finalPixels[i + 1] = 255;
                        finalPixels[i + 2] = 255;
                        finalPixels[i + 3] = 255;
                    } else {
                        // Transparent
                        finalPixels[i + 3] = 0;
                    }
                }

                ctx.putImageData(finalImageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Failed to load image for processing'));
            img.src = imageUrl;
        });
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setGeneratedUrl(null);

        // Use Pollinations.ai for free generation
        // Adding seed to ensure uniqueness if they click again
        const seed = Math.floor(Math.random() * 1000000);
        // Request white background explicitly so our chroma key works well
        const encodedPrompt = encodeURIComponent("die-cut sticker of " + prompt + ", white outline, vector art, white background, high quality, isolated");
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${seed}`;

        // Pre-load image to ensure it's ready before showing
        const img = new Image();
        img.onload = () => {
            setGeneratedUrl(url);
            setIsGenerating(false);
        };
        img.onerror = () => {
            setIsGenerating(false);
            alert('Failed to generate sticker. Please try again.');
        };
        img.src = url;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFileObject(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const content = (
        <div
            className={cn(
                "fixed !z-[99999] bg-white dark:bg-zinc-900 shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                // Mobile Styles (Bottom Sheet)
                "inset-x-0 bottom-0 w-full rounded-t-xl border-t sm:border-none",
                // Desktop Styles (Popover)
                "sm:w-80 sm:rounded-xl sm:inset-auto"
            )}
            style={position ? { top: position.top, left: position.left } : undefined}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Add Sticker</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 m-2 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={cn(
                        "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1",
                        activeTab === 'generate'
                            ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                >
                    <Sparkles className="w-3 h-3" />
                    Generate
                </button>
                <button
                    onClick={() => setActiveTab('upload')}
                    className={cn(
                        "flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1",
                        activeTab === 'upload'
                            ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                >
                    <Upload className="w-3 h-3" />
                    Upload
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'generate' ? (
                    <div className="space-y-4">
                        <div className="flex gap-1">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                placeholder="e.g., cute cat..."
                                className="flex-1 px-2 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                autoFocus
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating}
                                className="px-2 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            </button>
                        </div>

                        {generatedUrl && (
                            <div className="space-y-2">
                                <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 group">
                                    <img src={generatedUrl} alt="Generated sticker" className="w-full h-full object-contain" />
                                    <button
                                        onClick={async () => {
                                            if (generatedUrl) {
                                                setIsUploading(true);
                                                try {
                                                    const processedUrl = await processImage(generatedUrl);
                                                    const blob = dataURLtoBlob(processedUrl);
                                                    const remoteUrl = await uploadMedia(blob, 'stickers', 'ai_sticker.png');
                                                    onInsert(remoteUrl);
                                                } catch (e) {
                                                    console.error("Failed to process image", e);
                                                    onInsert(generatedUrl);
                                                } finally {
                                                    setIsUploading(false);
                                                }
                                                onClose();
                                            }
                                        }}
                                        disabled={isUploading}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full shadow-lg transform scale-95 group-hover:scale-100 transition-transform flex items-center gap-2">
                                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Insert Sticker'}
                                        </span>
                                    </button>
                                </div>
                                <p className="text-xs text-center text-gray-400">Click image to insert</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <ImageIcon className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium">Click to upload image</p>
                                <p className="text-xs">PNG, JPG, GIF up to 5MB</p>
                            </div>
                        </div>

                        {uploadUrl && (
                            <div className="space-y-2">
                                <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 group">
                                    <img src={uploadUrl} alt="Uploaded sticker" className="w-full h-full object-contain" />
                                    <button
                                        onClick={async () => {
                                            setIsUploading(true);
                                            try {
                                                if (uploadFileObject) {
                                                    const remoteUrl = await uploadMedia(uploadFileObject, 'stickers');
                                                    onInsert(remoteUrl);
                                                } else if (uploadUrl) {
                                                    onInsert(uploadUrl);
                                                }
                                            } catch (e) {
                                                console.error("Failed to upload sticker", e);
                                            } finally {
                                                setIsUploading(false);
                                            }
                                            onClose();
                                        }}
                                        disabled={isUploading}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full shadow-lg transform scale-95 group-hover:scale-100 transition-transform flex items-center gap-2">
                                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Insert Sticker'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;

    return createPortal(
        <>
            {/* Backdrop for mobile to close on click outside */}
            <div className="fixed inset-0 z-[9998] bg-black/20 sm:bg-transparent" onClick={onClose} />
            {content}
        </>,
        document.body
    );
}
