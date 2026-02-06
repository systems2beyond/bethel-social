'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Users, Settings, Music, BookOpen, Heart, Coffee, Shield, Church } from 'lucide-react';
import * as Icons from 'lucide-react';
import { VolunteerNav } from '@/components/Admin/VolunteerNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMinistry } from '@/context/MinistryContext';
import { MinistryModal } from '@/components/Admin/MinistryModal';
import { Ministry } from '@/types';
import { MetricCard } from '@/components/Admin/PeopleHub/MetricCard';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// Helper to get dynamic icons
const getIcon = (iconName?: string): LucideIcon => {
    if (!iconName) return Users;
    const IconComponent = (Icons as unknown as Record<string, LucideIcon>)[iconName];
    return IconComponent || Users;
};

export default function MinistriesPage() {
    const { ministries, loading, addMinistry, updateMinistry } = useMinistry();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMinistry, setSelectedMinistry] = useState<Ministry | null>(null);

    const filteredMinistries = ministries.filter((m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openCreate = () => {
        setSelectedMinistry(null);
        setIsModalOpen(true);
    };

    const openEdit = (ministry: Ministry) => {
        setSelectedMinistry(ministry);
        setIsModalOpen(true);
    };

    const handleCreate = async (data: Partial<Ministry>) => {
        await addMinistry(data as Omit<Ministry, 'id' | 'createdAt' | 'updatedAt'>);
        setIsModalOpen(false);
    };

    const handleUpdate = async (data: Partial<Ministry>) => {
        if (selectedMinistry) {
            await updateMinistry(selectedMinistry.id, data);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header - Copper Style */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Left: Back + Title */}
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <Icons.ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600">
                                        <Heart className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">Ministries</h1>
                                    <Button variant="outline" size="sm" onClick={openCreate} className="ml-2 h-7 px-2">
                                        <Plus className="w-3 h-3 mr-1" /> New
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Manage your church ministries and team structures
                                </p>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                                <Icons.Settings className="h-4 w-4 mr-2" />
                                Settings
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* Navigation Tabs */}
                <VolunteerNav />

                {/* Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        title="Total Ministries"
                        value={ministries.length.toString()}
                        icon={Church}
                        description="Active ministry teams"
                        change="+1"
                        trend="up"
                    />
                    <MetricCard
                        title="Active Roles"
                        value={ministries.reduce((acc, m) => acc + (m.roles?.length || 0), 0).toString()}
                        icon={Shield}
                        description="Volunteering positions"
                        change="+3"
                        trend="up"
                    />
                    <MetricCard
                        title="Drafts/Inactive"
                        value={ministries.filter(m => !m.active).length.toString()}
                        icon={Settings}
                        description="Requires attention"
                        change="0"
                        trend="neutral"
                    />
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search ministries..."
                            className="pl-10 h-10 bg-gray-50/50 dark:bg-zinc-950/50 border-none ring-1 ring-gray-200 dark:ring-zinc-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <Icons.Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-4" />
                        <p className="text-muted-foreground">Loading ministries...</p>
                    </div>
                ) : filteredMinistries.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-gray-300 dark:border-zinc-800">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No ministries found</h3>
                        <p className="text-muted-foreground mb-6">Get started by creating your first ministry team.</p>
                        <Button onClick={openCreate} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Ministry
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {filteredMinistries.map((ministry) => {
                            const MinistryIcon = getIcon(ministry.icon);
                            return (
                                <div
                                    key={ministry.id}
                                    className={cn(
                                        "group relative bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800",
                                        "hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden",
                                        "flex flex-col h-full"
                                    )}
                                >
                                    {/* Accent Border */}
                                    <div
                                        className="h-1.5 w-full opacity-70 group-hover:opacity-100 transition-opacity"
                                        style={{ backgroundColor: ministry.color || '#10b981' }}
                                    />

                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-6">
                                            <div
                                                className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 group-hover:scale-110 transition-transform duration-300"
                                                style={{ boxShadow: `0 8px 16px -4px ${ministry.color}20` }}
                                            >
                                                <MinistryIcon className="w-6 h-6" style={{ color: ministry.color }} />
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm"
                                                    onClick={() => openEdit(ministry)}
                                                >
                                                    <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                </Button>
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold tracking-tight text-foreground mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                            {ministry.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[40px] leading-relaxed">
                                            {ministry.description || 'No description provided.'}
                                        </p>

                                        <div className="mt-auto space-y-4 pt-6 border-t border-gray-50 dark:border-zinc-800/50">
                                            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {ministry.roles?.length || 0} Open Roles
                                                </span>
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-full text-[10px]",
                                                    ministry.active
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-800'
                                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                                                )}>
                                                    {ministry.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <Link href={`/admin/ministries/${ministry.id}`} className="block">
                                                <Button className="w-full h-11 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-none font-semibold group/btn relative overflow-hidden">
                                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                                        Manage Team
                                                        <Plus className="w-4 h-4 group-hover/btn:rotate-90 transition-transform" />
                                                    </span>
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <MinistryModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    ministry={selectedMinistry}
                    onSave={selectedMinistry ? handleUpdate : handleCreate}
                />
            </div>
        </div>
    );

}
