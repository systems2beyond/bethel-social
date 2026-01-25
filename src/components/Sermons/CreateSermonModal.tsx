'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Youtube, AlertCircle, CheckCircle, Loader2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import BibleStudyModal from '@/components/Bible/BibleStudyModal';

interface CreateSermonModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateSermonModal({ onClose, onSuccess }: CreateSermonModalProps) {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'upload' | 'youtube'>('upload');
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [transcript, setTranscript] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [isBibleOpen, setIsBibleOpen] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!title || !date) {
            toast.error('Please fill in title and date');
            return;
        }

        if (activeTab === 'youtube' && !youtubeUrl) {
            toast.error('Please enter a YouTube URL');
            return;
        }

        if (activeTab === 'upload' && !file) {
            toast.error('Please select a video file');
            return;
        }

        setUploading(true);

        try {
            let finalVideoUrl = youtubeUrl;
            let driveFileId = null;

            if (activeTab === 'upload' && file) {
                // 1. Get Resumable Upload URL from Backend
                const initRes = await fetch('/api/admin/drive/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type,
                    }),
                });

                if (!initRes.ok) {
                    throw new Error('Failed to initiate upload');
                }

                const { uploadUrl } = await initRes.json();

                // 2. Upload File to Google Drive directly
                const xhr = new XMLHttpRequest();
                await new Promise((resolve, reject) => {
                    xhr.open('PUT', uploadUrl);
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percent = (e.loaded / e.total) * 100;
                            setProgress(Math.round(percent));
                        }
                    };
                    xhr.onload = () => {
                        if (xhr.status === 200 || xhr.status === 201) {
                            const response = JSON.parse(xhr.responseText);
                            driveFileId = response.id;
                            finalVideoUrl = response.webViewLink; // Or webContentLink
                            resolve(response);
                        } else {
                            reject(new Error('Upload failed'));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Upload failed'));
                    xhr.send(file);
                });
            }

            // 3. Create Sermon Document in Firestore
            await addDoc(collection(db, 'sermons'), {
                title,
                date: new Date(date), // Store as Timestamp or Date object
                videoUrl: finalVideoUrl,
                driveFileId: driveFileId,
                source: activeTab, // 'youtube' or 'upload'
                transcript: transcript || null,
                churchId: userData?.churchId || 'bethel-metro',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            toast.success('Sermon created successfully!');
            onSuccess();

        } catch (error) {
            console.error('Error creating sermon:', error);
            toast.error('Failed to create sermon');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Sermon</h2>
                    <div className="flex items-center gap-2">
                        {/* Bible Modal Trigger */}
                        <button
                            onClick={() => setIsBibleOpen(true)}
                            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-lg transition-colors flex items-center gap-2"
                            title="Open Bible"
                        >
                            <BookOpen className="w-5 h-5" />
                            <span className="text-sm font-medium hidden sm:inline">Reference Bible</span>
                        </button>

                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Sermon Title"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Source Toggle */}
                    <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg flex">
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-medium transition-all ${activeTab === 'upload'
                                ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <Upload className="w-4 h-4" />
                            Upload Video
                        </button>
                        <button
                            onClick={() => setActiveTab('youtube')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-medium transition-all ${activeTab === 'youtube'
                                ? 'bg-white dark:bg-zinc-700 text-red-600 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <Youtube className="w-4 h-4" />
                            YouTube Link
                        </button>
                    </div>

                    {/* Source Inputs */}
                    <div>
                        {activeTab === 'upload' ? (
                            <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-500 transition-colors bg-gray-50 dark:bg-zinc-900/50">
                                <input
                                    type="file"
                                    id="video-upload"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                {file ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 mb-3">
                                            <CheckCircle className="w-6 h-6" />
                                        </div>
                                        <p className="font-medium text-gray-900 dark:text-white mb-1">{file.name}</p>
                                        <p className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        <label
                                            htmlFor="video-upload"
                                            className="mt-4 text-sm text-blue-600 hover:underline cursor-pointer"
                                        >
                                            Change File
                                        </label>
                                    </div>
                                ) : (
                                    <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                                        <Upload className="w-10 h-10 text-gray-400 mb-4" />
                                        <p className="font-medium text-gray-900 dark:text-white mb-1">Click to upload video</p>
                                        <p className="text-sm text-gray-500">MP4, MOV up to 2GB</p>
                                    </label>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">YouTube URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={youtubeUrl}
                                        onChange={(e) => setYoutubeUrl(e.target.value)}
                                        placeholder="https://youtube.com/watch?v=..."
                                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!youtubeUrl) {
                                                toast.error('Please enter a URL first');
                                                return;
                                            }
                                            const toastId = toast.loading('Fetching transcript...');
                                            try {
                                                const res = await fetch('/api/admin/youtube/transcript', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ url: youtubeUrl }),
                                                });
                                                const data = await res.json();

                                                if (!res.ok) throw new Error(data.error || 'Failed to fetch');

                                                setTranscript(data.transcript);
                                                toast.success('Transcript fetched!', { id: toastId });
                                            } catch (err: any) {
                                                console.error(err);
                                                toast.error(err.message || 'Failed to fetch transcript', { id: toastId });
                                            }
                                        }}
                                        className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors font-medium border border-gray-200 dark:border-zinc-700 whitespace-nowrap"
                                        type="button"
                                    >
                                        Fetch Text
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar (Only for Upload) */}
                    {uploading && activeTab === 'upload' && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                <span>Uploading...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Transcript / Overview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transcript / Overview</label>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none min-h-[150px]"
                            placeholder="Enter the full transcript or a detailed overview. This will be used for AI highlights and search."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            💡 <strong>Tip:</strong> If auto-fetch fails, open the YouTube video → click "..." → "Show transcript" → copy/paste here.
                        </p>
                    </div>

                </div>

                <div className="p-6 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={uploading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {activeTab === 'upload' ? 'Uploading...' : 'Saving...'}
                            </>
                        ) : (
                            'Create Sermon'
                        )}
                    </button>
                </div>
            </motion.div>

            <AnimatePresence>
                {isBibleOpen && (
                    <BibleStudyModal
                        onClose={() => setIsBibleOpen(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
