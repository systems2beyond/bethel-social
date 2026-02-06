'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, Shield, User, ShieldAlert, Users, Milestone, ArrowLeft, Search, Filter, SortAsc, SortDesc, ArrowUpAZ, ArrowDownZA, Check } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import VisitorPipeline from '@/components/Admin/VisitorPipeline';

interface UserData {
    uid: string;
    email: string;
    displayName?: string;
    role: 'admin' | 'staff' | 'member' | 'pastor_admin' | 'media_admin' | 'super_admin';
    photoURL?: string;
    createdAt?: any;
}

// Wrapper component to handle Suspense for useSearchParams
export default function PeopleHubPageWrapper() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
            <PeopleHubPage />
        </Suspense>
    );
}

function PeopleHubPage() {
    const { userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<'directory' | 'visitors'>(
        tabParam === 'visitors' ? 'visitors' : 'directory'
    );
    const [searchQuery, setSearchQuery] = useState('');

    // Filter State
    const [filterMode, setFilterMode] = useState<'all' | 'new_guest' | 'prayer_request'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
    const [showFilter, setShowFilter] = useState(false);

    const hasActiveFilters = filterMode !== 'all' || sortBy !== 'newest';

    // Handle tab change
    const handleTabChange = (tab: 'directory' | 'visitors') => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`/admin/users?${params.toString()}`);
    };

    // Role Check
    if (!authLoading && userData?.role !== 'admin' && userData?.role !== 'super_admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">You must be an admin to view the People Hub.</p>
                <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Return Home
                </Link>
            </div>
        );
    }

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600/20" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header - Copper style */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Left: Back + Title */}
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-sm">
                                        <Users className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">People Hub</h1>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Manage relationships and track outreach pipeline
                                </p>
                            </div>
                        </div>

                        {/* Center: Search */}
                        <div className="hidden md:flex flex-1 max-w-md mx-8">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'directory' ? "Search members..." : "Search pipeline..."}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Right: Tab Switcher (Copper Style) */}
                        <div className="flex items-center gap-4">
                            {/* Filter Button (Only show when on Visitors tab) */}
                            {activeTab === 'visitors' && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowFilter(!showFilter)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-tight rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap",
                                            hasActiveFilters
                                                ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                                                : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
                                        )}
                                    >
                                        <Filter className="w-4 h-4 flex-shrink-0" />
                                        <span>Filter</span>
                                        {hasActiveFilters && (
                                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse ml-1" />
                                        )}
                                    </button>

                                    {showFilter && (
                                        <>
                                            <div className="fixed inset-0 z-[60]" onClick={() => setShowFilter(false)} />
                                            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-2xl z-[70] py-3 animate-in fade-in slide-in-from-top-2">
                                                {/* Sort Order */}
                                                <div className="px-4 py-2">
                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Sort By</label>
                                                    <div className="space-y-1">
                                                        {[
                                                            { value: 'newest', label: 'Newest First', icon: SortDesc },
                                                            { value: 'oldest', label: 'Oldest First', icon: SortAsc },
                                                            { value: 'name_asc', label: 'Name (A-Z)', icon: ArrowUpAZ },
                                                            { value: 'name_desc', label: 'Name (Z-A)', icon: ArrowDownZA },
                                                        ].map((option) => (
                                                            <button
                                                                key={option.value}
                                                                onClick={() => setSortBy(option.value as any)}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-lg transition-colors",
                                                                    sortBy === option.value
                                                                        ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30"
                                                                        : "text-gray-600 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <option.icon className="w-3.5 h-3.5" />
                                                                    <span>{option.label}</span>
                                                                </div>
                                                                {sortBy === option.value && <Check className="w-3.5 h-3.5" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="border-t border-gray-50 dark:border-zinc-700 my-2" />

                                                {/* Filter By */}
                                                <div className="px-4 py-2">
                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Filter Members</label>
                                                    <div className="space-y-1">
                                                        {[
                                                            { value: 'all', label: 'Show All' },
                                                            { value: 'new_guest', label: 'New Guests Only' },
                                                            { value: 'prayer_request', label: 'Prayer Requests' },
                                                        ].map((option) => (
                                                            <button
                                                                key={option.value}
                                                                onClick={() => setFilterMode(option.value as any)}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-lg transition-colors",
                                                                    filterMode === option.value
                                                                        ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30"
                                                                        : "text-gray-600 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                                                )}
                                                            >
                                                                <span>{option.label}</span>
                                                                {filterMode === option.value && <Check className="w-3.5 h-3.5" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {hasActiveFilters && (
                                                    <>
                                                        <div className="border-t border-gray-50 dark:border-zinc-700 my-2" />
                                                        <div className="px-4 pt-1">
                                                            <button
                                                                onClick={() => {
                                                                    setSortBy('newest');
                                                                    setFilterMode('all');
                                                                }}
                                                                className="w-full px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-center"
                                                            >
                                                                Clear All Filters
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden shadow-inner">
                                <button
                                    onClick={() => handleTabChange('directory')}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                                        activeTab === 'directory'
                                            ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Users className="w-4 h-4" />
                                    <span>Directory</span>
                                </button>
                                <button
                                    onClick={() => handleTabChange('visitors')}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                                        activeTab === 'visitors'
                                            ? "bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Milestone className="w-4 h-4" />
                                    <span>Pipeline</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={cn(
                "max-w-7xl mx-auto transition-all duration-300",
                activeTab === 'directory' ? "px-6 py-8" : "p-0"
            )}>
                {activeTab === 'directory' ? (
                    <div className="space-y-6">
                        {/* Stats Row for Directory could go here */}
                        <DirectoryTab searchQuery={searchQuery} />
                    </div>
                ) : (
                    <VisitorPipeline
                        externalSearch={searchQuery}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        filterMode={filterMode}
                        setFilterMode={setFilterMode}
                    />
                )}
            </div>
        </div>
    );
}


// Sub-component for the original User Directory logic
function DirectoryTab({ searchQuery }: { searchQuery?: string }) {
    const { userData } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'users'), orderBy('email', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            })) as UserData[];
            setUsers(usersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleRoleChange = async (targetUid: string, newRole: string) => {
        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

        setUpdating(targetUid);
        try {
            const updateUserRoleFn = httpsCallable(functions, 'updateUserRole');
            await updateUserRoleFn({ targetUid, newRole });
        } catch (error: any) {
            console.error('Error updating role:', error);
            alert(`Failed to update role: ${error.message}`);
        } finally {
            setUpdating(null);
        }
    };

    // Filter users based on searchQuery
    const filteredUsers = users.filter(user => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            user.displayName?.toLowerCase().includes(q) ||
            user.email?.toLowerCase().includes(q) ||
            user.role?.toLowerCase().includes(q)
        );
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-muted-foreground text-sm">Loading member directory...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            {/* Table Header Wrapper */}
            <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground">Registered Members</h3>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] uppercase tracking-wider">
                        Directory
                    </Badge>
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                    Showing {filteredUsers.length} of {users.length} total
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</th>
                            <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role Access</th>
                            <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {filteredUsers.map((user) => (
                            <tr key={user.uid} className="group hover:bg-gray-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-gray-500 dark:text-zinc-400 group-hover:scale-105 transition-transform">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <User className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-foreground">{user.displayName || 'Unnamed Member'}</span>
                                            <span className="text-[10px] text-muted-foreground block md:hidden">{user.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-muted-foreground hidden md:table-cell font-mono">
                                    {user.email}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                                        user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                            user.role === 'staff' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                user.role === 'pastor_admin' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                                    'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'
                                    )}>
                                        {(user.role === 'admin' || user.role === 'pastor_admin') && <Shield className="w-2.5 h-2.5 mr-1" />}
                                        {user.role || 'member'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <select
                                            disabled={updating === user.uid || user.uid === userData?.uid}
                                            value={user.role || 'member'}
                                            onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                                            className="text-xs bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-foreground rounded-lg px-2 py-1.5 focus:border-purple-500 focus:ring-purple-500/20 disabled:opacity-50 transition-all cursor-pointer hover:border-gray-300 shadow-sm"
                                        >
                                            <option value="member">Member</option>
                                            <option value="staff">Staff</option>
                                            <option value="pastor_admin">Pastor Admin</option>
                                            <option value="media_admin">Media Admin</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        {updating === user.uid && (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredUsers.length === 0 && (
                    <div className="px-6 py-12 text-center">
                        <p className="text-muted-foreground text-sm">No members found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

