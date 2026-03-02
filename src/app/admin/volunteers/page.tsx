'use client';

import React, { useState, useEffect } from 'react';
import { useMinistry } from '@/context/MinistryContext';
import { VolunteerRecruitmentService } from '@/lib/services/VolunteerRecruitmentService';
import { VolunteerSignup, VolunteerSignupStatus } from '@/types';
import { VolunteerNav } from '@/components/Admin/VolunteerNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    Search,
    MoreHorizontal,
    CheckCircle,
    AlertCircle,
    Clock,
    Users,
    UserPlus,
    ArrowLeft,
    Mail,
    Phone,
    ChevronRight,
    MessageSquare,
    ShieldCheck,
    XCircle,
    Heart,
    Sparkles,
    Link as LinkIcon,
    Copy,
    Settings
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Pipeline stage config
const PIPELINE_STAGES: { status: VolunteerSignupStatus; label: string; color: string; icon: React.ElementType }[] = [
    { status: 'new', label: 'New', color: 'bg-blue-500', icon: Sparkles },
    { status: 'contacted', label: 'Contacted', color: 'bg-purple-500', icon: MessageSquare },
    { status: 'screening', label: 'Screening', color: 'bg-amber-500', icon: ShieldCheck },
    { status: 'approved', label: 'Approved', color: 'bg-green-500', icon: CheckCircle },
    { status: 'placed', label: 'Placed', color: 'bg-emerald-600', icon: Users },
];

// Stats card component
const StatCard = ({ label, value, icon: Icon, color, active, onClick }: {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    active?: boolean;
    onClick?: () => void;
}) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left w-full",
            "hover:shadow-md",
            active
                ? "bg-white dark:bg-zinc-800 border-emerald-300 dark:border-emerald-600 ring-2 ring-emerald-500/20"
                : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800"
        )}
    >
        <div className={cn("p-2 rounded-lg", color)}>
            <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    </button>
);

// Source badge
const SourceBadge = ({ source }: { source: string }) => {
    const config: Record<string, { label: string; className: string }> = {
        form: { label: 'Signup Form', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
        rsvp_event: { label: 'Event RSVP', className: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
        manual: { label: 'Manual Entry', className: 'bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' },
    };
    const { label, className } = config[source] || config.manual;
    return <Badge variant="secondary" className={cn("text-[10px] border-0", className)}>{label}</Badge>;
};

// Status badge
const StatusBadge = ({ status }: { status: VolunteerSignupStatus }) => {
    const config: Record<VolunteerSignupStatus, { label: string; className: string; icon: React.ElementType }> = {
        new: { label: 'New', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Sparkles },
        contacted: { label: 'Contacted', className: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: MessageSquare },
        screening: { label: 'Screening', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: ShieldCheck },
        approved: { label: 'Approved', className: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
        placed: { label: 'Placed', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Users },
        declined: { label: 'Declined', className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
    };
    const { label, className, icon: Icon } = config[status];
    return (
        <Badge variant="secondary" className={cn("text-xs border-0 gap-1", className)}>
            <Icon className="w-3 h-3" />
            {label}
        </Badge>
    );
};

export default function VolunteerRecruitmentPage() {
    const { userData } = useAuth();
    const churchId = userData?.churchId;
    const { ministries } = useMinistry();

    const [signups, setSignups] = useState<VolunteerSignup[]>([]);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState<Record<VolunteerSignupStatus, number>>({
        new: 0, contacted: 0, screening: 0, approved: 0, placed: 0, declined: 0
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [ministryFilter, setMinistryFilter] = useState<string>('all');

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSignup, setSelectedSignup] = useState<VolunteerSignup | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        ministryInterests: [] as string[],
        availability: { sunday: false, monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false },
        skills: '',
        message: '',
        notes: ''
    });

    // Subscribe to signups
    useEffect(() => {
        if (!churchId) return;

        const unsubscribe = VolunteerRecruitmentService.subscribeToChurchSignups(
            churchId,
            (newSignups) => {
                setSignups(newSignups);
                // Calculate counts
                const newCounts: Record<VolunteerSignupStatus, number> = {
                    new: 0, contacted: 0, screening: 0, approved: 0, placed: 0, declined: 0
                };
                newSignups.forEach(s => {
                    if (newCounts[s.status] !== undefined) newCounts[s.status]++;
                });
                setCounts(newCounts);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [churchId]);

    // Filter signups
    const filteredSignups = signups.filter(signup => {
        // Status filter
        if (statusFilter !== 'all' && signup.status !== statusFilter) return false;

        // Ministry filter
        if (ministryFilter !== 'all' && !signup.ministryInterests.includes(ministryFilter)) return false;

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            if (!signup.name.toLowerCase().includes(term) &&
                !signup.email.toLowerCase().includes(term)) {
                return false;
            }
        }

        return true;
    });

    // Handlers
    const handleAddSignup = async () => {
        if (!churchId || !userData) return;

        try {
            await VolunteerRecruitmentService.createSignup({
                churchId,
                name: formData.name,
                email: formData.email.toLowerCase(),
                phone: formData.phone || undefined,
                ministryInterests: formData.ministryInterests,
                availability: formData.availability,
                skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
                message: formData.message || undefined,
                notes: formData.notes || undefined,
                status: 'new',
                source: 'manual'
            });
            toast.success('Volunteer added to pipeline');
            setIsAddModalOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            toast.error('Failed to add volunteer');
        }
    };

    const handleUpdateStatus = async (signupId: string, newStatus: VolunteerSignupStatus) => {
        if (!userData) return;
        try {
            await VolunteerRecruitmentService.updateStatus(
                signupId,
                newStatus,
                userData.uid,
                userData.displayName
            );
            toast.success(`Moved to ${newStatus}`);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
        }
    };

    const handleUpdateNotes = async () => {
        if (!selectedSignup) return;
        try {
            await VolunteerRecruitmentService.updateNotes(selectedSignup.id, formData.notes);
            toast.success('Notes updated');
            setIsEditModalOpen(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update notes');
        }
    };

    const handleDelete = async (signupId: string) => {
        if (!confirm('Are you sure you want to remove this volunteer from the pipeline?')) return;
        try {
            await VolunteerRecruitmentService.deleteSignup(signupId);
            toast.success('Volunteer removed');
        } catch (error) {
            console.error(error);
            toast.error('Failed to remove volunteer');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            ministryInterests: [],
            availability: { sunday: false, monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false },
            skills: '',
            message: '',
            notes: ''
        });
    };

    const openEditModal = (signup: VolunteerSignup) => {
        setSelectedSignup(signup);
        setFormData({
            ...formData,
            notes: signup.notes || ''
        });
        setIsEditModalOpen(true);
    };

    const copySignupLink = () => {
        const link = `${window.location.origin}/volunteer-signup/${churchId}`;
        navigator.clipboard.writeText(link);
        toast.success('Link copied to clipboard');
    };

    const totalActive = counts.new + counts.contacted + counts.screening + counts.approved;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
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
                                    <h1 className="text-xl font-bold text-foreground">Volunteer Recruitment</h1>
                                    <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        {totalActive} in pipeline
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Track and manage volunteer signups
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden sm:flex"
                                onClick={() => setIsShareModalOpen(true)}
                            >
                                <LinkIcon className="h-4 w-4 mr-2" />
                                Share Form
                            </Button>
                            <Button
                                size="sm"
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm"
                                onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Volunteer
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                <VolunteerNav />

                {/* Pipeline Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {PIPELINE_STAGES.map(stage => (
                        <StatCard
                            key={stage.status}
                            label={stage.label}
                            value={counts[stage.status]}
                            icon={stage.icon}
                            color={stage.color}
                            active={statusFilter === stage.status}
                            onClick={() => setStatusFilter(statusFilter === stage.status ? 'all' : stage.status)}
                        />
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-10 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                {PIPELINE_STAGES.map(s => (
                                    <SelectItem key={s.status} value={s.status}>{s.label}</SelectItem>
                                ))}
                                <SelectItem value="declined">Declined</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={ministryFilter} onValueChange={setMinistryFilter}>
                            <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-900">
                                <SelectValue placeholder="All Interests" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Interests</SelectItem>
                                {ministries.map(m => (
                                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Signups List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-24 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : filteredSignups.length === 0 ? (
                        <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
                                <Users className="h-8 w-8 text-emerald-400" />
                            </div>
                            <h3 className="font-semibold text-foreground mb-2">No volunteer signups yet</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                                Share your signup form to start collecting volunteer interest, or add someone manually.
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                <Button variant="outline" onClick={() => setIsShareModalOpen(true)}>
                                    <LinkIcon className="h-4 w-4 mr-2" />
                                    Share Form
                                </Button>
                                <Button
                                    className="bg-gradient-to-r from-emerald-500 to-teal-600"
                                    onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add Volunteer
                                </Button>
                            </div>
                        </div>
                    ) : (
                        filteredSignups.map(signup => (
                            <div
                                key={signup.id}
                                className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                            {signup.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-foreground">{signup.name}</span>
                                                <StatusBadge status={signup.status} />
                                                <SourceBadge source={signup.source} />
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {signup.email}
                                                </span>
                                                {signup.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {signup.phone}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                {signup.ministryInterests.map((interest, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs">
                                                        {interest}
                                                    </Badge>
                                                ))}
                                                {signup.availability?.sunday && <Badge variant="secondary" className="text-[10px]">Sun</Badge>}
                                                {signup.availability?.monday && <Badge variant="secondary" className="text-[10px]">Mon</Badge>}
                                                {signup.availability?.tuesday && <Badge variant="secondary" className="text-[10px]">Tue</Badge>}
                                                {signup.availability?.wednesday && <Badge variant="secondary" className="text-[10px]">Wed</Badge>}
                                                {signup.availability?.thursday && <Badge variant="secondary" className="text-[10px]">Thu</Badge>}
                                                {signup.availability?.friday && <Badge variant="secondary" className="text-[10px]">Fri</Badge>}
                                                {signup.availability?.saturday && <Badge variant="secondary" className="text-[10px]">Sat</Badge>}
                                            </div>
                                            {signup.notes && (
                                                <p className="text-xs text-muted-foreground mt-2 italic line-clamp-1">
                                                    Note: {signup.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* Quick status actions */}
                                        {signup.status === 'new' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleUpdateStatus(signup.id, 'contacted')}
                                            >
                                                Mark Contacted
                                            </Button>
                                        )}
                                        {signup.status === 'contacted' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleUpdateStatus(signup.id, 'screening')}
                                            >
                                                Start Screening
                                            </Button>
                                        )}
                                        {signup.status === 'screening' && (
                                            <Button
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600 text-white"
                                                onClick={() => handleUpdateStatus(signup.id, 'approved')}
                                            >
                                                Approve
                                            </Button>
                                        )}
                                        {signup.status === 'approved' && (
                                            <Button
                                                size="sm"
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                                onClick={() => handleUpdateStatus(signup.id, 'placed')}
                                            >
                                                Mark Placed
                                            </Button>
                                        )}

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditModal(signup)}>
                                                    Edit Notes
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => window.location.href = `mailto:${signup.email}`}>
                                                    <Mail className="h-4 w-4 mr-2" />
                                                    Send Email
                                                </DropdownMenuItem>
                                                {signup.phone && (
                                                    <DropdownMenuItem onClick={() => window.location.href = `tel:${signup.phone}`}>
                                                        <Phone className="h-4 w-4 mr-2" />
                                                        Call
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-amber-600"
                                                    onClick={() => handleUpdateStatus(signup.id, 'declined')}
                                                >
                                                    <XCircle className="h-4 w-4 mr-2" />
                                                    Decline
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => handleDelete(signup.id)}
                                                >
                                                    Remove
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Volunteer Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-lg rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                    <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                                <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            Add Volunteer
                        </DialogTitle>
                        <DialogDescription>
                            Manually add someone interested in volunteering
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Name *
                            </Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="John Smith"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Email *
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="john@example.com"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Phone
                            </Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="(555) 123-4567"
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Ministry Interests <span className="font-normal normal-case">(optional)</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                {ministries.map(m => (
                                    <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <Checkbox
                                            checked={formData.ministryInterests.includes(m.name)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setFormData({
                                                        ...formData,
                                                        ministryInterests: [...formData.ministryInterests, m.name]
                                                    });
                                                } else {
                                                    setFormData({
                                                        ...formData,
                                                        ministryInterests: formData.ministryInterests.filter(n => n !== m.name)
                                                    });
                                                }
                                            }}
                                        />
                                        {m.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Availability
                            </Label>
                            <div className="flex flex-wrap gap-3">
                                {([
                                    { key: 'sunday', label: 'Sun' },
                                    { key: 'monday', label: 'Mon' },
                                    { key: 'tuesday', label: 'Tue' },
                                    { key: 'wednesday', label: 'Wed' },
                                    { key: 'thursday', label: 'Thu' },
                                    { key: 'friday', label: 'Fri' },
                                    { key: 'saturday', label: 'Sat' }
                                ] as const).map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                        <Checkbox
                                            checked={formData.availability[key]}
                                            onCheckedChange={(checked) => {
                                                setFormData({
                                                    ...formData,
                                                    availability: { ...formData.availability, [key]: !!checked }
                                                });
                                            }}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                                Notes
                            </Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Any additional notes..."
                                rows={3}
                                className="rounded-xl resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddSignup}
                            disabled={!formData.name || !formData.email}
                            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                            Add to Pipeline
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Notes Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                    <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            Edit Notes
                        </DialogTitle>
                        <DialogDescription>
                            {selectedSignup?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Add notes about this volunteer..."
                            rows={5}
                            className="rounded-xl resize-none"
                        />
                    </div>
                    <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateNotes} className="rounded-xl">
                            Save Notes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Share Form Modal */}
            <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl border-gray-200/50 dark:border-zinc-700/50 shadow-[0_25px_50px_-12px_rgb(0,0,0,0.25)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl">
                    <DialogHeader className="pb-4 border-b border-gray-100 dark:border-zinc-800">
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                                <LinkIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            Share Signup Form
                        </DialogTitle>
                        <DialogDescription>
                            Share this link to collect volunteer interest
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2">
                            <Input
                                readOnly
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/volunteer-signup/${churchId}`}
                                className="font-mono text-sm rounded-xl"
                            />
                            <Button variant="outline" size="icon" onClick={copySignupLink} className="rounded-xl">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Anyone with this link can submit their interest in volunteering. Submissions will appear in this dashboard.
                        </p>
                        <Link
                            href="/admin/volunteer-form"
                            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                <Settings className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">Customize Form</p>
                                <p className="text-xs text-muted-foreground">Edit fields, branding, and colors</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                    </div>
                    <DialogFooter className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <Button variant="outline" onClick={() => setIsShareModalOpen(false)} className="rounded-xl">
                            Close
                        </Button>
                        <Button onClick={copySignupLink} className="rounded-xl">
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
