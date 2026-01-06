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
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setLoading(true);
        let q;

        // "True" DB Search if input is sufficient length
        if (debouncedSearch.length >= 2) {
            // Note: This is case-sensitive. Ideally use a lowercase 'searchName' field in DB.
            // For now, assume standard capitalization or exact match attempts.
            q = query(
                collection(db, 'users'),
                where('displayName', '>=', debouncedSearch),
                where('displayName', '<=', debouncedSearch + '\uf8ff'),
                limit(20)
            );
        } else {
            // Default load (increased to 100)
            q = query(
                collection(db, 'users'),
                limit(100)
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedUsers: PublicUser[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (doc.id !== user?.uid && data.email) {
                    loadedUsers.push({
                        uid: doc.id,
                        displayName: data.displayName || data.email?.split('@')[0] || 'Unknown',
                        email: data.email,
                        photoURL: data.photoURL
                    });
                }
            });
            // Client-side sort
            loadedUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
            setUsers(loadedUsers);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching users:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid, debouncedSearch]);

    const toggleUser = (targetUser: PublicUser) => {
        if (!targetUser.email) return;

        const exists = selectedUsers.some(u => u.uid === targetUser.uid);
        if (exists) {
            onSelectionChange(selectedUsers.filter(u => u.uid !== targetUser.uid));
        } else {
            onSelectionChange([...selectedUsers, targetUser]);
        }
    };

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50 group-focus-within:text-cyan-400 transition-colors" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search people..."
                    className="w-full pl-9 pr-4 py-3 bg-black/20 dark:bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 outline-none text-sm text-gray-200 placeholder-gray-500 transition-all font-medium"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                {loading ? (
                    <div className="col-span-full py-8 flex justify-center text-cyan-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="col-span-full py-8 text-center">
                        <p className="text-sm text-gray-500">
                            No users found matching "{searchTerm}"
                        </p>
                    </div>
                ) : (
                    users.map((u) => {
                        const isSelected = selectedUsers.some(sel => sel.uid === u.uid);
                        return (
                            <button
                                key={u.uid}
                                type="button"
                                onClick={() => toggleUser(u)}
                                className="group relative flex flex-col items-center text-center gap-2 p-2 rounded-2xl transition-all outline-none"
                            >
                                {/* Avatar Bubble */}
                                <div className={cn(
                                    "relative w-12 h-12 rounded-full flex items-center justify-center transition-all border-2 shrink-0 overflow-hidden",
                                    isSelected
                                        ? "border-cyan-500 shadow-[0_0_15px_-3px_rgba(6,182,212,0.6)]"
                                        : "border-white/10 group-hover:border-cyan-500/50"
                                )}>
                                    {u.photoURL ? (
                                        <img
                                            src={u.photoURL}
                                            alt={u.displayName || 'User'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                            <span className="text-sm font-bold text-gray-500 group-hover:text-cyan-400 transition-colors">
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
                                                className="absolute inset-0 bg-cyan-500/40 backdrop-blur-[1px] flex items-center justify-center z-10"
                                            >
                                                <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-md">
                                                    <Check className="w-3 h-3 text-black stroke-[3]" />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Name Info */}
                                <div className="w-full">
                                    <p className={cn(
                                        "text-[10px] font-semibold truncate leading-tight transition-colors px-1",
                                        isSelected ? "text-cyan-400" : "text-gray-400 group-hover:text-gray-200"
                                    )}>
                                        {u.displayName || 'Unknown'}
                                    </p>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/5" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                    <span className="bg-transparent px-2 text-gray-600 font-semibold">or select from list</span>
                </div>
            </div>
        </div>
    );
}
