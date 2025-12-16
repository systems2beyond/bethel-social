import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Check, User as UserIcon, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// User interface matching Firestore schema
export interface PublicUser {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
}

interface UserInvitationGridProps {
    selectedUsers: PublicUser[];
    onSelectionChange: (users: PublicUser[]) => void;
}

export default function UserInvitationGrid({ selectedUsers, onSelectionChange }: UserInvitationGridProps) {
    const { user } = useAuth();
    const [users, setUsers] = useState<PublicUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Query users (limited to 50 for now for performance)
        // In a real app we'd want pagination or specific search queries
        // Note: 'createdAt' index might be needed. If it fails, fallback to simple full collection if small.
        const q = query(
            collection(db, 'users'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedUsers: PublicUser[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Exclude current user and ensure email exists
                // Simulating "Public" users - checking if they have a profile
                if (doc.id !== user?.uid && data.email) {
                    loadedUsers.push({
                        uid: doc.id,
                        displayName: data.displayName || data.email?.split('@')[0] || 'Unknown', // Fallback name
                        email: data.email,
                        photoURL: data.photoURL
                    });
                }
            });
            // Sort client side for now to avoid specific index requirement
            loadedUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
            setUsers(loadedUsers);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    // Derived filtered list for search
    const filteredUsers = users.filter((u) => {
        if (!searchTerm) return true;
        const lowSearch = searchTerm.toLowerCase();
        return (
            (u.displayName?.toLowerCase().includes(lowSearch)) ||
            (u.email?.toLowerCase().includes(lowSearch))
        );
    });

    const toggleUser = (targetUser: PublicUser) => {
        // Prevent toggle if email is null/empty (though filtered out already)
        if (!targetUser.email) return;

        const exists = selectedUsers.some(u => u.uid === targetUser.uid);

        if (exists) {
            onSelectionChange(selectedUsers.filter(u => u.uid !== targetUser.uid));
        } else {
            onSelectionChange([...selectedUsers, targetUser]);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 text-gray-400 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search people..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                {filteredUsers.map((u) => {
                    const isSelected = selectedUsers.some(sel => sel.uid === u.uid);
                    return (
                        <button
                            key={u.uid}
                            type="button" // Prevent form submit
                            onClick={() => toggleUser(u)}
                            className="group relative flex flex-col items-center text-center gap-1.5 p-2 rounded-xl transition-all outline-none"
                        >
                            {/* Avatar Bubble */}
                            <div className={cn(
                                "relative w-12 h-12 rounded-full flex items-center justify-center transition-all border-2 shrink-0 overflow-hidden",
                                isSelected
                                    ? "border-blue-500 ring-2 ring-blue-500/20 ring-offset-2 dark:ring-offset-zinc-900"
                                    : "border-gray-200 dark:border-zinc-700 group-hover:border-blue-300 dark:group-hover:border-blue-700"
                            )}>
                                {u.photoURL ? (
                                    <img
                                        src={u.photoURL}
                                        alt={u.displayName || 'User'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                                        </span>
                                    </div>
                                )}

                                {/* Selected Checkmark Overlay */}
                                <AnimatePresence>
                                    {isSelected && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0 }}
                                            className="absolute inset-0 bg-blue-500/30 backdrop-blur-[1px] flex items-center justify-center z-10"
                                        >
                                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                                <Check className="w-3 h-3 text-white stroke-[3]" />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Name Info */}
                            <div className="w-full">
                                <p className={cn(
                                    "text-[10px] font-semibold truncate leading-tight transition-colors px-1",
                                    isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                                )}>
                                    {u.displayName || 'Unknown'}
                                </p>
                            </div>
                        </button>
                    );
                })}

                {filteredUsers.length === 0 && (
                    <div className="col-span-full py-8 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {searchTerm ? `No users found matching "${searchTerm}"` : 'No other users found'}
                        </p>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-100 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-zinc-900 px-2 text-gray-400">or manually add</span>
                </div>
            </div>
        </div>
    );
}
