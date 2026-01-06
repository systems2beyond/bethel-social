'use client';

import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Send, Users, Flag, Pin, LayoutDashboard, AlertCircle, CheckCircle, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

interface Report {
    id: string;
    postId: string;
    postContent: string;
    postAuthorId: string;
    reportedBy: string;
    reporterName: string;
    reason: string;
    status: 'pending' | 'reviewed';
    timestamp: any;
}

interface PinnedPost {
    id: string;
    content: string;
    author: {
        name: string;
        avatarUrl?: string;
    };
    timestamp: number;
    pinned: boolean;
}

export default function AdminPage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'pinned'>('overview');

    // Overview State
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [postStatus, setPostStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Reports State
    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);

    // Pinned Posts State
    const [pinnedPosts, setPinnedPosts] = useState<PinnedPost[]>([]);
    const [loadingPinned, setLoadingPinned] = useState(true);

    // Fetch Reports
    useEffect(() => {
        if (activeTab === 'reports') {
            const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
                setLoadingReports(false);
            });
            return () => unsubscribe();
        }
    }, [activeTab]);

    // Fetch Pinned Posts
    useEffect(() => {
        if (activeTab === 'pinned') {
            const q = query(collection(db, 'posts'), where('pinned', '==', true));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setPinnedPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PinnedPost)));
                setLoadingPinned(false);
            });
            return () => unsubscribe();
        }
    }, [activeTab]);

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        setPostStatus('idle');

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
            setPostStatus('success');
            setTimeout(() => setPostStatus('idle'), 3000);
        } catch (error) {
            console.error('Error adding post:', error);
            setPostStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDismissReport = async (reportId: string) => {
        if (!confirm('Dismiss this report? This will remove it from the list.')) return;
        try {
            await deleteDoc(doc(db, 'reports', reportId));
        } catch (error) {
            console.error('Error dismissing report:', error);
            alert('Failed to dismiss report');
        }
    };

    const handleDeletePostAndReport = async (postId: string, reportId: string) => {
        if (!confirm('Are you sure? This will PERMANENTLY delete the post and resolve the report.')) return;
        try {
            await deleteDoc(doc(db, 'posts', postId));
            await deleteDoc(doc(db, 'reports', reportId));
        } catch (error) {
            console.error('Error deleting post/report:', error);
            alert('Failed to delete post');
        }
    };

    const handleUnpin = async (postId: string) => {
        try {
            await updateDoc(doc(db, 'posts', postId), { pinned: false });
        } catch (error) {
            console.error('Error unpinning post:', error);
            alert('Failed to unpin post');
        }
    };

    if (userData?.role !== 'admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">You must be an administrator to view this dashboard.</p>
                <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Return Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-500 mt-2">Manage content, users, and community safety.</p>
                </header>

                {/* Tabs */}
                <div className="flex space-x-1 mb-6 bg-white p-1 rounded-xl border border-gray-200 w-fit">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Overview</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'reports' ? 'bg-yellow-50 text-yellow-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Flag className="w-4 h-4" />
                        <span>Reported Content</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('pinned')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pinned' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Pin className="w-4 h-4" />
                        <span>Pinned Posts</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {activeTab === 'overview' && (
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Quick Actions Card */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                                <div className="space-y-3">
                                    <Link
                                        href="/admin/users"
                                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-colors">
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-gray-900">Manage Users</h3>
                                                <p className="text-xs text-gray-500">View and update user roles</p>
                                            </div>
                                        </div>
                                        <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                    </Link>

                                    {/* Add more quick actions here in future */}
                                </div>
                            </div>

                            {/* Create Post Card */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Announcement</h2>
                                <form onSubmit={handleCreatePost} className="space-y-4">
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="What's happening at Bethel?"
                                        className="w-full h-32 p-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                                        disabled={isSubmitting}
                                    />
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs">
                                            {postStatus === 'success' && <span className="text-green-600 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Posted!</span>}
                                            {postStatus === 'error' && <span className="text-red-600 flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Error.</span>}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !content.trim()}
                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            <span>Publish</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            {loadingReports ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                            ) : reports.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No pending reports. Great job!</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Post Content</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Reporter</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {reports.map((report) => (
                                                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            {report.reason}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm text-gray-600 line-clamp-2 max-w-xs" title={report.postContent}>
                                                            {report.postContent}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {report.reporterName}
                                                        <br />
                                                        <span className="text-xs text-gray-400">
                                                            {report.timestamp?.toDate ? new Date(report.timestamp.toDate()).toLocaleDateString() : 'Just now'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right space-x-2">
                                                        <button
                                                            onClick={() => handleDismissReport(report.id)}
                                                            className="text-gray-400 hover:text-gray-600 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100"
                                                        >
                                                            Dismiss
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePostAndReport(report.postId, report.id)}
                                                            className="text-red-600 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50"
                                                        >
                                                            Delete Post
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'pinned' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            {loadingPinned ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                            ) : pinnedPosts.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No posts are currently pinned.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Author</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Content</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pinnedPosts.map((post) => (
                                                <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-3">
                                                            {post.author?.avatarUrl && (
                                                                <Image
                                                                    src={post.author.avatarUrl}
                                                                    alt={post.author.name}
                                                                    width={24}
                                                                    height={24}
                                                                    className="rounded-full"
                                                                />
                                                            )}
                                                            <span className="text-sm font-medium text-gray-900">{post.author?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm text-gray-600 line-clamp-2 max-w-xs">{post.content}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {new Date(post.timestamp).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleUnpin(post.id)}
                                                            className="text-blue-600 hover:text-blue-700 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50"
                                                        >
                                                            Unpin
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
