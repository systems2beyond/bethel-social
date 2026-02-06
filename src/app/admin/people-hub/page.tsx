"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Users,
    UserPlus,
    Calendar,
    Settings,
    Search as SearchIcon, // Renamed to avoid confusion
    Filter,
    BarChart3,
    ArrowRight,
    ChevronRight,
    Heart,
    Briefcase,
    GraduationCap,
    Sparkles,
    Baby,
    Megaphone,
    ListTodo,
    ClipboardList,
    Layers
} from "lucide-react";
import { MetricCard } from "@/components/Admin/PeopleHub/MetricCard";
import { LifeEventsCard } from "@/components/Admin/PeopleHub/LifeEventsCard";
import { AddMemberModal } from "@/components/Admin/PeopleHub/AddMemberModal";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { LifeEvent } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardMetrics {
    totalMembers: number;
    activeMembers: number; // For demo/simulation
    newMembers: number;
    growthRate: string;
    avgAttendance: number;
    attendanceTrend: string;
}

const QuickActionCard = ({
    title,
    description,
    icon: Icon,
    href,
    color = 'purple',
    className
}: {
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
    color?: 'purple' | 'blue' | 'green' | 'coral' | 'amber';
    className?: string;
}) => {
    const colorClasses = {
        purple: 'from-purple-500 to-indigo-600',
        blue: 'from-blue-500 to-cyan-600',
        green: 'from-emerald-500 to-teal-600',
        coral: 'from-rose-500 to-pink-600',
        amber: 'from-amber-500 to-orange-600'
    };

    return (
        <Link href={href} className={cn("group block h-full", className)}>
            <div className={cn(
                "relative p-5 rounded-xl border border-gray-100 dark:border-zinc-800",
                "bg-white dark:bg-zinc-900 shadow-sm",
                "hover:shadow-lg hover:-translate-y-0.5",
                "transition-all duration-300 h-full flex flex-col justify-between"
            )}>
                <div className="flex items-start gap-4">
                    <div className={cn(
                        "p-3 rounded-xl bg-gradient-to-br text-white shadow-sm flex-shrink-0",
                        colorClasses[color]
                    )}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 dark:text-zinc-100 group-hover:text-rose-500 transition-colors">
                            {title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {description}
                        </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
        </Link>
    );
};

export default function PeopleHubDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [showAllActions, setShowAllActions] = useState(false);

    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalMembers: 0,
        activeMembers: 0,
        newMembers: 0,
        growthRate: "—",
        avgAttendance: 0,
        attendanceTrend: "—"
    });
    const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Simulating realistic delays for smooth loading state
                // In production, these would be Promise.all
                const membersColl = collection(db, 'users');
                const snapshot = await getCountFromServer(membersColl);
                const total = snapshot.data().count;

                // Create somewhat realistic derived metrics for demo
                setMetrics({
                    totalMembers: total,
                    activeMembers: Math.floor(total * 0.85),
                    newMembers: Math.floor(total * 0.05),
                    growthRate: "+5.2%",
                    avgAttendance: Math.floor(total * 0.6),
                    attendanceTrend: "+2.1%"
                });

                // Fetch Life Events
                const eventsQuery = query(
                    collection(db, 'life_events'),
                    orderBy('createdAt', 'desc'),
                    limit(5)
                );
                const eventsSnapshot = await getDocs(eventsQuery);
                const eventsData = eventsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as LifeEvent[];
                setLifeEvents(eventsData);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const query = e.currentTarget.value;
            if (query.trim()) {
                router.push(`/admin/people-hub/members?search=${encodeURIComponent(query)}`);
            }
        }
    };

    const handleFilterClick = () => {
        router.push('/admin/people-hub/members?filter=open');
    };

    const quickActions = [
        {
            title: "Member Directory",
            description: "View and manage all church members",
            icon: Users,
            href: "/admin/people-hub/members",
            color: "purple" as const
        },
        {
            title: "Life Events",
            description: "Track significant moments and needs",
            icon: Heart,
            href: "/admin/people-hub/life-events",
            color: "coral" as const
        },
        {
            title: "Visitor Pipeline",
            description: "Manage guest follow-ups and assimilation",
            icon: UserPlus,
            href: "/admin/people-hub/pipeline",
            color: "green" as const
        },
        {
            title: "Manage Groups",
            description: "Organize small groups and teams",
            icon: Layers,
            href: "/admin/groups", // Placeholder route
            color: "blue" as const
        },
        {
            title: "Volunteer Schedule",
            description: "Coordinate service teams",
            icon: ClipboardList,
            href: "/admin/volunteers", // Placeholder
            color: "amber" as const
        },
        {
            title: "Attendance Reports",
            description: "View detailed engagement stats",
            icon: BarChart3,
            href: "/admin/reports", // Placeholder
            color: "purple" as const
        }
    ];

    const displayedActions = showAllActions ? quickActions : quickActions.slice(0, 3);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50/50 dark:bg-black p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
                <Skeleton className="h-12 w-64" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-black p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-zinc-50">
                        People Hub
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl text-lg">
                        Manage your congregation, track pastoral care, and oversee visitor follow-ups all in one place.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search members..."
                            className="pl-9 h-11 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 rounded-xl"
                            onKeyDown={handleSearch}
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleFilterClick}
                        className="h-11 px-4 rounded-xl border-gray-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900"
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                    </Button>
                    <Button
                        className="h-11 px-6 rounded-xl bg-gray-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-gray-800 dark:hover:bg-zinc-200 shadow-lg shadow-gray-200 dark:shadow-none transition-all hover:scale-105 active:scale-95 font-semibold"
                        onClick={() => setIsAddMemberOpen(true)}
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Member
                    </Button>
                </div>
            </div>

            {/* Metrics Row - Using grid auto-rows and h-full for equal heights */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[1fr]">
                <MetricCard
                    title="Total Members"
                    value={metrics.totalMembers}
                    icon={Users}
                    change={metrics.growthRate !== "—" ? metrics.growthRate : undefined}
                    trend="up"
                    description="Church family"
                    accentColor="purple"
                    className="h-full"
                />
                <MetricCard
                    title="New Visitors"
                    value={metrics.newMembers}
                    icon={UserPlus}
                    change="+12"
                    trend="up"
                    description="This month"
                    accentColor="green"
                    className="h-full"
                />
                <MetricCard
                    title="Avg. Attendance"
                    value={metrics.avgAttendance}
                    icon={Calendar}
                    change={metrics.attendanceTrend}
                    trend="up"
                    description="Last 4 weeks"
                    accentColor="blue"
                    className="h-full"
                />
                <MetricCard
                    title="Active Groups"
                    value="24"
                    icon={Users}
                    description="Small groups meeting"
                    accentColor="coral"
                    className="h-full"
                />
            </div>

            {/* Quick Actions Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Quick Actions
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-zinc-800"
                        onClick={() => setShowAllActions(!showAllActions)}
                    >
                        {showAllActions ? "Show Less" : "View All"}
                    </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[1fr]">
                    {displayedActions.map((action) => (
                        <QuickActionCard
                            key={action.title}
                            {...action}
                        />
                    ))}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-5 items-stretch">
                {/* Left Column: Activity Feed Placeholder - stretched to match */}
                <div className="lg:col-span-3 h-full">
                    <div className="h-full rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/10 mb-5">
                            <Megaphone className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Recent Activity</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            Stay updated with the latest member interactions, notes, and system alerts.
                        </p>
                        <Button variant="outline" className="mt-6 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30">
                            Connect Activity Feed
                        </Button>
                    </div>
                </div>

                {/* Right Column: Life Events Feed - stretched to match */}
                <div className="lg:col-span-2 h-full">
                    <LifeEventsCard events={lifeEvents} loading={loading} className="h-full" />
                </div>
            </div>

            <AddMemberModal open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen} />
        </div>
    );
}
