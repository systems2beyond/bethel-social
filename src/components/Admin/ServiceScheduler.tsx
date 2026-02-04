'use client';

import React, { useState, useEffect } from 'react';
import { useMinistry } from '@/context/MinistryContext';
import { VolunteerService } from '@/lib/volunteer-service';
import { Ministry, ServiceVolunteerSlot, FirestoreUser, PulpitSession } from '@/types';
import { Loader2, Plus, UserPlus, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';

interface ServiceSchedulerProps {
    session: PulpitSession;
}

export function ServiceScheduler({ session }: ServiceSchedulerProps) {
    const { userData } = useAuth();
    const churchId = userData?.churchId;
    const { ministries } = useMinistry();
    const [slots, setSlots] = useState<ServiceVolunteerSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [volunteers, setVolunteers] = useState<FirestoreUser[]>([]); // Cache of relevant volunteers

    useEffect(() => {
        refreshSlots();
        loadPotentialVolunteers();
    }, [session.id, churchId]);

    const refreshSlots = async () => {
        if (!churchId) return;
        setLoading(true);
        try {
            const data = await VolunteerService.getSessionSlots(session.id);
            setSlots(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadPotentialVolunteers = async () => {
        if (!churchId) return;
        // Ideally we'd only load volunteers for relevant ministries, but for now load all active
        try {
            const vols = await VolunteerService.searchVolunteers(churchId, {});
            setVolunteers(vols);
        } catch (error) {
            console.error(error);
        }
    };

    const addSlot = async (ministryId: string, roleName: string) => {
        if (!churchId) return;
        try {
            await VolunteerService.createSlot({
                sessionId: session.id,
                churchId,
                ministry: ministryId, // This is storing ID, type definition says 'string' (e.g. 'worship') but we should use ID or Name consistently. Using ID is safer if possible, but matching Ministry Data.
                // Checking VolunteerService implementation: createServiceSlot takes Omit<ServiceVolunteerSlot, 'id'...>
                // Type definition says ministry: string. Let's use ID to reference the Ministry object.
                role: roleName,
                status: 'open',
            });
            await refreshSlots();
        } catch (error) {
            console.error(error);
            alert('Failed to add slot');
        }
    };

    const assignUser = async (slotId: string, userId: string) => {
        const user = volunteers.find(v => v.uid === userId);
        if (!user) return;

        // Conflict Detection: Check if user is already assigned to another slot in this session
        const existingAssignment = slots.find(s => s.assignedUserId === userId);
        if (existingAssignment) {
            if (!confirm(`${user.displayName} is already assigned as ${existingAssignment.role}. Assign anyway?`)) {
                return;
            }
        }

        try {
            await VolunteerService.assignSlot(slotId, userId, user.displayName);
            await refreshSlots();
        } catch (error) {
            console.error(error);
            alert('Failed to assign volunteer');
        }
    };

    const removeSlot = async (slotId: string) => {
        if (!confirm('Remove this slot?')) return;
        try {
            await VolunteerService.deleteSlot(slotId);
            await refreshSlots();
        } catch (error) {
            console.error(error);
        }
    };

    const updateStatus = async (slotId: string, status: ServiceVolunteerSlot['status']) => {
        const slot = slots.find(s => s.id === slotId);
        if (!slot) return;
        try {
            await VolunteerService.updateSlot(slotId, { status });
            await refreshSlots();
        } catch (e) { console.error(e); }
    };

    // Group slots by Ministry
    const slotsByMinistry: Record<string, ServiceVolunteerSlot[]> = {};
    ministries.forEach(m => {
        slotsByMinistry[m.id] = slots.filter(s => s.ministry === m.id);
    });

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800">
                    Schedule for {new Date(session.date.seconds * 1000).toLocaleDateString()}
                    <span className="ml-2 text-sm text-gray-500 font-normal">
                        ({new Date(session.date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </span>
                </h3>
                <Button variant="outline" size="sm" onClick={refreshSlots}>
                    Refresh
                </Button>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {ministries.map(ministry => (
                        <div key={ministry.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <h4 className="font-semibold text-gray-800 flex items-center">
                                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: ministry.color }} />
                                    {ministry.name}
                                </h4>
                                <div className="flex gap-2">
                                    {/* Quick Add Buttons for Roles */}
                                    <DropdownMenuForRoles ministry={ministry} onAdd={(role) => addSlot(ministry.id, role)} />
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                {slotsByMinistry[ministry.id]?.map(slot => (
                                    <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:border-blue-100 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <Badge variant="outline" className="text-xs font-normal text-gray-600">
                                                    {slot.role}
                                                </Badge>
                                                <StatusBadge status={slot.status} />
                                            </div>

                                            {slot.assignedUserId ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm text-gray-900">{slot.assignedUserName}</span>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                                        onClick={() => updateStatus(slot.id, 'open')} // Unassign effectively by resetting? VolunteerService needs unassign or we just existing logic.
                                                    // Ideally we have an 'unassign' method. For now, let's just create a quick way to change status.
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="mt-1">
                                                    <Select onValueChange={(val) => assignUser(slot.id, val)}>
                                                        <SelectTrigger className="h-8 text-xs w-full max-w-[180px]">
                                                            <SelectValue placeholder="Assign Volunteer" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {volunteers
                                                                .filter(v => v.volunteerProfile?.ministries?.includes(ministry.id))
                                                                .map(v => (
                                                                    <SelectItem key={v.uid} value={v.uid}>{v.displayName}</SelectItem>
                                                                ))}
                                                            {volunteers.filter(v => v.volunteerProfile?.ministries?.includes(ministry.id)).length === 0 && (
                                                                <div className="px-2 py-1 text-xs text-gray-500">No volunteers in this ministry</div>
                                                            )}
                                                            <div className="h-px bg-gray-100 my-1" />
                                                            <div className="px-2 py-1 text-xs text-gray-400">All Volunteers:</div>
                                                            {volunteers.map(v => (
                                                                <SelectItem key={`all-${v.uid}`} value={v.uid}>{v.displayName}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        <div className="ml-4 flex items-center">
                                            {/* Actions */}
                                            {slot.assignedUserId && (
                                                <select
                                                    className="text-xs border rounded p-1 mr-2 bg-gray-50"
                                                    value={slot.status}
                                                    onChange={(e) => updateStatus(slot.id, e.target.value as any)}
                                                >
                                                    <option value="filled">Filled</option>
                                                    <option value="confirmed">Confirmed</option>
                                                    <option value="no_show">No Show</option>
                                                </select>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => removeSlot(slot.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {(!slotsByMinistry[ministry.id] || slotsByMinistry[ministry.id].length === 0) && (
                                    <div className="text-center py-4 text-sm text-gray-400 italic">
                                        No slots added yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function DropdownMenuForRoles({ ministry, onAdd }: { ministry: Ministry; onAdd: (role: string) => void }) {
    if (!ministry.roles || ministry.roles.length === 0) {
        return (
            <Button variant="ghost" size="sm" className="h-8" disabled>
                No Roles
            </Button>
        );
    }
    return (
        <select
            className="h-8 text-xs border rounded-md px-2 bg-white hover:bg-gray-50 cursor-pointer"
            onChange={(e) => {
                if (e.target.value) {
                    onAdd(e.target.value);
                    e.target.value = ''; // Reset
                }
            }}
            defaultValue=""
        >
            <option value="" disabled>+ Add Role</option>
            {ministry.roles.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
            ))}
        </select>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'open': return <Badge variant="outline" className="text-gray-500 border-gray-300">Open</Badge>;
        case 'filled': return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">Filled</Badge>;
        case 'confirmed': return <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100">Confirmed</Badge>;
        case 'no_show': return <Badge variant="destructive">No Show</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
}
