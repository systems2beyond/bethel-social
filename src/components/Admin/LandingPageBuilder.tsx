'use client';

import React, { useState } from 'react';
import { LandingPageBlock } from '@/types';
import { Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Type, Video, FileText, Link as LinkIcon, Loader2, Upload } from 'lucide-react';
import { uploadMedia } from '@/lib/storage';

interface LandingPageBuilderProps {
    blocks: LandingPageBlock[];
    onChange: (blocks: LandingPageBlock[]) => void;
}

export default function LandingPageBuilder({ blocks, onChange }: LandingPageBuilderProps) {
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const addBlock = (type: LandingPageBlock['type']) => {
        const newBlock: any = {
            id: crypto.randomUUID(),
            type,
        };

        if (type === 'text') {
            newBlock.content = '';
            newBlock.title = '';
        } else if (type === 'image' || type === 'video') {
            newBlock.url = '';
            newBlock.caption = ''; // or title
        } else if (type === 'file') {
            newBlock.url = '';
            newBlock.name = '';
        } else if (type === 'button') {
            newBlock.label = 'Click Me';
            newBlock.url = '';
            newBlock.style = 'primary';
        }

        onChange([...blocks, newBlock]);
    };

    const updateBlock = (id: string, updates: Partial<LandingPageBlock>) => {
        onChange(blocks.map(b => b.id === id ? { ...b, ...updates } as any : b));
    };

    const removeBlock = (id: string) => {
        onChange(blocks.filter(b => b.id !== id));
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newBlocks = [...blocks];
        if (direction === 'up' && index > 0) {
            [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
        } else if (direction === 'down' && index < newBlocks.length - 1) {
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
        }
        onChange(newBlocks);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string, type: 'image' | 'file' | 'video') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingId(id);
        try {
            const url = await uploadMedia(file, `events/landing/${type}s`);
            if (type === 'file') {
                updateBlock(id, { url, name: file.name, size: file.size });
            } else {
                updateBlock(id, { url });
            }
        } catch (error) {
            console.error('Upload failed', error);
            alert('Upload failed');
        } finally {
            setUploadingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-500 w-full mb-2">Add Content Block:</span>
                <button onClick={() => addBlock('text')} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">
                    <Type className="w-4 h-4 text-blue-500" /> Text
                </button>
                <button onClick={() => addBlock('image')} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">
                    <ImageIcon className="w-4 h-4 text-green-500" /> Image
                </button>
                <button onClick={() => addBlock('video')} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">
                    <Video className="w-4 h-4 text-red-500" /> Video
                </button>
                <button onClick={() => addBlock('file')} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">
                    <FileText className="w-4 h-4 text-orange-500" /> File
                </button>
                <button onClick={() => addBlock('button')} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">
                    <LinkIcon className="w-4 h-4 text-purple-500" /> Button
                </button>
            </div>

            <div className="space-y-4">
                {blocks.map((block, index) => (
                    <div key={block.id} className="relative group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm transition-all hover:shadow-md">
                        {/* Controls */}
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 p-1 rounded-md shadow-sm border border-gray-100 dark:border-gray-700 z-10">
                            <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30">
                                <ArrowUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30">
                                <ArrowDown className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                            <button onClick={() => removeBlock(block.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Block Content */}
                        <div className="pt-2">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-xs font-bold uppercase text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                    {block.type}
                                </span>
                            </div>

                            {/* TEXT BLOCK */}
                            {block.type === 'text' && (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Heading (Optional)"
                                        value={block.title || ''}
                                        onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                        className="w-full p-2 text-sm font-medium border rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <textarea
                                        placeholder="Content..."
                                        value={block.content}
                                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                        rows={3}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            )}

                            {/* IMAGE BLOCK */}
                            {block.type === 'image' && (
                                <div className="space-y-3">
                                    {block.url ? (
                                        <div className="relative aspect-video bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden">
                                            <img src={block.url} alt="Block preview" className="w-full h-full object-cover" />
                                            <button onClick={() => updateBlock(block.id, { url: '' })} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900/50">
                                            <label className="cursor-pointer flex flex-col items-center">
                                                {uploadingId === block.id ? (
                                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                                ) : (
                                                    <>
                                                        <Upload className="w-6 h-6 text-gray-400 mb-2" />
                                                        <span className="text-sm text-blue-500">Upload Image</span>
                                                    </>
                                                )}
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, block.id, 'image')} />
                                            </label>
                                            <span className="text-xs text-gray-400 mt-2">or paste URL</span>
                                            <input
                                                type="text"
                                                placeholder="https://..."
                                                className="mt-1 w-full text-xs p-1 border rounded"
                                                onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Caption (Optional)"
                                        value={block.caption || ''}
                                        onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            )}

                            {/* VIDEO BLOCK */}
                            {block.type === 'video' && (
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-3">
                                        <input
                                            type="text"
                                            placeholder="Video Title (Optional)"
                                            value={block.title || ''}
                                            onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                                            className="w-full p-2 text-sm font-medium border rounded dark:bg-gray-700 dark:border-gray-600"
                                        />

                                        {!block.url ? (
                                            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-gray-50 dark:bg-gray-900/50">
                                                <div className="text-center space-y-2">
                                                    <label className="cursor-pointer flex flex-col items-center">
                                                        {uploadingId === block.id ? (
                                                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                                        ) : (
                                                            <>
                                                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                                                <span className="text-sm text-blue-500 font-medium">Upload Video File</span>
                                                            </>
                                                        )}
                                                        <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, block.id, 'video')} />
                                                    </label>
                                                    <p className="text-xs text-gray-400">MP4, WebM (max 100MB)</p>
                                                    <div className="relative flex items-center w-full my-2">
                                                        <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
                                                        <span className="flex-shrink-0 mx-2 text-xs text-gray-400 uppercase">OR</span>
                                                        <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Paste YouTube/Vimeo URL"
                                                        className="w-full text-xs p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                                        onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative bg-gray-100 dark:bg-gray-900 rounded-md overflow-hidden p-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm truncate max-w-[200px] text-gray-600 dark:text-gray-300">
                                                        {block.url.includes('firebasestorage') ? 'Uploaded Video' : block.url}
                                                    </span>
                                                    <button onClick={() => updateBlock(block.id, { url: '' })} className="text-red-500 hover:text-red-700 p-1">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                {/* Simple preview if possible, otherwise just link state */}
                                                {block.url.includes('firebasestorage') && (
                                                    <video src={block.url} controls className="w-full mt-2 rounded max-h-[200px]" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* FILE BLOCK */}
                            {block.type === 'file' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                placeholder="Display Name"
                                                value={block.name}
                                                onChange={(e) => updateBlock(block.id, { name: e.target.value })}
                                                className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 mb-2"
                                            />
                                            {block.url ? (
                                                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                                    <FileText className="w-4 h-4" />
                                                    <span className="truncate max-w-[200px]">{block.url.split('/').pop()}</span>
                                                    <button onClick={() => updateBlock(block.id, { url: '', name: '' })} className="ml-auto text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    {uploadingId === block.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                    <span className="text-sm">Upload File</span>
                                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, block.id, 'file')} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* BUTTON BLOCK */}
                            {block.type === 'button' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Label (e.g. Register Now)"
                                            value={block.label}
                                            onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                                            className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <select
                                            value={block.style}
                                            onChange={(e) => updateBlock(block.id, { style: e.target.value as any })}
                                            className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                        >
                                            <option value="primary">Primary (Blue)</option>
                                            <option value="secondary">Secondary (Gray)</option>
                                        </select>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Action URL (e.g. https://...)"
                                        value={block.url}
                                        onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            )}

                        </div>
                    </div>
                ))}
            </div>

            {blocks.length === 0 && (
                <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <p>Start building your landing page by adding a block above.</p>
                </div>
            )}
        </div>
    );
}
