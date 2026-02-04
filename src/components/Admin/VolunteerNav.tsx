'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Heart, Users, Calendar, ArrowLeft } from 'lucide-react';

export function VolunteerNav() {
    const pathname = usePathname();

    const links = [
        { href: '/admin/ministries', label: 'Ministries', icon: Heart },
        { href: '/admin/volunteers', label: 'Directory', icon: Users },
        { href: '/admin/schedule', label: 'Schedule', icon: Calendar },
    ];

    return (
        <div className="mb-8">
            <div className="flex items-center space-x-2 text-gray-500 mb-4">
                <Link href="/admin" className="hover:text-gray-900 flex items-center transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </Link>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Volunteer Management</h1>
                    <p className="text-gray-500">Coordinate your teams and services.</p>
                </div>
            </div>

            <div className="flex space-x-1 mt-6 bg-white p-1 rounded-xl border border-gray-200 w-fit">
                {links.map(link => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                isActive
                                    ? "bg-teal-50 text-teal-700 shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            <link.icon className="w-4 h-4" />
                            <span>{link.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
