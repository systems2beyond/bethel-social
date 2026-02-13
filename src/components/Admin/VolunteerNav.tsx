
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Heart, Users } from 'lucide-react';

export function VolunteerNav() {
    const pathname = usePathname();

    const links = [
        { href: '/admin/ministries', label: 'Ministries', icon: Heart },
        { href: '/admin/volunteers', label: 'Volunteers', icon: Users },
    ];

    return (
        <div className="flex space-x-1 mb-6 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-gray-100 dark:border-zinc-800 w-fit">
            {links.map(link => {
                const isActive = pathname === link.href;
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-nowrap",
                            isActive
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shadow-sm"
                                : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                        )}
                    >
                        <link.icon className="w-4 h-4" />
                        <span>{link.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
