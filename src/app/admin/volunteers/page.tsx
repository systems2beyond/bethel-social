'use client';

import React, { useState, useEffect } from 'react';
import { useMinistry } from '@/context/MinistryContext';
import { VolunteerService } from '@/lib/volunteer-service';
import { FirestoreUser, VolunteerProfile } from '@/types';
import { VolunteerNav } from '@/components/Admin/VolunteerNav';
import { VolunteerProfileModal } from '@/components/Admin/VolunteerProfileModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Filter, Mail, Phone, MoreHorizontal, CheckCircle, AlertCircle, Calendar, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
            // Fetch active volunteers
            const filters: any = {};
            if (selectedMinistryId !== 'all') filters.ministry = selectedMinistryId;
            if (selectedDay !== 'all') filters.availableDay = selectedDay;

            const results = await VolunteerService.searchVolunteers(churchId, filters);

            // Client-side name filtering (Firestore doesn't support partial text search natively well with other filters)
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
    }, [churchId, selectedMinistryId, selectedDay, searchName]); // Search name triggers re-fetch (suboptimal but simple for now, maybe debounce)

    const handleEdit = (user: FirestoreUser) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const getMinistryNames = (ids?: string[]) => {
        if (!ids) return [];
        return ids.map(id => ministries.find(m => m.id === id)?.name).filter(Boolean);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <VolunteerNav />

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-10"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-10 rounded-md border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={selectedMinistryId}
                        onChange={(e) => setSelectedMinistryId(e.target.value)}
                    >
                        <option value="all">All Ministries</option>
                        {ministries.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <select
                        className="h-10 rounded-md border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                    >
                        <option value="all">Any Availability</option>
                        <option value="sunday">Sunday</option>
                        <option value="wednesday">Wednesday</option>
                        <option value="saturday">Saturday</option>
                    </select>
                </div>

                {/* List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                    ) : volunteers.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No volunteers found matching your filters.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Volunteer</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Ministries</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Availability</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {volunteers.map((volunteer) => (
                                    <tr key={volunteer.uid} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{volunteer.displayName}</span>
                                                <span className="text-sm text-gray-500">{volunteer.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {getMinistryNames(volunteer.volunteerProfile?.ministries).map((name, i) => (
                                                    <Badge key={i} variant="secondary" className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
                                                        {name}
                                                    </Badge>
                                                ))}
                                                {(!volunteer.volunteerProfile?.ministries || volunteer.volunteerProfile.ministries.length === 0) && (
                                                    <span className="text-sm text-gray-400 italic">None</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 text-xs text-gray-500">
                                                {volunteer.volunteerProfile?.availability?.sunday && <Badge variant="outline">Sun</Badge>}
                                                {volunteer.volunteerProfile?.availability?.wednesday && <Badge variant="outline">Wed</Badge>}
                                                {volunteer.volunteerProfile?.availability?.saturday && <Badge variant="outline">Sat</Badge>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {volunteer.volunteerProfile?.backgroundCheckStatus === 'approved' ? (
                                                <div className="flex items-center text-xs text-green-600 font-medium">
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Verified
                                                </div>
                                            ) : volunteer.volunteerProfile?.backgroundCheckStatus === 'expired' ? (
                                                <div className="flex items-center text-xs text-red-600 font-medium">
                                                    <AlertCircle className="w-3 h-3 mr-1" /> Expired
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">Pending Check</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(volunteer)}>
                                                Edit Profile
                                            </Button>
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
                    onSave={async () => { await fetchVolunteers(); }} // Correctly await the refresh
                />
            </div>
        </div>
    );
}
