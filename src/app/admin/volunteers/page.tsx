
'use client';

import React, { useState, useEffect } from 'react';
import { useMinistry } from '@/context/MinistryContext';
import { VolunteerService } from '@/lib/volunteer-service';
import { FirestoreUser, VolunteerProfile } from '@/types';
import { VolunteerNav } from '@/components/Admin/VolunteerNav';
import { VolunteerProfileModal } from '@/components/Admin/VolunteerProfileModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    Loader2,
    Search,
    Filter,
    Mail,
    Phone,
    MoreHorizontal,
    CheckCircle,
    AlertCircle,
    Calendar,
    Users,
    UserPlus,
    ArrowLeft,
    ChevronDown,
    Download,
    ShieldCheck,
    Clock,
    Heart
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Stats card component
const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) => (
    <div className={cn(
        "flex items-center gap-4 px-5 py-4 rounded-xl border",
        "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 shadow-sm"
    )}>
        <div className={cn("p-3 rounded-xl", color)}>
            <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    </div>
);

export default function VolunteerDirectoryPage() {
    const { userData } = useAuth();
    const churchId = userData?.churchId;
    const { ministries } = useMinistry();
    const [volunteers, setVolunteers] = useState<FirestoreUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchName, setSearchName] = useState('');
    const [selectedMinistryId, setSelectedMinistryId] = useState<string>('all');
    const [selectedDay, setSelectedDay] = useState<string>('all');

    // Modal
    const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchVolunteers = async () => {
        if (!churchId) return;
        setLoading(true);
        try {
            const filters: any = {};
            if (selectedMinistryId !== 'all') filters.ministry = selectedMinistryId;
            if (selectedDay !== 'all') filters.availableDay = selectedDay;

            const results = await VolunteerService.searchVolunteers(churchId, filters);

            let filtered = results;
            if (searchName) {
                const lower = searchName.toLowerCase();
                filtered = results.filter(u =>
                    u.displayName.toLowerCase().includes(lower) ||
                    u.email.toLowerCase().includes(lower)
                );
            }
            setVolunteers(filtered);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVolunteers();
    }, [churchId, selectedMinistryId, selectedDay, searchName]);

    const handleEdit = (user: FirestoreUser) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const getMinistryNames = (ids?: string[]) => {
        if (!ids) return [];
        return ids.map(id => ministries.find(m => m.id === id)?.name).filter(Boolean);
    };

    // Stats
    const totalVolunteers = volunteers.length;
    const verifiedCount = volunteers.filter(v => v.volunteerProfile?.backgroundCheckStatus === 'approved').length;
    const pendingCount = volunteers.filter(v => !v.volunteerProfile?.backgroundCheckStatus || v.volunteerProfile?.backgroundCheckStatus === 'pending').length;

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
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                                        <Heart className="h-4 w-4 text-white" />
                                    </div>
                                    <h1 className="text-xl font-bold text-foreground">Volunteer Management</h1>
                                    <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        {totalVolunteers} volunteers
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Manage volunteer assignments, schedules, and clearances
                                </p>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="hidden sm:flex">
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>
                            <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm">
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Volunteer
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

                {/* Navigation Tabs */}
                <VolunteerNav />

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        label="Total Volunteers"
                        value={totalVolunteers}
                        icon={Users}
                        color="bg-gradient-to-br from-emerald-500 to-teal-600"
                    />
                    <StatCard
                        label="Background Verified"
                        value={verifiedCount}
                        icon={ShieldCheck}
                        color="bg-gradient-to-br from-green-500 to-emerald-600"
                    />
                    <StatCard
                        label="Pending Review"
                        value={pendingCount}
                        icon={Clock}
                        color="bg-gradient-to-br from-amber-500 to-orange-600"
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-10 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={selectedMinistryId} onValueChange={setSelectedMinistryId}>
                            <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-900">
                                <SelectValue placeholder="All Ministries" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Ministries</SelectItem>
                                {ministries.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedDay} onValueChange={setSelectedDay}>
                            <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900">
                                <SelectValue placeholder="Any Day" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any Availability</SelectItem>
                                <SelectItem value="sunday">Sunday</SelectItem>
                                <SelectItem value="wednesday">Wednesday</SelectItem>
                                <SelectItem value="saturday">Saturday</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Volunteer List */}
                <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <Skeleton key={i} className="h-20 w-full" />
                            ))}
                        </div>
                    ) : volunteers.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
                                <Users className="h-8 w-8 text-emerald-400" />
                            </div>
                            <h3 className="font-semibold text-foreground mb-2">No volunteers found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                {searchName ? 'Try adjusting your search filters' : 'Add volunteers to start managing your ministry teams'}
                            </p>
                            {!searchName && (
                                <Button className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-600">
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add First Volunteer
                                </Button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Volunteer</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ministries</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Availability</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {volunteers.map((volunteer) => (
                                    <tr key={volunteer.uid} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                                                    {volunteer.displayName?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-foreground">{volunteer.displayName}</span>
                                                    <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {getMinistryNames(volunteer.volunteerProfile?.ministries).map((name, i) => (
                                                    <Badge key={i} variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
                                                        {name}
                                                    </Badge>
                                                ))}
                                                {(!volunteer.volunteerProfile?.ministries || volunteer.volunteerProfile.ministries.length === 0) && (
                                                    <span className="text-sm text-muted-foreground italic">None assigned</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1">
                                                {volunteer.volunteerProfile?.availability?.sunday && <Badge variant="outline" className="text-xs">Sun</Badge>}
                                                {volunteer.volunteerProfile?.availability?.wednesday && <Badge variant="outline" className="text-xs">Wed</Badge>}
                                                {volunteer.volunteerProfile?.availability?.saturday && <Badge variant="outline" className="text-xs">Sat</Badge>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {volunteer.volunteerProfile?.backgroundCheckStatus === 'approved' ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                                                    <CheckCircle className="w-3 h-3" /> Verified
                                                </div>
                                            ) : volunteer.volunteerProfile?.backgroundCheckStatus === 'expired' ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                                                    <AlertCircle className="w-3 h-3" /> Expired
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                                    <Clock className="w-3 h-3" /> Pending
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(volunteer)}>
                                                        Edit Profile
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Mail className="h-4 w-4 mr-2" />
                                                        Send Message
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Calendar className="h-4 w-4 mr-2" />
                                                        View Schedule
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <VolunteerProfileModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    user={selectedUser}
                    ministries={ministries}
                    onSave={async () => { await fetchVolunteers(); }}
                />
            </div>
        </div>
    );
}
