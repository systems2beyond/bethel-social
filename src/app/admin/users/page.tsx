'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Shield, User, ShieldAlert, Users, Milestone } from 'lucide-react';
import Link from 'next/link';
import VisitorPipeline from '@/components/Admin/VisitorPipeline';

interface UserData {
    uid: string;
    email: string;
    displayName?: string;
    role: 'admin' | 'staff' | 'member';
    createdAt?: any;
}

export default function PeopleHubPage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<'directory' | 'visitors'>('directory');
    const [stats, setStats] = useState({ members: 0, visitors: 0 });

    // Role Check
    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-600 mb-6">You must be an admin to view the People Hub.</p>
                <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Return Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950">
            {/* Header */}
            <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <Link
                    href="/admin"
                    className="text-sm mb-2 inline-block text-zinc-500 hover:text-zinc-300"
                >
                    ← Back to Dashboard
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-zinc-100">People Hub</h1>
                        <p className="text-zinc-500 mt-0.5 text-sm">Manage your community member database and outreach pipeline.</p>
                    </div>

                    {/* Tabs */}
                    <div className="bg-zinc-800 p-1 rounded-lg flex space-x-1">
                        <button
                            onClick={() => setActiveTab('directory')}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                activeTab === 'directory'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            <span>Member Directory</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('visitors')}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                activeTab === 'visitors'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Milestone className="w-4 h-4" />
                            <span>Outreach Pipeline</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className={activeTab === 'directory' ? 'p-4 max-w-6xl mx-auto' : ''}>
                {activeTab === 'directory' ? (
                    <DirectoryTab />
                ) : (
                    <VisitorPipeline />
                )}
            </div>
        </div>
    );
}

// Sub-component for the original User Directory logic
function DirectoryTab() {
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
            alert('Role updated successfully!');
        } catch (error: any) {
            console.error('Error updating role:', error);
            alert(`Failed to update role: ${error.message}`);
        } finally {
            setUpdating(null);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Header / Filter placeholder */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-semibold text-zinc-200">Registered Users</h3>
                <div className="text-xs text-zinc-500">Total: {users.length}</div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-zinc-800/50 border-b border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {users.map((user) => (
                            <tr key={user.uid} className="hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <span className="font-medium text-zinc-100">{user.displayName || 'No Name'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-400">{user.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                        user.role === 'staff' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-zinc-700 text-zinc-300'
                                        }`}>
                                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                                        {user.role || 'member'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        disabled={updating === user.uid || user.uid === userData?.uid}
                                        value={user.role || 'member'}
                                        onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                                        className="text-sm bg-zinc-800 border-zinc-700 text-zinc-200 rounded-md focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50"
                                    >
                                        <option value="member">Member</option>
                                        <option value="staff">Staff</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    {updating === user.uid && (
                                        <Loader2 className="w-4 h-4 animate-spin inline-ml-2 text-blue-400" />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
