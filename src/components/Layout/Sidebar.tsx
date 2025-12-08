'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Calendar, Heart, MessageSquare, Moon, Sun, Settings, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils'; // Assuming utils exists, or I'll use clsx/twMerge directly if not

// Mock data for recent chats
const recentChats = [
    { id: 1, title: "Sunday's Sermon Notes", date: '2h ago' },
    { id: 2, title: "Bible Study: John 3:16", date: '1d ago' },
    { id: 3, title: "Prayer Request", date: '2d ago' },
];

export function Sidebar() {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { icon: Home, label: 'Home', href: '/' },
        { icon: BookOpen, label: 'Sermons', href: '/sermons' },
        { icon: MessageSquare, label: 'Notes', href: '/notes' },
        { icon: Calendar, label: 'Events', href: '/events' },
        { icon: Heart, label: 'Giving', href: '/giving' },
    ];

    return (
        <div className="w-64 h-screen bg-gray-50 dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col flex-shrink-0 transition-colors duration-300">
            {/* Logo */}
            <div className="p-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Bethel Social
                </h1>
            </div>

            {/* Navigation */}
            <nav className="px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Recent Chats Section */}
            <RecentChats />

            {/* Spacer */}
            <div className="flex-1" />

            {/* User & Settings */}
            <div className="p-4 border-t border-gray-200 dark:border-zinc-800 space-y-2">
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    {mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="font-medium">
                        {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                </button>

                <UserSection />
            </div>
        </div>
    );
}

import { useAuth } from '@/context/AuthContext';
import { LogIn } from 'lucide-react';

function UserSection() {
    const { user, userData, signInWithGoogle, signInWithYahoo, signInWithFacebook, signOut, loading } = useAuth();
    const router = useRouter();

    if (loading) return <div className="h-12 animate-pulse bg-gray-100 dark:bg-zinc-800 rounded-lg mx-4" />;

    if (!user) {
        return (
            <div className="space-y-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Sign In With
                </p>
                <div className="px-4 grid grid-cols-3 gap-2">
                    <button
                        onClick={signInWithGoogle}
                        className="flex items-center justify-center p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        title="Google"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    </button>
                    <button
                        onClick={signInWithFacebook}
                        className="flex items-center justify-center p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-blue-600"
                        title="Facebook"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                    </button>
                    <button
                        onClick={signInWithYahoo}
                        className="flex items-center justify-center p-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors text-purple-600"
                        title="Yahoo"
                    >
                        <span className="font-bold text-xs">Y!</span>
                    </button>
                </div>
            </div>
        );
    }

    const isAdmin = userData?.role === 'admin';

    return (
        <div className="flex items-center space-x-2 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden relative flex-shrink-0">
                {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                    (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.displayName || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>

            {isAdmin && (
                <button
                    onClick={() => router.push('/admin')}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Admin Settings"
                >
                    <Settings className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                </button>
            )}

            <button
                onClick={signOut}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="Sign Out"
            >
                <LogOut className="w-4 h-4 text-gray-400 hover:text-red-500" />
            </button>
        </div>
    );
}

import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useChat } from '@/context/ChatContext';
import { useRouter } from 'next/navigation';

import { Plus } from 'lucide-react';

function RecentChats() {
    const { user } = useAuth();
    const { loadChat, createNewChat } = useChat();
    const router = useRouter();
    const [chats, setChats] = React.useState<any[]>([]);

    React.useEffect(() => {
        if (!user) {
            setChats([]);
            return;
        }

        const q = query(
            collection(db, 'users', user.uid, 'chats'),
            orderBy('updatedAt', 'desc'),
            limit(5)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setChats(snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })));
        });

        return () => unsubscribe();
    }, [user]);

    if (!user || chats.length === 0) return null;

    return (
        <div className="mt-8 px-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Recent Chats
                </h3>
                <button
                    onClick={() => {
                        createNewChat();
                        router.push('/chat');
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="New Chat"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="space-y-3">
                {chats.map((chat) => (
                    <button
                        key={chat.id}
                        onClick={() => {
                            loadChat(chat.id);
                            router.push('/chat');
                        }}
                        className="w-full text-left group"
                    >
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                            {chat.title || 'New Chat'}
                        </p>
                        <p className="text-xs text-gray-400">
                            {chat.updatedAt?.toDate().toLocaleDateString()}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}
