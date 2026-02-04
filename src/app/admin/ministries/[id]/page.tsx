'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useMinistry } from '@/context/MinistryContext'; // Assuming context is available here or we fetch directly
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Ministry, FirestoreUser } from '@/types';
import { VolunteerService } from '@/lib/volunteer-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Calendar, Settings, Search, MessageSquare, Plus } from 'lucide-react';
import { MemberTable } from '@/components/Admin/MinistryCRM/MemberTable';
import * as Icons from 'lucide-react';
import Link from 'next/link';

export default function MinistryDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, userData } = useAuth();
    const { ministries } = useMinistry(); // Or fetch individually if not loaded
    const [ministry, setMinistry] = useState<Ministry | null>(null);
    const [members, setMembers] = useState<FirestoreUser[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const ministryId = typeof params?.id === 'string' ? params.id : '';

    // 1. Load Ministry
    useEffect(() => {
        if (!ministryId) return;

        // Try to find in context first
        const found = ministries.find(m => m.id === ministryId);
        if (found) {
            setMinistry(found);
        } else {
            // Fetch if not in context (e.g. direct load)
            const fetchMinistry = async () => {
                const docRef = doc(db, 'ministries', ministryId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setMinistry({ id: docSnap.id, ...docSnap.data() } as Ministry);
                }
            };
            fetchMinistry();
        }
    }, [ministryId, ministries]);

    // 2. Load Members
    useEffect(() => {
        if (!ministry || !userData?.churchId) return;

        const loadMembers = async () => {
            setLoadingMembers(true);
            try {
                // Using the specific ministry ID/Name as filter. 
                // Note: VolunteerService.searchVolunteers expects 'ministry' string which matches what's in array.
                // Assuming 'ministry.name' or 'ministry.id' is stored in user profile. 
                // Usually it's ministry ID in a robust system, but let's check how we save it.
                // Based on `VolunteerProfileModal`, we save IDs.
                const results = await VolunteerService.searchVolunteers(userData.churchId!, {
                    ministry: ministry.id // Filtering by ID
                });
                setMembers(results);
            } catch (error) {
                console.error("Failed to load members", error);
            } finally {
                setLoadingMembers(false);
            }
        };
        loadMembers();
    }, [ministry, userData?.churchId]);

    if (!ministry) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
    }

    const MinistryIcon = (Icons[ministry.icon as keyof typeof Icons] || Icons.Users) as React.ElementType;

    // Client-side search within the loaded members
    const filteredMembers = members.filter(m =>
        m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header Banner */}
            <div className="bg-white border-b border-gray-200">
                <div className="h-32 w-full relative overflow-hidden" style={{ backgroundColor: ministry.color }}>
                    <div className="absolute inset-0 bg-black/20" />
                </div>

                <div className="max-w-6xl mx-auto px-8 relative">
                    <div className="absolute -top-12 left-8 p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
                        <MinistryIcon className="w-12 h-12" style={{ color: ministry.color }} />
                    </div>

                    <div className="pt-16 pb-8 flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{ministry.name}</h1>
                            <p className="text-gray-500 max-w-2xl">{ministry.description}</p>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => router.back()}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Settings className="w-4 h-4 mr-2" />
                                Settings
                            </Button>
                        </div>
                    </div>

                    {/* Stats / Tabs */}
                    <div className="flex items-center gap-8 border-t border-gray-100 pt-6">
                        <div className="flex items-center gap-2 text-gray-600 font-medium pb-4 border-b-2 border-blue-600">
                            <Users className="w-4 h-4" />
                            Members ({members.length})
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 pb-4 hover:text-gray-700 cursor-pointer">
                            <Calendar className="w-4 h-4" />
                            Schedule
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 pb-4 hover:text-gray-700 cursor-pointer">
                            <MessageSquare className="w-4 h-4" />
                            Discussion
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

                {/* Actions Bar */}
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Find a member..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-3">
                        <Button className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Member
                        </Button>
                    </div>
                </div>

                {/* Member Table */}
                <MemberTable users={filteredMembers} loading={loadingMembers} />

            </div>
        </div>
    );
}
