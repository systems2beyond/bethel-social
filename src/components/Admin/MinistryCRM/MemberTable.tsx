'use client';

import React, { useState } from 'react';
import { FirestoreUser } from '@/types';
import { Loader2, Mail, FileText, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickMessageModal } from './QuickMessageModal';
import { TaskAssignmentModal } from './TaskAssignmentModal';

interface MemberTableProps {
    users: FirestoreUser[];
    loading: boolean;
}

export function MemberTable({ users, loading }: MemberTableProps) {
    const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
    const [messageModalOpen, setMessageModalOpen] = useState(false);
    const [taskModalOpen, setTaskModalOpen] = useState(false);

    const handleMessage = (user: FirestoreUser) => {
        setSelectedUser(user);
        setMessageModalOpen(true);
    };

    const handleAssignTask = (user: FirestoreUser) => {
        setSelectedUser(user);
        setTaskModalOpen(true);
    };

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    if (users.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
                <p>No members found in this ministry.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Member</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Availability</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {users.map((user) => (
                        <tr key={user.uid} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold overflow-hidden">
                                        {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user.displayName[0]}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900">{user.displayName}</span>
                                        <span className="text-xs text-gray-500">{user.email}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex gap-1 text-xs text-gray-500">
                                    {user.volunteerProfile?.availability?.sunday && <Badge variant="outline" className="border-gray-200">Sun</Badge>}
                                    {user.volunteerProfile?.availability?.wednesday && <Badge variant="outline" className="border-gray-200">Wed</Badge>}
                                    {user.volunteerProfile?.availability?.saturday && <Badge variant="outline" className="border-gray-200">Sat</Badge>}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border-none">
                                    Active
                                </Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => handleMessage(user)} title="Message">
                                        <Mail className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-indigo-600" onClick={() => handleAssignTask(user)} title="Assign Task">
                                        <FileText className="w-4 h-4" />
                                    </Button>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleMessage(user)}>Send Message</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAssignTask(user)}>Assign Task</DropdownMenuItem>
                                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <QuickMessageModal
                isOpen={messageModalOpen}
                onClose={() => setMessageModalOpen(false)}
                recipient={selectedUser}
            />

            <TaskAssignmentModal
                isOpen={taskModalOpen}
                onClose={() => setTaskModalOpen(false)}
                recipient={selectedUser}
            />
        </div>
    );
}
