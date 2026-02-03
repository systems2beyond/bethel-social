'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Calendar, Users, MessageSquare, Bell, User, LogOut, Settings, PlayCircle, Sun, Moon, Book, BookOpen, Heart, HardDrive } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn, safeTimestamp } from '@/lib/utils';
import { useBible } from '@/context/BibleContext';
import { useAuth } from '@/context/AuthContext';
import { useActivity } from '@/context/ActivityContext';

// Mock data for recent chats
const recentChats = [
    { id: 1, title: "Sunday's Sermon Notes", date: '2h ago' },
    { id: 2, title: "Bible Study: John 3:16", date: '1d ago' },
    { id: 3, title: "Prayer Request", date: '2d ago' },
];

import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { Menu, GripVertical, DollarSign } from 'lucide-react';
import { useChurchConfig } from '@/hooks/useChurchConfig';

// Public routes that don't need sidebar
// Public routes that don't need sidebar
const PUBLIC_ROUTES = ['/connect'];

export function Sidebar() {
    const pathname = usePathname();
    const { theme, setTheme, resolvedTheme } = useTheme();
    const { openBible, openStudy } = useBible();
    const { userData } = useAuth();
    const [mounted, setMounted] = React.useState(false);

    // Responsive Breakpoints
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const isTabletLandscape = useMediaQuery('(min-width: 768px) and (orientation: landscape)');
    const isMobileOrTabletPortrait = !isDesktop && !isTabletLandscape;

    const [isOpen, setIsOpen] = React.useState(true);

    // Auto-close on mobile/tablet portrait, auto-open on desktop/landscape
    React.useEffect(() => {
        if (isMobileOrTabletPortrait) {
            setIsOpen(false);
        } else {
            setIsOpen(true);
        }
    }, [isMobileOrTabletPortrait]);

    // Debug initial state
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const { config } = useChurchConfig();
    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin' || userData?.role === 'pastor_admin' || userData?.role === 'media_admin';

    const navItems = [
        { icon: Home, label: 'Home', href: '/' },
        { icon: Heart, label: 'Fellowship', href: '/fellowship' },
        { icon: PlayCircle, label: 'Sermons', href: '/sermons' },
        { icon: MessageSquare, label: 'Notes', href: '/notes' },
        { icon: Book, label: 'Bible', onClick: () => openStudy() },
        { icon: Calendar, label: 'Events', href: '/events' },
        { icon: Users, label: 'Groups', href: '/groups' },
    ];

    // Conditionally add Giving if enabled in church config
    if (config?.features?.giving) {
        navItems.splice(2, 0, { icon: DollarSign, label: 'Giving', href: '/giving' });
    }

    // Don't render sidebar on public pages
    if (PUBLIC_ROUTES.some(route => pathname?.startsWith(route))) {
        return null;
    }


    // Add Admin link for authorized users



    return (
        <>
            {/* Vertical Hamburger Trigger (Mobile/Tablet Portrait) */}
            <AnimatePresence>
                {!isOpen && isMobileOrTabletPortrait && (
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        drag="y"
                        dragConstraints={{ top: 100, bottom: 600 }} // Avoid toolbar (top) and bottom nav
                        dragElastic={0.1}
                        dragMomentum={false}
                        onClick={() => setIsOpen(true)}
                        className="fixed top-4 left-0 z-[20001] p-2 bg-white dark:bg-zinc-900 border-y border-r border-gray-200 dark:border-zinc-800 rounded-r-lg shadow-md touch-manipulation cursor-pointer"
                    >
                        <GripVertical className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <AnimatePresence mode="wait">
                {isOpen && (
                    <>
                        {/* Overlay for Mobile/Tablet Portrait */}
                        {isMobileOrTabletPortrait && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 bg-black/50 z-[19999]"
                            />
                        )}

                        <motion.div
                            initial={isMobileOrTabletPortrait ? { x: -280 } : false}
                            animate={{ x: 0 }}
                            exit={isMobileOrTabletPortrait ? { x: -280 } : undefined}
                            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                            className={cn(
                                "w-64 h-screen bg-gray-50 dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col flex-shrink-0 transition-colors duration-300",
                                isMobileOrTabletPortrait ? "fixed top-0 left-0 z-[20000] shadow-2xl" : "relative"
                            )}
                        >
                            {/* Logo */}
                            <div className="p-6 flex items-center justify-between">
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    Bethel Social
                                </h1>
                                {isMobileOrTabletPortrait && (
                                    <button onClick={() => setIsOpen(false)} className="md:hidden">
                                        <Menu className="w-5 h-5 text-gray-500" />
                                    </button>
                                )}
                            </div>

                            {/* Navigation */}
                            <nav className="px-4 space-y-1">
                                {navItems.map((item) => {
                                    if (item.onClick) {
                                        return (
                                            <button
                                                key={item.label}
                                                onClick={() => {
                                                    item.onClick();
                                                    if (isMobileOrTabletPortrait) setIsOpen(false);
                                                }}
                                                className={cn(
                                                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full text-left",
                                                    "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                                )}
                                            >
                                                <item.icon className="w-5 h-5" />
                                                <span className="font-medium">{item.label}</span>
                                            </button>
                                        );
                                    }

                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href || item.label}
                                            href={item.href || '#'}
                                            onClick={() => isMobileOrTabletPortrait && setIsOpen(false)}
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
                                    onClick={() => {
                                        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
                                        console.log(`[Theme Toggle] Switching to: ${newTheme}`);
                                        console.log('Pre-Switch Classes:', document.documentElement.classList.toString());
                                        setTheme(newTheme);
                                    }}
                                    className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    {mounted && resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                    <span className="font-medium">
                                        {mounted && resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                                    </span>
                                </button>

                                <UserSection />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}



function UserSection() {
    const { user, userData, signInWithGoogle, signInWithYahoo, signInWithFacebook, signOut, loading } = useAuth();
    const { setActivityPanelOpen, notifications, invitations } = useActivity();
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



    // Notification count from context
    const notificationCount = notifications.filter(n => !n.viewed).length + invitations.filter(i => !i.viewed).length;

    return (
        <div className="flex items-center space-x-2 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden relative flex-shrink-0">
                {user.photoURL ? (
                    <img src={user.photoURL} alt={userData?.displayName || user.displayName || 'User'} className="w-full h-full object-cover" />
                ) : (
                    (userData?.displayName?.[0] || user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {userData?.displayName || user.displayName || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>



            <button
                onClick={() => setActivityPanelOpen(true)}
                className="relative p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="Activity"
            >
                <Bell className="w-4 h-4 text-gray-500 hover:text-indigo-600" />
                {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center">
                        {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                )}
            </button>

            <button
                onClick={() => router.push('/settings')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="Settings"
            >
                <Settings className="w-4 h-4 text-gray-500 hover:text-blue-600" />
            </button>


        </div>
    );
}

import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
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
                    onClick={async () => {
                        await createNewChat();
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
                            {(() => {
                                const date = safeTimestamp(chat.updatedAt);
                                return date ? date.toLocaleDateString() : 'Recently';
                            })()}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}
