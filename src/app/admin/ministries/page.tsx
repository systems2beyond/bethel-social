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
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <VolunteerNav />

                <div className="flex justify-end">
                    <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        New Ministry
                    </Button>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search ministries..."
                        className="pl-10 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading ministries...</div>
                ) : filteredMinistries.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">No ministries found</h3>
                        <p className="text-gray-500 mb-6">Get started by creating your first ministry team.</p>
                        <Button onClick={openCreate} variant="outline">Create Ministry</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMinistries.map((ministry) => {
                            const MinistryIcon = getIcon(ministry.icon);
                            return (
                                <div key={ministry.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col h-full">
                                    <div className="h-2 w-full" style={{ backgroundColor: ministry.color }} />
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 rounded-lg bg-gray-50 text-gray-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                <MinistryIcon className="w-6 h-6" />
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(ministry)}>
                                                    <Settings className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                                </Button>
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{ministry.name}</h3>
                                        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px] flex-grow">
                                            {ministry.description || 'No description provided.'}
                                        </p>

                                        <div className="mt-auto space-y-3">
                                            <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-50">
                                                <span className="flex items-center">
                                                    <Users className="w-4 h-4 mr-1.5" />
                                                    {ministry.roles?.length || 0} Roles
                                                </span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${ministry.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {ministry.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <Link href={`/admin/ministries/${ministry.id}`} className="block">
                                                <Button className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-none">
                                                    Manage Team
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
