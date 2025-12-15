'use client';

import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Send, Users } from 'lucide-react';

export default function AdminPage() {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        setStatus('idle');

        try {
            await addDoc(collection(db, 'posts'), {
                type: 'manual',
                content: content,
                timestamp: Date.now(),
                pinned: false,
                author: {
                    name: 'Bethel Admin',
                    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
                },
                createdAt: serverTimestamp(),
            });

            setContent('');
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error) {
            console.error('Error adding post:', error);
            setStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Quick Actions</h2>
                    </div>
                    <div className="mt-4 flex space-x-4">
                        <a href="/admin/users" className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                            <Users className="w-4 h-4" />
                            <span>Manage Users</span>
                        </a>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-xl font-semibold mb-4">Create New Post</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="What's happening at Bethel?"
                                className="w-full h-32 p-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-sm">
                                {status === 'success' && <span className="text-green-600">Post published successfully!</span>}
                                {status === 'error' && <span className="text-red-600">Error publishing post.</span>}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !content.trim()}
                                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                <span>Publish Post</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
