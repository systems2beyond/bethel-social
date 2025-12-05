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
            <div className="mt-8 px-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Recent Chats
                </h3>
                <div className="space-y-3">
                    {recentChats.map((chat) => (
                        <button
                            key={chat.id}
                            className="w-full text-left group"
                        >
                            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                                {chat.title}
                            </p>
                            <p className="text-xs text-gray-400">
                                {chat.date}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

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

                <div className="flex items-center space-x-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                        RS
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">Ryan Syffus</p>
                        <p className="text-xs text-gray-500 truncate">Admin</p>
                    </div>
                    <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                </div>
            </div>
        </div>
    );
}
