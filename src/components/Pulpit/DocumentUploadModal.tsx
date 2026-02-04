'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import mammoth from 'mammoth';
import { PulpitService } from '@/lib/services/PulpitService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface DocumentUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function DocumentUploadModal({ isOpen, onClose, onSuccess }: DocumentUploadModalProps) {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [gdocUrl, setGdocUrl] = useState('');
    const [noteTitle, setNoteTitle] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            // If title is empty, pre-fill with filename
            if (!noteTitle) {
                setNoteTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
            handleFile(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // If title is empty, pre-fill with filename
            if (!noteTitle) {
                setNoteTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
            handleFile(file);
        }
    };

    const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
        try {
            // Dynamic import pdfjs-dist to avoid SSR issues
            const pdfjs = await import('pdfjs-dist');

            // Set worker source
            const version = '5.4.624'; // Match the version from package.json/npm list
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                fullText += `<h3>Page ${i}</h3><p>${pageText}</p>`;
            }

            return fullText;
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            throw new Error('Could not read PDF content');
        }
    };

    const handleFile = async (file: File) => {
        if (!user) return;

        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!['docx', 'txt', 'pdf'].includes(extension || '')) {
            toast.error('Unsupported file format. Please use .docx, .pdf, or .txt');
            return;
        }

        setIsProcessing(true);
        try {
            let content = '';
            const title = noteTitle || file.name.replace(/\.[^/.]+$/, ""); // Use custom title or fallback to filename

            if (extension === 'docx') {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                content = result.value; // Mammoth returns HTML
                if (result.messages.length > 0) {
                    console.warn('Mammoth messages:', result.messages);
                }
            } else if (extension === 'pdf') {
                const arrayBuffer = await file.arrayBuffer();
                content = await extractTextFromPdf(arrayBuffer);
            } else {
                content = await file.text();
                // Wrap plain text in simple HTML paragraphs or just preserve it
                content = content.split('\n').map(line => `<p>${line}</p>`).join('');
            }

            await PulpitService.createNote(user.uid, title, content);
            toast.success('Manuscript imported successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error processing file:', error);
            toast.error('Failed to process document');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGDocPull = async () => {
        if (!user || !gdocUrl) return;

        // Extract ID from URL: https://docs.google.com/document/d/1XJk.../edit
        const match = gdocUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            toast.error('Invalid Google Doc URL');
            return;
        }

        const docId = match[1];
        setIsProcessing(true);

        try {
            const response = await fetch('/api/admin/gdoc-fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch Google Doc');
            }

            // Google Doc txt export comes as plain text
            const content = data.text.split('\n').map((line: string) => `<p>${line}</p>`).join('');
            const title = noteTitle || "Imported Google Doc";

            await PulpitService.createNote(user.uid, title, content);
            toast.success('Google Doc imported successfully!');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error pulling Google Doc:', error);
            toast.error(error.message || 'Failed to pull Google Doc');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <Upload className="w-5 h-5 mr-3 text-indigo-600" />
                        Import Sermon Manuscript
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Note Title Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-indigo-500" />
                            Note Title
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Sunday Morning Message - Feb 10"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder:text-gray-500 font-medium"
                        />
                    </div>

                    {/* Local File Upload */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center">
                            <FileText className="w-4 h-4 mr-2" />
                            Upload Local File (.docx, .pdf, .txt)
                        </label>
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".docx,.pdf,.txt"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {isProcessing ? (
                                <div className="space-y-3 py-4">
                                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                                    <p className="text-sm text-gray-600 font-medium">Processing manuscript...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                                        <Upload className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-indigo-600 font-bold hover:underline"
                                        >
                                            Click to upload
                                        </button>
                                        <span className="text-gray-500"> or drag and drop</span>
                                        <p className="text-xs text-gray-500 mt-2 font-medium">Word, PDF, or Plain Text only</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-gray-100"></div>
                        <span className="flex-shrink mx-4 text-gray-500 text-xs font-bold uppercase tracking-widest">or</span>
                        <div className="flex-grow border-t border-gray-100"></div>
                    </div>

                    {/* Google Doc URL */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center">
                            <Globe className="w-4 h-4 mr-2" />
                            Pull from Google Docs
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Paste Google Doc URL..."
                                value={gdocUrl}
                                onChange={(e) => setGdocUrl(e.target.value)}
                                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder:text-gray-500"
                            />
                            <button
                                onClick={handleGDocPull}
                                disabled={!gdocUrl || isProcessing}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
                            >
                                Pull Doc
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center font-medium">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Document must be shared as "Anyone with the link can view"
                        </p>
                    </div>

                    {/* Pages Note */}
                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start shadow-sm">
                        <AlertCircle className="w-4 h-4 text-amber-700 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-900 leading-relaxed font-medium">
                            <strong>Note for Apple Pages users:</strong> Directly uploading .pages files is not yet supported. Please export to Word (.docx) or paste the text into a .txt file first.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div >
    );
}
