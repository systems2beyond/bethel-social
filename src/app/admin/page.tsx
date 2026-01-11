'use client';

import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, limit, getCountFromServer, getDocs } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Loader2, Send, Users, Flag, Pin, LayoutDashboard, AlertCircle, CheckCircle, Trash2, ExternalLink, Settings, DollarSign, Plus, CreditCard, ArrowUpRight, Search, Calendar, ChevronDown, Download, Ticket } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { GroupsService } from '@/lib/groups';
import { Group } from '@/types';
import GivingAnalytics from './giving/GivingAnalytics';
import AdminDonationsTable from './giving/AdminDonationsTable';
import CampaignManager from './giving/CampaignManager';
import { Timestamp } from 'firebase/firestore';

interface Donation {
    id: string;
    donorId: string;
    amount: number;
    tipAmount: number;
    totalAmount: number;
    campaign: string;
    status: string;
    createdAt: Timestamp | null;
    donorName?: string;
    donorEmail?: string;
}

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
    const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'pinned' | 'groups' | 'giving' | 'config'>('overview');

    // Overview State
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [postStatus, setPostStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [stats, setStats] = useState({ members: 0, giving: 0, events: 0 });
    const [loadingStats, setLoadingStats] = useState(true);

    // Fetch Overview Stats
    useEffect(() => {
        if (activeTab === 'overview') {
            const fetchStats = async () => {
                setLoadingStats(true); // Don't reset if already loaded? Maybe only on first load.
                try {
                    // 1. Members Count
                    const usersColl = collection(db, 'users');
                    const membersSnapshot = await getCountFromServer(usersColl);
                    const membersCount = membersSnapshot.data().count;

                    // 2. Weekly Giving (Last 7 Days)
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    const donationsQuery = query(
                        collection(db, 'donations'),
                        where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)),
                        where('status', '==', 'paid')
                    );
                    const donationsSnapshot = await getDocs(donationsQuery);
                    let weeklyGiving = 0;
                    donationsSnapshot.forEach(doc => {
                        weeklyGiving += (doc.data().amount || 0);
                    });

                    // 3. Upcoming Events
                    const eventsQuery = query(
                        collection(db, 'events'),
                        where('startDate', '>=', Timestamp.now())
                    );
                    const eventsSnapshot = await getCountFromServer(eventsQuery);
                    const eventsCount = eventsSnapshot.data().count;

                    setStats({ members: membersCount, giving: weeklyGiving, events: eventsCount });
                } catch (error) {
                    console.error("Error fetching admin stats:", error);
                } finally {
                    setLoadingStats(false);
                }
            };
            fetchStats();
        }
    }, [activeTab]);

    // Reports State
    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);

    // Pinned Posts State
    const [pinnedPosts, setPinnedPosts] = useState<PinnedPost[]>([]);
    const [loadingPinned, setLoadingPinned] = useState(true);

    // Groups State
    const [pendingGroups, setPendingGroups] = useState<Group[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(true);

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

    // Fetch Pending Groups
    useEffect(() => {
        if (activeTab === 'groups') {
            loadPendingGroups();
        }
    }, [activeTab]);

    const loadPendingGroups = async () => {
        setLoadingGroups(true);
        try {
            const data = await GroupsService.getPendingGroups();
            setPendingGroups(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingGroups(false);
        }
    };

    const handleApproveGroup = async (groupId: string) => {
        if (!confirm('Approve this group?')) return;
        try {
            await GroupsService.approveGroup(groupId);
            setPendingGroups(prev => prev.filter(g => g.id !== groupId));
        } catch (e) {
            console.error(e);
            alert('Failed to approve group');
        }
    };

    const handleRejectGroup = async (groupId: string) => {
        if (!confirm('Reject (delete) this group request?')) return;
        try {
            await GroupsService.rejectGroup(groupId);
            setPendingGroups(prev => prev.filter(g => g.id !== groupId));
        } catch (e) {
            console.error(e);
            alert('Failed to reject group');
        }
    };

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
                    <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard v2</h1>
                    <p className="text-gray-500 mt-2">Manage content, users, and community safety.</p>
                </header>

                {/* Tabs */}
                <div className="flex space-x-1 mb-6 bg-white p-1 rounded-xl border border-gray-200 w-fit">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Overview</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'reports' ? 'bg-yellow-50 text-yellow-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Flag className="w-4 h-4" />
                        <span>Reported Content</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('pinned')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'pinned' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Pin className="w-4 h-4" />
                        <span>Pinned Posts</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'groups' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Users className="w-4 h-4" />
                        <span>Pending Groups</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'config' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Settings className="w-4 h-4" />
                        <span>Configuration</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('giving')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'giving' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <DollarSign className="w-4 h-4" />
                        <span>Giving & Transactions</span>
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Stats Overview - Premium Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 transition-transform hover:scale-[1.02]">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Total Members</p>
                                        <h3 className="text-2xl font-bold text-gray-900">{loadingStats ? '...' : stats.members.toLocaleString()}</h3>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 transition-transform hover:scale-[1.02]">
                                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                                        <DollarSign className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Weekly Giving</p>
                                        <h3 className="text-2xl font-bold text-gray-900">{loadingStats ? '...' : `$${stats.giving.toLocaleString()}`}</h3>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 transition-transform hover:scale-[1.02]">
                                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Upcoming Events</p>
                                        <h3 className="text-2xl font-bold text-gray-900">{loadingStats ? '...' : stats.events}</h3>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Quick Actions Grid */}
                                <div className="lg:col-span-2 space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                        <LayoutDashboard className="w-5 h-5 mr-2 text-gray-500" />
                                        Platform Management
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Link href="/admin/events" className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 mb-4 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                                    <Calendar className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 mb-1">Manage Events</h3>
                                                <p className="text-sm text-gray-600 mb-4 h-10">Create events, manage tickets, and track attendance.</p>
                                                <div className="flex items-center text-orange-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                                    View Events <ArrowUpRight className="w-4 h-4 ml-1" />
                                                </div>
                                            </div>
                                        </Link>

                                        <Link href="/admin/users" className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 mb-1">User Directory</h3>
                                                <p className="text-sm text-gray-600 mb-4 h-10">Manage permissions, roles, and user accounts.</p>
                                                <div className="flex items-center text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                                    Manage Users <ArrowUpRight className="w-4 h-4 ml-1" />
                                                </div>
                                            </div>
                                        </Link>

                                        <Link href="/admin/giving" className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 mb-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                                    <DollarSign className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 mb-1">Giving Center</h3>
                                                <p className="text-sm text-gray-600 mb-4 h-10">Track donations, manage campaigns, and view reports.</p>
                                                <div className="flex items-center text-green-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                                    View Finances <ArrowUpRight className="w-4 h-4 ml-1" />
                                                </div>
                                            </div>
                                        </Link>

                                        <Link href="/admin/tickets" className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600 mb-4 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                                                    <Ticket className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 mb-1">Ticket Studio</h3>
                                                <p className="text-sm text-gray-600 mb-4 h-10">Design physical tickets and manage print layouts.</p>
                                                <div className="flex items-center text-pink-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                                    Open Studio <ArrowUpRight className="w-4 h-4 ml-1" />
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                </div>

                                {/* Quick Announcement Widget */}
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                        <Send className="w-5 h-5 mr-2 text-gray-500" />
                                        Communications
                                    </h2>
                                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg">
                                        <h3 className="text-lg font-bold mb-2">New Announcement</h3>
                                        <p className="text-blue-100 text-sm mb-4">Post updates directly to the main feed.</p>
                                        <form onSubmit={handleCreatePost} className="space-y-4">
                                            <div className="relative">
                                                <textarea
                                                    value={content}
                                                    onChange={(e) => setContent(e.target.value)}
                                                    placeholder="What's happening at Bethel?"
                                                    className="w-full h-32 p-4 rounded-xl bg-white/10 border border-white/20 placeholder-blue-100 text-white focus:ring-2 focus:ring-white/50 focus:border-transparent resize-none text-sm transition-all focus:bg-white/20"
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs">
                                                    {postStatus === 'success' && <span className="bg-green-500/20 text-green-100 px-2 py-1 rounded-full flex items-center border border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Posted</span>}
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={isSubmitting || !content.trim()}
                                                    className="flex items-center space-x-2 px-6 py-2.5 bg-white text-blue-600 rounded-xl hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-bold shadow-sm"
                                                >
                                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    <span>Publish</span>
                                                </button>
                                            </div>
                                        </form>
                                    </div>

                                </div>
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

                    {activeTab === 'groups' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            {loadingGroups ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                            ) : pendingGroups.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No pending group requests.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Group Name</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pendingGroups.map((group) => (
                                                <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="font-medium text-gray-900">{group.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm text-gray-600 line-clamp-2 max-w-xs">{group.description}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                                                        {group.type}
                                                    </td>
                                                    <td className="px-6 py-4 text-right space-x-2">
                                                        <button
                                                            onClick={() => handleRejectGroup(group.id)}
                                                            className="text-red-600 hover:text-red-700 text-xs font-medium px-3 py-1.5 rounded hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={() => handleApproveGroup(group.id)}
                                                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded shadow-sm hover:shadow transition-all"
                                                        >
                                                            Approve
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

                    {activeTab === 'config' && (
                        <ConfigurationTab />
                    )}

                    {activeTab === 'giving' && (
                        <GivingTab />
                    )}
                </div>
            </div>
        </div>
    );
}



function ConfigurationTab() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Webhook State
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isSavingWebhook, setIsSavingWebhook] = useState(false);

    // Stripe State
    const [stripeLoading, setStripeLoading] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'churches', 'default_church'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setConfig(data);
                if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const toggleFeature = async (feature: string, currentValue: boolean) => {
        try {
            await setDoc(doc(db, 'churches', 'default_church'), {
                features: {
                    [feature]: !currentValue
                }
            }, { merge: true });
        } catch (error) {
            console.error('Error updating config:', error);
            alert('Failed to update settings');
        }
    };

    const handleSaveWebhook = async () => {
        setIsSavingWebhook(true);
        try {
            await setDoc(doc(db, 'churches', 'default_church'), {
                webhookUrl: webhookUrl.trim()
            }, { merge: true });
            // Show success momentarily?
        } catch (error) {
            console.error('Error saving webhook:', error);
            alert('Failed to save webhook URL');
        } finally {
            setIsSavingWebhook(false);
        }
    };

    const handleConnectStripe = async () => {
        setStripeLoading(true);
        try {
            const createExpressAccount = httpsCallable(functions, 'createExpressAccount');
            const result = await createExpressAccount({
                churchId: 'default_church',
                redirectUrl: window.location.origin
            });
            const { url } = result.data as any;
            window.location.href = url;
        } catch (error: any) {
            console.error('Stripe Onboarding Error:', error);
            // Check for specific error code from backend or legacy string match
            if (error.message === 'CONNECT_NOT_ENABLED' || (error.message && error.message.includes("signed up for Connect"))) {
                alert("ACTION REQUIRED: You must enable 'Connect' in your Stripe Dashboard to use this feature.\n\n1. Go to dashboard.stripe.com\n2. Click 'Connect' in the menu\n3. Click 'Enable' or 'Get Started'");
            } else {
                alert(`Failed to start onboarding. Error: ${error.message || 'Unknown'}`);
            }
            setStripeLoading(false);
        }
    };

    const handleStripeDashboard = async () => {
        setStripeLoading(true);
        try {
            const getLoginLink = httpsCallable(functions, 'getStripeLoginLink');
            const result = await getLoginLink({ churchId: 'default_church' });
            const { url } = result.data as any;
            window.open(url, '_blank');
            setStripeLoading(false);
        } catch (error) {
            console.error(error);
            alert('Failed to get dashboard link.');
            setStripeLoading(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    const stripeStatus = config?.stripeAccountStatus || 'none';
    const isStripeActive = stripeStatus === 'active';

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <Settings className="w-5 h-5 mr-2 text-gray-500" />
                    Global Configuration
                </h2>

                <div className="space-y-8">
                    {/* Giving Feature Toggle */}
                    <section className="border-b border-gray-100 pb-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config?.features?.giving ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <DollarSign className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900">Tithing & Giving System</h3>
                                    <p className="text-sm text-gray-500 max-w-md">Enable donations, tithes, and payouts via Stripe. When disabled, the Giving tab is hidden from users.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={config?.features?.giving || false}
                                    onChange={() => toggleFeature('giving', config?.features?.giving)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                    </section>

                    {/* Stripe Integration */}
                    <section className="border-b border-gray-100 pb-8">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isStripeActive ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <CreditCard className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 flex items-center">
                                        Payment Gateway
                                        {isStripeActive && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Active</span>}
                                    </h3>
                                    <p className="text-sm text-gray-500 max-w-md mt-1">
                                        {isStripeActive
                                            ? 'Your Stripe account is connected and ready to process donations.'
                                            : 'Connect a Stripe account to receive payouts directly to your bank account.'}
                                    </p>

                                    <div className="mt-4">
                                        {isStripeActive ? (
                                            <button
                                                onClick={handleStripeDashboard}
                                                disabled={stripeLoading}
                                                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                            >
                                                {stripeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                                                View Stripe Dashboard
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleConnectStripe}
                                                disabled={stripeLoading}
                                                className="inline-flex items-center px-4 py-2 bg-purple-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-purple-700 transition-colors shadow-sm"
                                            >
                                                {stripeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                                                Connect with Stripe
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* CMS Integration */}
                    <section className="border-b border-gray-100 pb-8">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <ArrowUpRight className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-semibold text-gray-900">CMS Integration (Webhooks)</h3>
                                    <p className="text-sm text-gray-500 max-w-lg mt-1">
                                        Automatically send donation data to an external CMS or CRM system. We'll send a POST request with JSON data whenever a donation succeeds.
                                    </p>

                                    <div className="mt-4 flex items-center gap-3 max-w-md">
                                        <input
                                            type="url"
                                            placeholder="https://your-cms.com/api/webhooks/giving"
                                            value={webhookUrl}
                                            onChange={(e) => setWebhookUrl(e.target.value)}
                                            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        />
                                        <button
                                            onClick={handleSaveWebhook}
                                            disabled={isSavingWebhook}
                                            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-70 transition-colors"
                                        >
                                            {isSavingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Campaign Management Moved to Giving Tab */}
                </div>
            </div>
        </div>
    );
}

function GivingTab() {
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'donations'), orderBy('createdAt', 'desc'), limit(100));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const donationsData: Donation[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                donationsData.push({
                    id: doc.id,
                    ...data,
                    amount: data.amount || 0,
                    tipAmount: data.tipAmount || 0,
                    totalAmount: data.totalAmount || 0,
                    campaign: data.campaign || 'General Fund',
                    status: data.status || 'pending',
                    createdAt: data.createdAt // Keep timestamp as is for now
                } as Donation);
            });
            setDonations(donationsData);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Error fetching donations:", err);
            // Don't show error to user immediately if it's just a permission issue initially, but good to know.
            // Actually let's just log it. If it fails, donations is empty, which is fine.
            setError('Failed to load donations.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Giving Overview</h2>
                    <p className="text-sm text-gray-500">Analytics and recent transactions.</p>
                </div>
                <Link href="/admin/giving" className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                    <Settings className="w-4 h-4 mr-2" />
                    Manage Settings & Payouts
                </Link>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2 border border-red-100">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">Connection Error</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {!error && (
                <>
                    <GivingAnalytics donations={donations} />

                    <div className="space-y-6">
                        <AdminDonationsTable donations={donations} loading={loading} />
                        <CampaignManager />
                    </div>
                </>
            )}
        </div>
    );
}
